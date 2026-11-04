"""Gymnasium environment for Kaiju City's NPCs.

The game's rules live in JavaScript (src/Game). This environment starts the Node bridge (training/bridge, built with
`npm run build:bridge`) and talks to it over stdin/stdout, so training always uses exactly the game's own rules.

The agent is one NPC on the Peninsula, with 1 to 4 allies, against 1 to 5 opponents or the Kaiju; everyone else plays by the
game's rules. Each match's kind, side sizes, and the agent's aggression (0 careful to 1 reckless, one of its inputs) are random,
unless reset is given options={"kind": "versus" | "kaiju", "aggression": 0-1, "sizes": {"allies": n, "opponents": n}}.
Observations, actions, legal-move masks and rewards are defined in src/Game/DataClasses/npcBrain.
Use with sb3-contrib's MaskablePPO, which reads `action_masks()`.
"""
import json
import pathlib
import subprocess

import gymnasium as gym
import numpy as np
from gymnasium import spaces

BRIDGE_PATH = pathlib.Path(__file__).parent / "bridge" / "dist" / "bridge.mjs"


class KaijuEnv(gym.Env):
    metadata = {"render_modes": []}

    def __init__(self, is_baseline: bool = False):
        """is_baseline: the agent's piece plays by the rules instead (actions are ignored), to compare against."""
        if not BRIDGE_PATH.exists():
            raise FileNotFoundError(f"{BRIDGE_PATH} not found: run `npm run build:bridge` first")
        self.is_baseline = is_baseline
        self._process = subprocess.Popen(
            ["node", str(BRIDGE_PATH)],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, encoding="utf-8", bufsize=1,
        )
        spec = self._request({"cmd": "spec"})
        self.observation_version = spec["observationVersion"]
        self.observation_space = spaces.Box(-np.inf, np.inf, shape=(spec["observationSize"],), dtype=np.float32)
        self.action_space = spaces.Discrete(spec["numActions"])
        self._action_mask = np.ones(spec["numActions"], dtype=bool)

    def _request(self, message: dict) -> dict:
        self._process.stdin.write(json.dumps(message) + "\n")
        self._process.stdin.flush()
        line = self._process.stdout.readline()
        if not line:
            raise RuntimeError("the Kaiju bridge stopped unexpectedly")
        response = json.loads(line)
        if "error" in response:
            raise RuntimeError(f"Kaiju bridge error: {response['error']}")
        return response

    def _unpack(self, result: dict) -> np.ndarray:
        self._action_mask = np.array(result["actionMask"], dtype=bool)
        return np.array(result["observation"], dtype=np.float32)

    def reset(self, *, seed=None, options=None):
        super().reset(seed=seed)
        # the game's own randomness comes from this seed, so an episode replays exactly
        game_seed = int(self.np_random.integers(0, 2**31 - 1))
        request = {"cmd": "reset", "seed": game_seed, "isBaseline": self.is_baseline}
        request.update({key: value for key, value in (options or {}).items() if key in ("kind", "aggression", "sizes")})
        result = self._request(request)
        return self._unpack(result), result["info"]

    def step(self, action):
        result = self._request({"cmd": "step", "action": int(action)})
        observation = self._unpack(result)
        return observation, float(result["reward"]), bool(result["terminated"]), bool(result["truncated"]), result["info"]

    def action_masks(self) -> np.ndarray:
        """Legal actions right now (read by MaskablePPO)."""
        return self._action_mask

    def close(self):
        if self._process.poll() is None:
            self._process.stdin.close()
            self._process.wait(timeout=5)
