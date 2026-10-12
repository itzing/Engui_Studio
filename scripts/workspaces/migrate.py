#!/usr/bin/env python3
"""Rehearse or apply the versioned, preservation-checked workspace migration."""
import argparse
import hashlib
import json
import sqlite3
import uuid
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[2]
SQL_PATH = Path(__file__).with_name("001-workspace-isolation.sql")
INVENTORY_PATH = ROOT / "src/lib/workspaces/ownership.json"
VERSION = "20261012-workspace-isolation-v1"
MODELS = json.loads(INVENTORY_PATH.read_text())

def quote(value):
    return "'" + str(value).replace("'", "''") + "'"

def table_columns(db, table):
    return [row[1] for row in db.execute(f'PRAGMA table_info("{table}")')]

def snapshot(db):
    result = {}
    owners = {}
    for (table,) in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"):
        if table == "workspace_migrations":
            continue
        columns = table_columns(db, table)
        stable = [c for c in columns if c != "workspaceId" and not (table == "presets" and c == "userId")]
        selected = ", ".join('"' + c + '"' for c in stable)
        rows = sorted(json.dumps(tuple(row), default=str, separators=(",", ":")) for row in db.execute(f'SELECT {selected} FROM "{table}"'))
        result[table] = {"count": len(rows), "columns": stable, "sha256": hashlib.sha256("\n".join(rows).encode()).hexdigest()}
        if "workspaceId" in columns and "id" in columns:
            owners[table] = dict(db.execute(f'SELECT id, workspaceId FROM "{table}" WHERE workspaceId IS NOT NULL'))
    return result, owners

def verify_preservation(db, before, owners):
    for table, expected in before.items():
        selected = ", ".join('"' + c + '"' for c in expected["columns"])
        rows = sorted(json.dumps(tuple(row), default=str, separators=(",", ":")) for row in db.execute(f'SELECT {selected} FROM "{table}"'))
        digest = hashlib.sha256("\n".join(rows).encode()).hexdigest()
        if len(rows) != expected["count"] or digest != expected["sha256"]:
            raise ValueError("Preservation mismatch in " + table)
    for table, expected in owners.items():
        actual = dict(db.execute(f'SELECT id, workspaceId FROM "{table}"'))
        if any(actual.get(key) != value for key, value in expected.items()):
            raise ValueError("Existing ownership changed in " + table)

def owner_expression(model, alias):
    config = MODELS[model]
    if config["owned"]:
        return f'{alias}."workspaceId"'
    parent = next((r for r in config["relations"] if r["field"] == config["parent"]), None)
    if not parent:
        return None
    target = MODELS[parent["model"]]
    expression = owner_expression(parent["model"], "parent_" + model)
    return f'(SELECT {expression} FROM "{target["table"]}" parent_{model} WHERE parent_{model}."id" = {alias}."{parent["fields"][0]}")'

def install_guards(db):
    db.execute('CREATE UNIQUE INDEX IF NOT EXISTS "workspaces_protected_user" ON workspaces(userId) WHERE isProtected = 1')
    db.execute("""CREATE TRIGGER IF NOT EXISTS workspace_protected_delete
      BEFORE DELETE ON workspaces WHEN OLD.isProtected = 1
      BEGIN SELECT RAISE(ABORT, 'The original Default workspace is protected'); END""")
    db.execute("""CREATE TRIGGER IF NOT EXISTS workspace_protected_identity
      BEFORE UPDATE ON workspaces
      WHEN (OLD.isProtected = 1 AND (NEW.isProtected != 1 OR NEW.isDefault != 1 OR NEW.id != OLD.id OR NEW.userId != OLD.userId OR NEW.lifecycle != 'active'))
        OR (OLD.isProtected = 0 AND (NEW.isProtected != 0 OR NEW.isDefault != OLD.isDefault))
      BEGIN SELECT RAISE(ABORT, 'Default identity cannot be changed'); END""")
    for model, config in MODELS.items():
        if config["operational"]:
            continue
        expression = owner_expression(model, "NEW")
        if not expression:
            continue
        table = config["table"]
        db.execute(f"""CREATE TRIGGER IF NOT EXISTS "{table}_workspace_insert"
          BEFORE INSERT ON "{table}"
          WHEN {expression} IS NULL OR NOT EXISTS (SELECT 1 FROM workspaces WHERE id = {expression} AND lifecycle = 'active')
          BEGIN SELECT RAISE(ABORT, 'Workspace is missing or deleting'); END""")
        if config["owned"]:
            db.execute(f"""CREATE TRIGGER IF NOT EXISTS "{table}_workspace_immutable"
              BEFORE UPDATE OF workspaceId ON "{table}" WHEN NEW.workspaceId IS NOT OLD.workspaceId
              BEGIN SELECT RAISE(ABORT, 'Workspace transfers are not supported'); END""")
        if config["parent"]:
            old_expression = owner_expression(model, "OLD")
            db.execute(f"""CREATE TRIGGER IF NOT EXISTS "{table}_inherited_owner_immutable"
              BEFORE UPDATE ON "{table}" WHEN {expression} IS NOT {old_expression}
              BEGIN SELECT RAISE(ABORT, 'Workspace transfers are not supported'); END""")
        for relation in config["relations"]:
            if relation["model"] == "Workspace" or len(relation["fields"]) != 1:
                continue
            other = MODELS[relation["model"]]
            target_owner = owner_expression(relation["model"], "target")
            if not target_owner:
                continue
            field = relation["fields"][0]
            for event in ["INSERT", "UPDATE"]:
                db.execute(f"""CREATE TRIGGER IF NOT EXISTS "{table}_{field}_{event.lower()}_owner"
                  BEFORE {event} ON "{table}"
                  WHEN NEW."{field}" IS NOT NULL AND EXISTS (
                    SELECT 1 FROM "{other['table']}" target WHERE target.id = NEW."{field}" AND {target_owner} IS NOT {expression})
                  BEGIN SELECT RAISE(ABORT, 'Cross-workspace relationship rejected'); END""")
    for field in ["loraId", "highLoraId", "lowLoraId"]:
        for event in ["INSERT", "UPDATE"]:
            db.execute(f"""CREATE TRIGGER IF NOT EXISTS "lora_profile_{field}_{event.lower()}_owner"
              BEFORE {event} ON lora_helper_profiles
              WHEN NEW."{field}" IS NOT NULL AND NOT EXISTS
              (SELECT 1 FROM loras WHERE id = NEW."{field}" AND workspaceId = NEW.workspaceId)
              BEGIN SELECT RAISE(ABORT, 'Invalid LoRA helper owner'); END""")
    for event in ["INSERT", "UPDATE"]:
        db.execute(f"""CREATE TRIGGER IF NOT EXISTS "loras_sharing_{event.lower()}"
          BEFORE {event} ON loras WHEN NEW.isShared = 1 AND NOT EXISTS
          (SELECT 1 FROM workspaces WHERE id = NEW.workspaceId AND isProtected = 1)
          BEGIN SELECT RAISE(ABORT, 'Only Default LoRAs can be shared'); END""")

def validate_ownership(db):
    for model, config in MODELS.items():
        if config["operational"]:
            continue
        expression = owner_expression(model, "source")
        if not expression:
            continue
        table = config["table"]
        missing = db.execute(f'SELECT COUNT(*) FROM "{table}" source WHERE {expression} IS NULL OR NOT EXISTS (SELECT 1 FROM workspaces WHERE id = {expression})').fetchone()[0]
        if missing:
            raise ValueError("Unresolved owner in " + table)
        for relation in config["relations"]:
            if relation["model"] == "Workspace" or len(relation["fields"]) != 1:
                continue
            target = MODELS[relation["model"]]
            target_owner = owner_expression(relation["model"], "target")
            if not target_owner:
                continue
            field = relation["fields"][0]
            count = db.execute(f'SELECT COUNT(*) FROM "{table}" source JOIN "{target["table"]}" target ON target.id = source."{field}" WHERE {expression} IS NOT {target_owner}').fetchone()[0]
            if count:
                raise ValueError("Cross-workspace relation in " + table + "." + field)
    for field in ["loraId", "highLoraId", "lowLoraId"]:
        if db.execute(f'SELECT COUNT(*) FROM lora_helper_profiles p LEFT JOIN loras l ON l.id=p."{field}" WHERE p."{field}" IS NOT NULL AND (l.id IS NULL OR l.workspaceId IS NOT p.workspaceId)').fetchone()[0]:
            raise ValueError("Invalid LoRA helper ownership")
    for table in ["job_materialization_tasks", "studio_session_job_materializations"]:
        if table not in {v["table"] for v in MODELS.values()}:
            continue
        if db.execute(f'SELECT COUNT(*) FROM "{table}" t JOIN jobs j ON j.id=t.jobId WHERE t.workspaceId IS NOT j.workspaceId').fetchone()[0]:
            raise ValueError("Invalid task owner in " + table)

def apply(db, default_id):
    checksum = hashlib.sha256(SQL_PATH.read_bytes() + Path(__file__).read_bytes() + INVENTORY_PATH.read_bytes()).hexdigest()
    tables = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    if "workspace_migrations" in tables:
        done = db.execute("SELECT checksum FROM workspace_migrations WHERE id=?", (VERSION,)).fetchone()
        if done:
            if done[0] != checksum:
                raise ValueError("Applied migration checksum mismatch")
            validate_ownership(db)
            if db.execute("PRAGMA foreign_key_check").fetchall():
                raise ValueError("Foreign key violations after prior migration")
            return {"status": "already-applied", "migration": VERSION}
    default = db.execute("SELECT id, userId, isDefault FROM workspaces WHERE id=?", (default_id,)).fetchone()
    if not default or default[2] != 1:
        raise ValueError("Verified original Default was not found")
    if db.execute("SELECT COUNT(*) FROM workspaces WHERE userId=? AND isDefault=1", (default[1],)).fetchone()[0] != 1:
        raise ValueError("Ambiguous Default identity")
    if db.execute("SELECT COUNT(*) FROM workspaces WHERE userId != ?", (default[1],)).fetchone()[0]:
        raise ValueError("Multiple users require an explicit per-user backfill mapping")
    allowed_preset_owners = {default[1]} | {r[0] for r in db.execute("SELECT id FROM workspaces")}
    if any(r[0] not in allowed_preset_owners for r in db.execute("SELECT DISTINCT userId FROM presets")):
        raise ValueError("Unrecognized legacy preset owner")
    if db.execute("PRAGMA quick_check").fetchone()[0] != "ok" or db.execute("PRAGMA foreign_key_check").fetchall():
        raise ValueError("Source database integrity check failed")
    before, owners = snapshot(db)
    db.execute("PRAGMA foreign_keys=OFF")
    db.execute("BEGIN IMMEDIATE")
    try:
        sql = SQL_PATH.read_text().replace("'__DEFAULT_WORKSPACE_ID__'", quote(default_id))
        statement = ""
        for line in sql.splitlines(keepends=True):
            statement += line
            if sqlite3.complete_statement(statement):
                if "PRAGMA " not in statement:
                    db.execute(statement)
                statement = ""
        if statement.strip() and not statement.strip().startswith("--"):
            raise ValueError("Incomplete migration SQL")
        db.execute("UPDATE workspaces SET isProtected=1 WHERE id=?", (default_id,))
        for ident, path, url in db.execute("SELECT id, s3Path, s3Url FROM loras").fetchall():
            prefix = "/runpod-volume/"
            if not path.startswith(prefix):
                raise ValueError("Unrecognized legacy LoRA path")
            key = path[len(prefix):]
            decoded = unquote(url)
            suffix = "/" + key
            if not decoded.endswith(suffix):
                raise ValueError("Ambiguous legacy LoRA storage target")
            target = hashlib.sha256(decoded[:-len(suffix)].rstrip("/").encode()).hexdigest()
            db.execute("UPDATE loras SET sourceKey=?, storageTarget=? WHERE id=?", (key, target, ident))
        # Inventory legacy local media without moving files or consulting browser selection.
        prefixes = ("/generations/", "/thumbnails/", "/exports/", "/uploads/", "/upload/", "/results/")
        def local_resources(value):
            if isinstance(value, str):
                if value.startswith(prefixes):
                    yield value.split("?")[0]
                elif value.startswith(("{", "[")):
                    try:
                        yield from local_resources(json.loads(value))
                    except (ValueError, TypeError):
                        pass
            elif isinstance(value, dict):
                for key, item in value.items():
                    if key not in {"prompt", "negativePrompt", "negative_prompt", "notes", "description", "text", "title", "name"}:
                        yield from local_resources(item)
            elif isinstance(value, list):
                for item in value:
                    yield from local_resources(item)
        for model, config in MODELS.items():
            expression = owner_expression(model, "source") if not config["operational"] else None
            if not expression:
                continue
            columns = table_columns(db, config["table"])
            for record in db.execute(f'SELECT source.*, {expression} FROM "{config["table"]}" source').fetchall():
                workspace_id = record[-1]
                for location in set(local_resources(dict(zip(columns, record[:-1])))):
                    db.execute("INSERT OR IGNORE INTO workspace_files(id,workspaceId,location,storageTarget) VALUES (?,?,?,'local')", (str(uuid.uuid4()), workspace_id, location))
        validate_ownership(db)
        verify_preservation(db, before, owners)
        if db.execute("PRAGMA foreign_key_check").fetchall():
            raise ValueError("Migration introduced foreign key violations")
        install_guards(db)
        db.execute("INSERT INTO workspace_migrations(id,checksum) VALUES (?,?)", (VERSION, checksum))
        db.commit()
    except BaseException:
        db.rollback()
        raise
    finally:
        db.execute("PRAGMA foreign_keys=ON")
    return {"status": "applied", "migration": VERSION, "tablesPreserved": len(before), "counts": {name: data["count"] for name, data in before.items()}}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", type=Path, required=True)
    parser.add_argument("--default-id", required=True)
    parser.add_argument("--apply", action="store_true", help="Without this flag, execute only on an in-memory copy.")
    parser.add_argument("--backup", type=Path, help="Verified SQLite backup required for applying changes.")
    args = parser.parse_args()
    if not args.database.is_file():
        raise ValueError("Database does not exist")
    if args.apply:
        if not args.backup or not args.backup.is_file() or args.backup.resolve() == args.database.resolve():
            raise ValueError("An independent backup file is required for apply")
        backup = sqlite3.connect("file:" + str(args.backup.resolve()) + "?mode=ro", uri=True)
        if backup.execute("PRAGMA quick_check").fetchone()[0] != "ok" or not backup.execute("SELECT 1 FROM workspaces WHERE id=?", (args.default_id,)).fetchone():
            raise ValueError("Backup validation failed")
        backup.close()
        db = sqlite3.connect(args.database, timeout=30)
        db.execute('PRAGMA journal_mode=WAL')
        db.execute('PRAGMA busy_timeout=30000')
    else:
        source = sqlite3.connect("file:" + str(args.database.resolve()) + "?mode=ro", uri=True)
        db = sqlite3.connect(":memory:")
        source.backup(db)
        source.close()
    result = apply(db, args.default_id)
    result["dryRun"] = not args.apply
    print(json.dumps(result, indent=2))
    db.close()

if __name__ == "__main__":
    main()
