// bridge.ts
// Runs one TrainingEnv and talks to Python (training/kaiju_env.py) over stdin/stdout, one JSON message per line.
// Build with `npm run build:bridge`: it bundles the game's rules into training/bridge/dist/bridge.mjs.
//
// Requests:                                             Responses:
//   {"cmd": "spec"}                                     {"observationSize", "numActions", "observationVersion"}
//   {"cmd": "reset", "seed"?: n, "isBaseline"?: bool}   a step result
//   {"cmd": "step", "action": n}                        a step result
// A step result is {"observation", "actionMask", "reward", "terminated", "truncated", "info"}. Errors are {"error": message}.
// 'isBaseline': the learner's piece plays by the rules instead, and the action is ignored: to compare a model against.
import { createInterface } from 'node:readline';
import { NUM_ACTIONS, OBSERVATION_SIZE, OBSERVATION_VERSION } from '../../src/Game/DataClasses/npcBrain/brain';
import { TrainingEnv } from '../../src/Game/DataClasses/npcBrain/TrainingEnv';

// the game writes the odd log line: only the bridge's answers may reach stdout
const write = process.stdout.write.bind(process.stdout);
console.log = console.warn = console.info = (...args) => process.stderr.write(args.join(' ') + '\n');

const env = new TrainingEnv();

const handle = request => {
  switch (request.cmd) {
    case 'spec': return { observationSize: OBSERVATION_SIZE, numActions: NUM_ACTIONS, observationVersion: OBSERVATION_VERSION };
    case 'reset': return env.reset({ seed: request.seed, isBaseline: !!request.isBaseline });
    case 'step': return env.step(request.action);
    default: return { error: `unknown command: ${JSON.stringify(request)}` };
  }
};

createInterface({ input: process.stdin }).on('line', line => {
  let response;
  try {
    response = handle(JSON.parse(line));
  } catch (error) {
    response = { error: String(error && error.stack || error) };
  }
  write(JSON.stringify(response) + '\n');
});
