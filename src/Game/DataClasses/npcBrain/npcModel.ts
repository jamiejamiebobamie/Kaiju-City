import type * as Ort from 'onnxruntime-web';
import { DECISION_TICKS, decodeAction, getActionMask, observe, OBSERVATION_SIZE } from './brain';

/*
  The trained NPC in the browser. The ONNX runtime is large, so it is only loaded the first time a trained NPC plays,
  as its own file. The model (training/export_onnx.py) is in public/models.
  A dev playtest: NPCs switch to it with the "Trained NPCs" box, and play by the rules without it.
*/
const MODEL_PATH = '/models/npc.onnx';

let runtime: Promise<typeof Ort> | null = null;
const loadOnnxRuntime = (): Promise<typeof Ort> => runtime ??= import('onnxruntime-web');

let session: Promise<Ort.InferenceSession> | null = null;
const loadSession = () => session ??= loadOnnxRuntime().then(ort => ort.InferenceSession.create(MODEL_PATH));

// the closest enemy is a Kaiju
const getIsFacingKaiju = (gm, piece) => {
  const enemy = gm.gameManagerProxy.getClosestEnemy(piece.pieceIndex);
  return !!enemy && enemy.avatar == 'kaiju';
};

// the best legal action, as the trained model's deterministic choice
const chooseAction = (logits: Float32Array, mask: Array<boolean>) => mask.reduce((best, isLegal, action) =>
  isLegal && (best < 0 || logits[action] > logits[best]) ? action : best, -1);

/*
  Decides for each trained piece, every few game ticks, like the training did.
  Inference is asynchronous: a piece keeps its last action until the next one is ready.
*/
export class NpcModelDriver {
  ticks = 0;
  isDeciding = false;
  isBroken = false;

  // 'getPieces': the pieces the model plays, asked each time. 'getAggression': theirs, 0 to 1, asked at each decision
  constructor(private getPieces: () => Array<any>, private getAggression?: () => number) {}

  // when it is switched off, every piece goes back to the rules
  stop() {
    this.isBroken = true;
    this.getPieces().forEach(piece => { piece.brainAction = undefined; piece.aggression = undefined; });
  }

  step(gm) {
    this.ticks += 1;
    if (this.isBroken || this.isDeciding || this.ticks % DECISION_TICKS) return;
    const pieces = this.getPieces().filter(piece => !piece.isDead && piece.isOnTiles && piece.isNpc);
    if (!pieces.length) return;
    this.isDeciding = true;
    loadSession()
      .then(async net => {
        const ort = await loadOnnxRuntime();
        for (const piece of pieces) {
          if (this.isBroken) return; // switched off while deciding
          // against the Kaiju, the rules still do better than the model (training run 3): they take over
          if (getIsFacingKaiju(gm, piece)) {
            piece.brainAction = undefined;
            continue;
          }
          if (this.getAggression) piece.aggression = this.getAggression();
          const observation = new ort.Tensor('float32', Float32Array.from(observe(gm, piece)), [1, OBSERVATION_SIZE]);
          const { logits } = await net.run({ observation });
          const action = chooseAction(logits.data as Float32Array, getActionMask(piece, gm.gameManagerProxy, gm.getAccTime()));
          if (action >= 0) piece.brainAction = decodeAction(action);
        }
      })
      .catch(error => {
        // no model, or it can't run here: the NPCs keep to the rules
        console.warn('Trained NPCs are off:', error);
        this.isBroken = true;
        pieces.forEach(piece => { piece.brainAction = undefined; });
      })
      .finally(() => { this.isDeciding = false; });
  }
}
