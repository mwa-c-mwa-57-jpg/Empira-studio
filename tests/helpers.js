import { readFileSync } from 'node:fs';

export function loadConfig(overrides = {}) {
  const cfg = JSON.parse(readFileSync(new URL('../config/default.json', import.meta.url)));
  return { ...cfg, ...overrides };
}

let n = 0;
export const ev = (type, userId, extra = {}) => ({ id: `t-${++n}`, type, source: 'test', user: { id: userId, name: userId }, ...extra });
