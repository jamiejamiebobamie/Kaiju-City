"""How a trained NPC does against the game's rules-based NPC, on the same matches, and how aggressive it plays.

For each kind of match (a 2 v 2, and the Kaiju waves) each seed is played once with the rules in charge of the agent's
piece, and once with the model in charge at each aggression level.
Run: $PY training/evaluate.py training/models/<name>.zip --games 100

Per row: how often the team won, how often the agent died, its reward and the match length, then how aggressive it was:
casts a minute, its distance to the closest opponent (in rows), the share of decisions that closed that distance,
and the lives it took and lost per match.
"""
import argparse
import json

import numpy as np
from model_io import load_model

from kaiju_env import KaijuEnv

KINDS = ("versus", "kaiju")
AGGRESSIONS = (0.0, 0.5, 1.0)


def play(env, model, seed, options):
    observation, _ = env.reset(seed=seed, options=options)
    total, done, info = 0.0, False, {}
    while not done:
        action = 0
        if model is not None:
            action, _ = model.predict(observation, action_masks=env.action_masks(), deterministic=True)
        observation, reward, terminated, truncated, info = env.step(action)
        total += reward
        done = terminated or truncated
    return total, info


def summarize(played) -> dict:
    infos = [info for _, info in played]
    minutes = sum(info.get("timeMs", 0) for info in infos) / 60000
    return {
        "winRate": float(np.mean([bool(info.get("isWon")) for info in infos])),
        "deathRate": float(np.mean([bool(info.get("isLearnerDead")) for info in infos])),
        "meanReward": float(np.mean([total for total, _ in played])),
        "meanSeconds": float(np.mean([info.get("timeMs", 0) for info in infos])) / 1000,
        "castsPerMinute": sum(info.get("casts", 0) for info in infos) / max(minutes, 1e-9),
        "meanNearestRows": sum(info.get("nearestRowsSum", 0) for info in infos) / max(sum(info.get("nearestCount", 0) for info in infos), 1),
        "closingShare": sum(info.get("closings", 0) for info in infos) / max(sum(info.get("decisions", 0) for info in infos), 1),
        "livesTaken": float(np.mean([info.get("livesTaken", 0) for info in infos])),
        "livesLost": float(np.mean([info.get("livesLost", 0) for info in infos])),
    }


def evaluate(model, games: int, seed: int = 1_000_000, kinds=KINDS, aggressions=AGGRESSIONS) -> dict:
    """{kind: {"rules": row, "model@0.5": row, ...}}. The rules' reward is scored at aggression 0.5."""
    players = [("rules", True, 0.5)] + [(f"model@{aggression:g}", False, aggression) for aggression in aggressions]
    results = {}
    for kind in kinds:
        results[kind] = {}
        for name, is_baseline, aggression in players:
            env = KaijuEnv(is_baseline=is_baseline)
            options = {"kind": kind, "aggression": aggression}
            played = [play(env, None if is_baseline else model, seed + game, options) for game in range(games)]
            env.close()
            results[kind][name] = summarize(played)
    return results


def print_table(results: dict):
    columns = ("winRate", "deathRate", "meanReward", "meanSeconds", "castsPerMinute", "meanNearestRows", "closingShare", "livesTaken", "livesLost")
    for kind, rows in results.items():
        print(f"\n{kind}")
        print(f"{'':12}" + "".join(f"{column:>16}" for column in columns))
        for name, row in rows.items():
            print(f"{name:12}" + "".join(f"{row[column]:>16.3f}" for column in columns))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("model")
    parser.add_argument("--games", type=int, default=100, help="games per row")
    parser.add_argument("--json", action="store_true", help="print JSON instead of a table")
    args = parser.parse_args()
    results = evaluate(load_model(args.model), args.games)
    if args.json:
        print(json.dumps(results, indent=2))
    else:
        print_table(results)
