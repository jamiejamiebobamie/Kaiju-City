"""The sweep, as one table: each test against the baseline. python balance-results/sweep_table.py"""
import glob
import json
import re

def load(prefix):
    runs = [json.load(open(path)) for path in sorted(glob.glob(f"balance-results/{prefix}-[0-9].json"))]
    powers = runs[0]["versus"]["winRate"]
    mean = lambda get: sum(get(run) for run in runs) / len(runs)
    return {
        power: (mean(lambda r: r["versus"]["winRate"][power]), mean(lambda r: r["kaiju"]["winRate"][power]), mean(lambda r: r["kaiju"]["kills"][power]))
        for power in powers
    }, mean(lambda r: r["kaiju"]["overallKills"]), sum(r["versus"]["timeouts"] for r in runs)

base, base_kills, _ = load("base")
targets = {"fire": "fire", "haunt": "death", "shield": "metal"}
names = sorted({re.match(r".*sweep-(.+)-[0-9]\.json", path).group(1) for path in glob.glob("balance-results/sweep-*-[0-9].json")})
print(f"{'test':20} {'versus':>6} {'kaijuW':>7} {'kills':>6}  all-kills  draws  (baseline in brackets)")
for name in names:
    table, kills, timeouts = load(f"sweep-{name}")
    power = targets[name.split("-")[0]]
    versus, kaiju, power_kills = table[power]
    print(f"{name:20} {versus:6.3f} {kaiju:7.3f} {power_kills:6.2f}  {kills:6.2f}  {timeouts:4d}  ({base[power][0]:.3f} {base[power][1]:.3f} {base[power][2]:.2f})")
print("baseline all-kills", round(base_kills, 2))
