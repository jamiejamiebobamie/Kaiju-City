"""How a trained NPC does against the game's rules-based NPC, on the same matches.

Each seed is played twice: once with the model in charge of the agent's piece, once with the rules in charge of it.
Run: $PY training/evaluate.py training/models/<name>.zip --games 200
"""
import argparse
import json

import numpy as np
from sb3_contrib import MaskablePPO

from kaiju_env import KaijuEnv


def play(env, model, seed):
    observation, _ = env.reset(seed=seed)
    total, done, info = 0.0, False, {}
    while not done:
        action = 0
        if model is not None:
            action, _ = model.predict(observation, action_masks=env.action_masks(), deterministic=True)
        observation, reward, terminated, truncated, info = env.step(action)
        total += reward
        done = terminated or truncated
    return total, info


def evaluate(model, games: int, seed: int = 1_000_000) -> dict:
    results = {}
    for name, is_baseline in (("model", False), ("rules", True)):
        env = KaijuEnv(is_baseline=is_baseline)
        played = [play(env, None if is_baseline else model, seed + game) for game in range(games)]
        env.close()
        results[name] = {
            "winRate": float(np.mean([bool(info.get("isWon")) for _, info in played])),
            "deathRate": float(np.mean([bool(info.get("isLearnerDead")) for _, info in played])),
            "meanReward": float(np.mean([total for total, _ in played])),
            "meanSeconds": float(np.mean([info.get("timeMs", 0) for _, info in played])) / 1000,
        }
    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("model")
    parser.add_argument("--games", type=int, default=200)
    args = parser.parse_args()
    print(json.dumps(evaluate(MaskablePPO.load(args.model), args.games), indent=2))
