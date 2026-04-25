import { api } from './api.js';
import { getEnvString } from './env.js';

globalThis.__rolldown_tsdown_760_imports = [
  import('./lazy.js'),
  import('./env-user.js'),
  import('./dep-user.js'),
];

globalThis.__rolldown_tsdown_760_value = api + Number(getEnvString('MISSING') || 0);
