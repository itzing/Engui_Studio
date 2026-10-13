"""Verify migration preservation against a consistent pre-migration SQLite copy."""
import sqlite3, json, sys
before, after = [sqlite3.connect("file:"+p+"?mode=ro", uri=True) for p in sys.argv[1:3]]
allowed = {
 "characters":{"editorState","currentVersionId","updatedAt"},
 "outfits":{"sourceJson","revision","updatedAt"},
 "studio_poses":{"visibleRegionsJson","updatedAt"},
 "studio_session_runs":{"templateSnapshotJson","updatedAt"},
}
showdown="af66834c-0ed0-42ea-9c90-d96c1e7643e8"
counts={}
for (table,) in before.execute("select name from sqlite_master where type='table' and name not like 'sqlite_%'"):
 columns=[r[1] for r in before.execute('pragma table_info("'+table+'")')]
 selected=','.join('"'+c+'"' for c in columns)
 a=before.execute('select '+selected+' from "'+table+'"').fetchall()
 b=after.execute('select '+selected+' from "'+table+'"').fetchall()
 counts[table]=[len(a),len(b)]
 if table=="character_versions":
  assert len(b)==len(a)+7, (table,len(a),len(b))
  assert set(a)<=set(b), "Historical character versions changed"
 elif table in allowed:
  assert len(a)==len(b),(table,"row count changed")
  idx=columns.index("id");right={row[idx]:row for row in b}
  changed=0
  for row in a:
   new=right[row[idx]]
   if row==new: continue
   changed+=1
   assert row[columns.index("workspaceId")]==showdown,(table,"other workspace changed")
   differences={c for i,c in enumerate(columns) if row[i]!=new[i]}
   assert differences<=allowed[table],(table,differences)
  print(table,"changed",changed)
 else: assert set(a)==set(b),(table,"unexpected content change")
assert after.execute("pragma integrity_check").fetchone()[0]=="ok"
assert not after.execute("pragma foreign_key_check").fetchall()
print(json.dumps({"verifiedTables":len(counts),"counts":counts},sort_keys=True))
