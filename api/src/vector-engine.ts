import { type Store } from '@spinframework/spin-kv';
import similarity from 'compute-cosine-similarity';
import { z } from 'zod';

const INDEX_KEY = 'vector_index';

export interface VectorEntry {
  query: string;
  vector: number[];
  answer: string;
  timestamp: number;
}

export interface VectorIndex {
  entries: VectorEntry[];
}

export interface SearchResult {
  entry: VectorEntry;
  score: number;
}

const VectorEntrySchema = z.object({
  query: z.string(),
  vector: z.array(z.number()),
  answer: z.string(),
  timestamp: z.number(),
});

// store.getJson() calls JSON.parse on the raw bytes, which throws on a missing
// key because the Spin KV wrapper decodes absent keys as an empty string.
export function safeGetJson(store: Store, key: string): unknown {
  return store.exists(key) ? store.getJson(key) : null;
}

export function loadIndex(store: Store): VectorIndex {
  const raw = safeGetJson(store, INDEX_KEY);
  if (!raw || !Array.isArray((raw as Record<string, unknown>).entries)) return { entries: [] };
  const entries = (raw.entries as unknown[]).flatMap((e) => {
    const result = VectorEntrySchema.safeParse(e);
    return result.success ? [result.data] : [];
  });
  return { entries };
}

export function saveIndex(store: Store, index: VectorIndex): void {
  store.setJson(INDEX_KEY, index);
}

export function findSimilar(
  queryVector: number[],
  index: VectorIndex,
  threshold: number,
): SearchResult | null {
  let best: SearchResult | null = null;

  for (const entry of index.entries) {
    const score = similarity(queryVector, entry.vector) ?? 0;
    if (score >= threshold && (!best || score > best.score)) {
      best = { entry, score };
    }
  }

  return best;
}

export function addEntry(
  store: Store,
  index: VectorIndex,
  entry: VectorEntry,
): VectorIndex {
  const updated: VectorIndex = { entries: [...index.entries, entry] };
  saveIndex(store, updated);
  return updated;
}
