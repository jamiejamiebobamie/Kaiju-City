import { fileURLToPath } from 'node:url';

// the project's absolute imports, as in vite.config.ts
const src = fileURLToPath(new URL('../../src', import.meta.url));

export default {
  input: 'training/bridge/bridge.ts',
  platform: 'node',
  resolve: {
    alias: {
      Components: `${src}/Components`,
      Game: `${src}/Game`,
      Settings: `${src}/Settings`,
      Tutorial: `${src}/Tutorial`,
      Utils: `${src}/Utils`
    }
  },
  output: { format: 'esm', file: 'training/bridge/dist/bridge.mjs' }
};
