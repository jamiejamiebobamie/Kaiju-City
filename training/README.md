# NPC training

Trains an NPC for Kaiju City with reinforcement learning (MaskablePPO from sb3-contrib) on the game's own rules.

## How it fits together

- `src/Game/DataClasses/npcBrain/brain.ts`: what a trained NPC sees (149 numbers: itself, its powers, the nearest two enemies and nearest ally, how many are on each side, the tiles around it, and last its aggression) and can do (28 actions: stay or step in one of six directions, times no power or one of its three). Also the mask of legal actions.
- `src/Game/DataClasses/npcBrain/TrainingEnv.ts`: one training match on the Peninsula. The learner fights alone (30% of matches, as a rival does in a recruit fight) or with 1 to 4 allies (as with recruits along), against 1 to 5 opponents with no Kaiju, or (35% of matches) against the Kaiju waves. Everyone but the learner plays by the rules, and every piece gets three random powers. This file also holds the rewards.
- `training/bridge/bridge.ts`: runs a `TrainingEnv` in Node and talks to Python over stdin/stdout. Run `npm run build:bridge` after any change to the game.
- `training/kaiju_env.py`: the Gymnasium environment that starts the bridge.
- `src/Game/DataClasses/npcBrain/npcModel.ts`: plays the exported model in the browser. It loads `onnxruntime-web` on demand and is switched on by the dev panel's "Trained NPCs" box.

## Rewards

- The learner loses a real life: -1. On death, every life still left also counts.
- The learner's own power takes a real life from an opponent: +1. If that kills them, every life they still had also counts.
- Health passives aren't rewarded or penalised directly. The NPC sees them (its lives modifier, and each passive's time left), and they only matter through the lives they cost or save.
- The team wins: +3. Each decision costs -0.002, so the NPC doesn't stall.
- Kaiju count as opponents: a Kaiju life taken with the learner's power is +1 too.

## Aggression

Each match gives the learner a random aggression from 0 (careful) to 1 (reckless), and it sees that number. At 0.5 the rewards are exactly the above. Towards 1, lives taken are worth up to 1.5, lives lost cost as little as 0.5, and being near an opponent earns a little each decision; towards 0, the reverse. So one model plays the whole range, and the game picks a value per NPC (`piece.aggression`), even mid-fight. The dev panel's slider sets it for every trained NPC.

`evaluate.py` shows, for each kind of match, the rules NPC and the model at aggression 0, 0.5 and 1: wins, deaths, reward, match length, casts a minute, distance to the closest opponent, the share of decisions that closed it, and lives taken and lost.

## Commands

From the repo root. `PY` is a Python with `requirements.txt` installed. QuickCast's already has everything: `../QuickCast/training/.venv/Scripts/python.exe`.

```
npm run build:bridge
$PY training/train.py --steps 2000000 --envs 12
$PY training/evaluate.py training/models/<name>.zip --games 100
$PY training/export_onnx.py training/models/<name>.zip public/models/npc.onnx
$PY -m tensorboard.main --logdir training/runs
```

`evaluate.py` plays the same seeds for every row: with the rules in charge of the learner's piece, and with the model in charge at each aggression level. That compares them directly.

Changing the observation or the actions means training a new model. Increase `OBSERVATION_VERSION` in `brain.ts` when you do.
