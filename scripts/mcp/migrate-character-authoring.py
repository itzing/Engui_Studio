#!/usr/bin/env python3
"""Add immutable character identity metadata without rewriting existing versions."""
import argparse
import hashlib
from pathlib import Path
import sqlite3

parser = argparse.ArgumentParser()
parser.add_argument('--database', required=True)
parser.add_argument('--backup', required=True)
args = parser.parse_args()
database, backup = Path(args.database).resolve(), Path(args.backup).resolve()
if not database.is_file() or database == backup:
    raise SystemExit('Existing database and separate backup path required.')
sql = Path(__file__).with_name('002-character-authoring.sql').read_text()
checksum = hashlib.sha256(sql.encode()).hexdigest()
connection = sqlite3.connect(database, timeout=60)
old = connection.execute('SELECT checksum FROM mcp_schema_migrations WHERE id=?', ('002',)).fetchone()
if old:
    if old[0] != checksum:
        raise SystemExit('Applied migration checksum differs.')
    print('Character authoring migration already applied; no changes.')
    raise SystemExit(0)
if backup.exists():
    raise SystemExit('Choose a new backup path.')
backup.parent.mkdir(parents=True, exist_ok=True)
with sqlite3.connect(backup) as target:
    connection.backup(target)
backup.chmod(0o600)
try:
    connection.executescript('BEGIN IMMEDIATE;\n' + sql)
    connection.execute('INSERT INTO mcp_schema_migrations VALUES (?,?)', ('002', checksum))
    connection.commit()
except BaseException:
    connection.rollback()
    raise
print('Character identity snapshot column added; existing versions preserved.')
