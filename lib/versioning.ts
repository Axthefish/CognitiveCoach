import type { UserContext } from './store';

export interface Snapshot {
  id: string;
  timestamp: string; // ISO
  state: UserContext;
}

export function createSnapshot(userContext: UserContext): Snapshot {
  const timestamp = new Date().toISOString();
  const id = `v-${timestamp}-${Math.random().toString(36).slice(2, 8)}`;
  // Deep clone to decouple future mutations
  const state: UserContext = JSON.parse(JSON.stringify(userContext));
  return { id, timestamp, state };
}

export function diffSnapshots(a: Snapshot, b: Snapshot): {
  added: string[];
  changed: string[];
  removed: string[];
} {
  const aJson = JSON.stringify(a.state);
  const bJson = JSON.stringify(b.state);
  if (aJson === bJson) return { added: [], changed: [], removed: [] };

  // naive JSON-path difference (shallow keys)
  const aFlat = flatten(a.state);
  const bFlat = flatten(b.state);
  const aKeys = new Set(Object.keys(aFlat));
  const bKeys = new Set(Object.keys(bFlat));
  const added: string[] = [...bKeys].filter(k => !aKeys.has(k));
  const removed: string[] = [...aKeys].filter(k => !bKeys.has(k));
  const common = [...aKeys].filter(k => bKeys.has(k));
  const changed: string[] = common.filter(k => aFlat[k] !== bFlat[k]);
  return { added, changed, removed };
}

function flatten(obj: unknown, prefix = ''): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === 'object') {
        Object.assign(out, flatten(v, key));
      } else {
        out[key] = v;
      }
    }
  }
  return out;
}


