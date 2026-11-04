"""Train a Kaiju City NPC with MaskablePPO (PPO that never picks an illegal move).

Run from the repo root, after `npm run build:bridge` (PY is the Python with the packages in requirements.txt):
  $PY training/train.py --steps 1000000
  $PY training/train.py --steps 1000000 --resume training/models/<name>.zip

Each run saves the model (.zip) and a description (.json: the git commit of the rules it was trained on, its settings,
and how it did against the rules-based NPC) to training/models/, plus checkpoints along the way.
Charts: $PY -m tensorboard.main --logdir training/runs
"""
import argparse
import datetime
import json
import pathlib
import subprocess

import numpy as np
from sb3_contrib import MaskablePPO
from stable_baselines3.common.callbacks import BaseCallback, CallbackList, CheckpointCallback
from stable_baselines3.common.env_util import make_vec_env
from stable_baselines3.common.vec_env import SubprocVecEnv

from evaluate import evaluate, print_table
from kaiju_env import KaijuEnv
from model_io import load_model

MODELS_DIR = pathlib.Path(__file__).parent / "models"
RUNS_DIR = pathlib.Path(__file__).parent / "runs"


class GameStatsCallback(BaseCallback):
    """Logs, per rollout: how often the team won (and against the Kaiju), how often the agent died, and how long games lasted."""

    def __init__(self):
        super().__init__()
        self._games = []

    def _on_step(self) -> bool:
        for done, info in zip(self.locals["dones"], self.locals["infos"]):
            if done:
                self._games.append(info)
        return True

    def _on_rollout_end(self) -> None:
        if not self._games:
            return
        self.logger.record("game/win_rate", float(np.mean([bool(g.get("isWon")) for g in self._games])))
        self.logger.record("game/death_rate", float(np.mean([bool(g.get("isLearnerDead")) for g in self._games])))
        self.logger.record("game/seconds", float(np.mean([g.get("timeMs", 0) for g in self._games])) / 1000)
        kaiju = [g for g in self._games if g.get("kind") == "kaiju"]
        if kaiju:
            self.logger.record("game/kaiju_win_rate", float(np.mean([bool(g.get("isWon")) for g in kaiju])))
        self._games = []


def git_commit() -> str:
    try:
        return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], text=True).strip()
    except Exception:
        return "unknown"


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--steps", type=int, default=1_000_000, help="training steps (agent decisions, about 3 a second of game time)")
    parser.add_argument("--envs", type=int, default=12, help="games played in parallel, one process each")
    parser.add_argument("--resume", type=pathlib.Path, help="continue training this saved model")
    parser.add_argument("--eval-games", type=int, default=100, help="games per row of the evaluation at the end")
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args()

    run_name = f"kaiju-npc-{datetime.datetime.now():%Y%m%d-%H%M}-{git_commit()}"
    MODELS_DIR.mkdir(exist_ok=True)
    envs = make_vec_env(KaijuEnv, n_envs=args.envs, seed=args.seed, vec_env_cls=SubprocVecEnv)
    if args.resume:
        model = load_model(args.resume, env=envs, tensorboard_log=str(RUNS_DIR))
    else:
        model = MaskablePPO(
            "MlpPolicy", envs, seed=args.seed, tensorboard_log=str(RUNS_DIR), verbose=1,
            n_steps=1024, batch_size=1024, n_epochs=6, gamma=0.995, gae_lambda=0.95, ent_coef=0.01, learning_rate=3e-4,
            policy_kwargs={"net_arch": [256, 256]},
        )
    checkpoints = CheckpointCallback(save_freq=max(100_000 // args.envs, 1), save_path=str(MODELS_DIR / f"{run_name}-checkpoints"), name_prefix="step")
    model.learn(total_timesteps=args.steps, callback=CallbackList([GameStatsCallback(), checkpoints]), tb_log_name=run_name, reset_num_timesteps=not args.resume)
    envs.close()

    model_path = MODELS_DIR / f"{run_name}.zip"
    model.save(model_path)
    results = evaluate(model, args.eval_games)
    description = {"commit": git_commit(), "steps": args.steps, "resumedFrom": str(args.resume) if args.resume else None, "results": results}
    (MODELS_DIR / f"{run_name}.json").write_text(json.dumps(description, indent=2))
    print_table(results)
    print(f"saved {model_path}")


if __name__ == "__main__":
    main()
