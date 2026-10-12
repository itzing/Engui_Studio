#!/usr/bin/env python3
"""Exercise only endpoint path/workflow functions; no network or GPU."""
import ast
import hashlib
import json
import os
import sys
import tempfile
from pathlib import Path
base = Path(sys.argv[1])
source = base / "ZImage_runpod-zimage/handler.py"
tree = ast.parse(source.read_text())
wanted = {"is_path_inside", "resolve_lora_source_path", "build_lora_cache_name"}
functions = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in wanted]
assert len(functions) == len(wanted)
with tempfile.TemporaryDirectory() as folder:
    root = Path(folder)
    scope = {"os": os, "hashlib": hashlib, "LORA_SOURCE_ROOTS": [str(root)], "LORA_CACHE_ROOT": str(root / "cache")}
    exec(compile(ast.Module(body=functions, type_ignores=[]), str(source), "exec"), scope)
    names = []
    for name in ["style.safetensors", "workspaces/A/style.safetensors", "workspaces/B/style.safetensors"]:
        item = root / name
        item.parent.mkdir(parents=True, exist_ok=True)
        item.write_bytes(b"fixture")
        assert scope["resolve_lora_source_path"](name) == str(item)
        assert scope["resolve_lora_source_path"](str(item)) == str(item)
        names.append(scope["build_lora_cache_name"](str(item))[0])
    assert len(set(names)) == 3
    try:
        scope["resolve_lora_source_path"]("../foreign.safetensors")
    except Exception:
        pass
    else:
        raise AssertionError("Traversal accepted")
wan = base / "wan22_Runpod_hub/handler.py"
tree = ast.parse(wan.read_text())
handler = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "handler")
mapping = next(n for n in ast.walk(handler) if isinstance(n, ast.If) and ast.unparse(n.test) == "lora_count > 0")
for count in [1, 2, 3]:
    prompt = json.loads((wan.parent / f"wan22_{count}lora.json").read_text())
    pairs = [{"high": f"workspaces/A/pair{i}_high.safetensors", "low": f"workspaces/A/pair{i}_low.safetensors"} for i in range(count)]
    scope = {"lora_count": count, "lora_pairs": pairs, "prompt": prompt}
    exec(compile(ast.Module(body=[mapping], type_ignores=[]), str(wan), "exec"), scope)
    for index, pair in enumerate(pairs):
        assert prompt[scope["current_mapping"]["high"][index]]["inputs"]["lora_name"] == pair["high"]
        assert prompt[scope["current_mapping"]["low"][index]]["inputs"]["lora_name"] == pair["low"]
assert "/runpod-volume/loras/" in (wan.parent / "extra_model_paths.yaml").read_text()
print(json.dumps({"passed": True, "zImageNestedPaths": True, "sameBasenameCacheSeparation": True, "wanPairs": [1, 2, 3], "remoteJobRun": False}))
