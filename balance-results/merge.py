"""Averages a batch of balance runs into one table. python merge.py base"""
import glob
import json
import sys

runs = [json.load(open(path)) for path in sorted(glob.glob(f"balance-results/{sys.argv[1]}-[0-9].json"))]
powers = list(runs[0]["versus"]["winRate"])

def mean(get):
    return sum(get(run) for run in runs) / len(runs)

table = {
    power: {
        "versus": round(mean(lambda run: run["versus"]["winRate"][power]), 3),
        "kaijuKills": round(mean(lambda run: run["kaiju"]["kills"][power]), 2),
        "kaijuWin": round(mean(lambda run: run["kaiju"]["winRate"][power]), 3),
    }
    for power in powers
}
print(f"{'power':10} versus  kills  kaijuWin")
for power, row in sorted(table.items(), key=lambda item: -item[1]["versus"]):
    print(f"{power:10} {row['versus']:.3f}  {row['kaijuKills']:5.2f}  {row['kaijuWin']:.3f}")
print("overall kills", round(mean(lambda run: run["kaiju"]["overallKills"]), 2),
      "kaiju win rate", round(mean(lambda run: run["kaiju"]["overallWinRate"]), 3),
      "versus timeouts", sum(run["versus"]["timeouts"] for run in runs),
      "seconds", max(run["seconds"] for run in runs),
      "matches", sum(run["matches"] for run in runs))
