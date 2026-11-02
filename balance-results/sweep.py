"""Tests one stat change at a time for Fire, Haunt and Shield. Stops and picks up where it left off. python balance-results/sweep.py"""
import json
import os
import subprocess
from pathlib import Path

RESULTS = Path("balance-results")
BATCHES = 4
MATCHES = 150

def range_edit(status, base_range, base_ai_range, new_range, tracks=False):
    edit = {"range": new_range, "desiredAIRange": max(1, round(base_ai_range * new_range / base_range))}
    if tracks:
        edit["isTracking"] = [{"tickFrom": 0, "tickTo": new_range}]
    return {status: edit}

VARIANTS = {}
for new_range in (6, 16, 34, 44):
    VARIANTS[f"fire-range-{new_range}"] = range_edit("isOnFire", 25, 10, new_range)
for new_area in (1, 2, 4, 5):
    VARIANTS[f"fire-area-{new_area}"] = {"isOnFire": {"area": new_area}}
for new_range in (8, 19, 41, 52):
    VARIANTS[f"haunt-range-{new_range}"] = range_edit("isGhosted", 30, 15, new_range, tracks=True)
for new_range in (1, 3):
    VARIANTS[f"shield-range-{new_range}"] = range_edit("isShielded", 2, 4, new_range)
for new_area in (2, 4, 8, 10):
    VARIANTS[f"shield-area-{new_area}"] = {"isShielded": {"area": new_area}}
VARIANTS["haunt-no-passive"] = {"isGhosted": {"modifierVal": 0}}

for name, edits in VARIANTS.items():
    if (RESULTS / f"sweep-{name}-{BATCHES}.json").exists():
        continue
    edits_path = RESULTS / f"sweep-{name}-edits.json"
    edits_path.write_text(json.dumps(edits))
    runs = []
    for batch in range(1, BATCHES + 1):
        env = {**os.environ, "KAIJU_BALANCE": str(RESULTS / f"sweep-{name}-{batch}.json"), "BALANCE_EDITS": str(edits_path), "BALANCE_MATCHES": str(MATCHES), "BALANCE_SEED": str(batch)}
        runs.append(subprocess.Popen("npx vitest run src/Game/DataClasses/balance", shell=True, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for run in runs:
        run.wait()
    print(name, "done", flush=True)
