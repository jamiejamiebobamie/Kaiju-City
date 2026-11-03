# NPC training

Trains an NPC for Kaiju City with reinforcement learning (MaskablePPO from sb3-contrib) on the game's own rules.

## How it fits together

- `src/Game/DataClasses/npcBrain/brain.ts`: what a trained NPC sees (146 numbers) and can do (28 actions: stay or step in one of six directions, times no power or one of its three). Also the mask of legal actions.
- `src/Game/DataClasses/npcBrain/TrainingEnv.ts`: one training match, a 2 v 2 on the Peninsula with no Kaiju. The learner's teammate and both opponents play by the rules, and every piece gets three random powers. This file also holds the rewards.
- `training/bridge/bridge.ts`: runs a `TrainingEnv` in Node and talks to Python over stdin/stdout. Run `npm run build:bridge` after any change to the game.
- `training/kaiju_env.py`: the Gymnasium environment that starts the bridge.
- `src/Game/DataClasses/npcBrain/npcModel.ts`: plays the exported model in the browser. It loads `onnxruntime-web` on demand and is switched on by the dev panel's "Trained NPCs" box.

## Rewards

- The learner loses a real life: -1. On death, every life still left also counts.
- The learner's own power takes a real life from an opponent: +1. If that kills them, every life they still had also counts.
- Health passives aren't rewarded or penalised directly. The NPC sees them (its lives modifier, and each passive's time left), and they only matter through the lives they cost or save.
- The team wins: +3. Each decision costs -0.002, so the NPC doesn't stall.

## Commands

From the repo root. `PY` is a Python with `requirements.txt` installed. QuickCast's already has everything: `../QuickCast/training/.venv/Scripts/python.exe`.

```
npm run build:bridge
$PY training/train.py --steps 2000000 --envs 12
$PY training/evaluate.py training/models/<name>.zip --games 200
$PY training/export_onnx.py training/models/<name>.zip public/models/npc.onnx
$PY -m tensorboard.main --logdir training/runs
```

`evaluate.py` plays the same seeds twice: once with the model in charge of the learner's piece, and once with the rules in charge. That compares the two directly.

Changing the observation or the actions means training a new model. Increase `OBSERVATION_VERSION` in `brain.ts` when you do.
