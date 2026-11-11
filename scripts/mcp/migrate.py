#!/usr/bin/env python3
"""Apply the additive MCP migration with a consistent SQLite backup."""
import argparse
import hashlib
import pathlib
import sqlite3

parser = argparse.ArgumentParser()
parser.add_argument('--database', required=True)
parser.add_argument('--backup', required=True)
args = parser.parse_args()
database = pathlib.Path(args.database).resolve()
backup = pathlib.Path(args.backup).resolve()
if not database.is_file() or database == backup:
    raise SystemExit('Choose an existing database and a separate backup path.')
sql = pathlib.Path(__file__).with_name('001-mcp.sql').read_text()
checksum = hashlib.sha256(sql.encode()).hexdigest()
connection = sqlite3.connect(database, timeout=60)
connection.execute('PRAGMA foreign_keys=ON')
connection.execute('CREATE TABLE IF NOT EXISTS mcp_schema_migrations (id TEXT PRIMARY KEY, checksum TEXT NOT NULL)')
old = connection.execute('SELECT checksum FROM mcp_schema_migrations WHERE id=?', ('001',)).fetchone()
if old:
    if old[0] != checksum:
        raise SystemExit('Applied migration checksum differs.')
    print('MCP migration already applied; no changes.')
    raise SystemExit(0)
backup.parent.mkdir(parents=True, exist_ok=True)
if backup.exists():
    raise SystemExit('Backup path already exists; choose a new path.')
with sqlite3.connect(backup) as target:
    connection.backup(target)
backup.chmod(0o600)
try:
    connection.executescript('BEGIN IMMEDIATE;\n' + sql)
    # Keep every historical duplicate and every original. Only the oldest active
    # membership becomes canonical; duplicate legacy copies retain a NULL key.
    rows = connection.execute('SELECT id,workspaceId,bucket,sourceJobId,sourceOutputId FROM gallery_assets WHERE trashed=0 AND sourceJobId IS NOT NULL AND sourceOutputId IS NOT NULL ORDER BY addedToGalleryAt,id').fetchall()
    seen = set()
    for asset_id, workspace, bucket, job_id, output_id in rows:
        key = 'job:' + job_id + ':' + output_id
        scope = (workspace, bucket, key)
        if scope in seen:
            continue
        seen.add(scope)
        connection.execute('UPDATE gallery_assets SET membershipKey=? WHERE id=?', (key, asset_id))
    connection.execute('INSERT INTO mcp_schema_migrations VALUES (?,?)', ('001', checksum))
    # Historical unrelated FK debt is checked separately; new tables must be sound.
    for table in ['mcp_generation_plans','mcp_generation_batches','mcp_generation_variants']:
        if connection.execute('PRAGMA foreign_key_check(' + table + ')').fetchall():
            raise RuntimeError('MCP foreign key validation failed.')
    connection.commit()
except BaseException:
    connection.rollback()
    raise
print('MCP migration applied; existing rows and originals preserved.')
