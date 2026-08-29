import json
import hashlib
from pathlib import Path

p = Path("backend/data/audit_trail.jsonl")
if p.exists():
    lines = [json.loads(line) for line in p.read_text(encoding="utf-8").strip().split("\n") if line.strip()]
    prev_hash = "GENESIS_ROOT_00000000000000000000000000000000"
    out_lines = []
    for i, d in enumerate(lines):
        d["entry_id"] = f"AUDIT_{i+1:04d}"
        d["prev_hash"] = prev_hash
        override = d.get("override_reason") or ""
        payload = f"{prev_hash}|{d['entry_id']}|{d['timestamp_sec']}|{d['recommendation_id']}|{d['train_id']}|{d['action']}|{d['controller_action']}|{override}|{d['projected_delay_saved_sec']}"
        curr_hash = hashlib.sha256(payload.encode("utf-8")).hexdigest()
        d["entry_hash"] = curr_hash
        prev_hash = curr_hash
        out_lines.append(json.dumps(d))
    
    p.write_text("\n".join(out_lines) + "\n", encoding="utf-8")
    print(f"Successfully re-chained {len(out_lines)} audit records.")
