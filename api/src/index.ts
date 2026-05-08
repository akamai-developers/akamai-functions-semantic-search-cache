import { Hono } from "hono";
import { fire } from "hono/service-worker";
import type { Context, Next } from "hono";
import { logger } from "hono/logger";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { openDefault } from "@spinframework/spin-kv";
import { get as getVariable } from "@spinframework/spin-variables";

import { getEmbedding, getChatResponse } from "./embeddings";
import { loadIndex, addEntry, findSimilar, safeGetJson } from "./vector-engine";
import { sanitize } from "./defence";

// ─── Config ──────────────────────────────────────────────────────────────────

const ConfigSchema = z.object({
  ollamaEndpoint: z.string().url(),
  embedModel: z.string().min(1),
  chatModel: z.string().min(1),
  similarityThreshold: z.coerce.number().min(0).max(1),
  maxQueryLength: z.coerce.number().int().min(1).max(2000),
});

type Config = z.infer<typeof ConfigSchema>;

function loadConfig(): Config {
  return ConfigSchema.parse({
    ollamaEndpoint: getVariable("ollama_endpoint"),
    embedModel: getVariable("ollama_embed_model"),
    chatModel: getVariable("ollama_chat_model"),
    similarityThreshold: getVariable("similarity_threshold"),
    maxQueryLength: getVariable("max_query_length"),
  });
}

// ─── KV helpers ───────────────────────────────────────────────────────────────

const EXACT_PREFIX = "exact:";

const CacheEntrySchema = z.object({
  answer: z.string(),
  timestamp: z.number(),
});

type CacheEntry = z.infer<typeof CacheEntrySchema>;

function parseCacheEntry(raw: unknown): CacheEntry | null {
  const result = CacheEntrySchema.safeParse(raw);
  return result.success ? result.data : null;
}

// ─── Router ───────────────────────────────────────────────────────────────────

const app = new Hono();

app.use(logger());
app.use(async (c: Context, next: Next) => {
  c.header("server", "EdgeIntent/1.0");
  await next();
});

// ─── GET /api/search?q=... ────────────────────────────────────────────────────

// Hard ceiling — the configured max_query_length does the precise check inside sanitize().
const searchSchema = z.object({ q: z.string().min(1).max(2000) });

app.get(
  "/api/search",
  zValidator("query", searchSchema),
  async (c: Context) => {
    const start = Date.now();

    let config: Config;
    try {
      config = loadConfig();
    } catch {
      return c.json({ error: "Server misconfiguration." }, 500);
    }

    const { q } = c.req.valid("query" as never) as { q: string };
    const query = sanitize(q, config.maxQueryLength);
    if (!query) {
      return c.json({ error: "Invalid or disallowed query." }, 400);
    }

    const store = openDefault();

    // Step 1 — exact cache
    const exactKey = `${EXACT_PREFIX}${query}`;
    const exactRaw = parseCacheEntry(safeGetJson(store, exactKey));
    if (exactRaw) {
      return c.json({
        answer: exactRaw.answer,
        hitType: "exact",
        latencyMs: Date.now() - start,
      });
    }

    // Step 2 — embed the query
    let queryVector: number[];
    try {
      queryVector = await getEmbedding(
        query,
        config.ollamaEndpoint,
        config.embedModel,
      );
    } catch (err) {
      return c.json(
        { error: `Embedding failed: ${(err as Error).message}` },
        502,
      );
    }

    // Step 3 — semantic search
    const index = loadIndex(store);
    const hit = findSimilar(queryVector, index, config.similarityThreshold);
    if (hit) {
      store.setJson(exactKey, {
        answer: hit.entry.answer,
        timestamp: Date.now(),
      } satisfies CacheEntry);
      return c.json({
        answer: hit.entry.answer,
        hitType: "semantic",
        similarity: hit.score,
        latencyMs: Date.now() - start,
      });
    }

    // Step 4 — full generation
    let answer: string;
    try {
      answer = await getChatResponse(
        query,
        config.ollamaEndpoint,
        config.chatModel,
      );
    } catch (err) {
      return c.json(
        { error: `Generation failed: ${(err as Error).message}` },
        502,
      );
    }

    const timestamp = Date.now();
    store.setJson(exactKey, { answer, timestamp } satisfies CacheEntry);
    addEntry(store, index, { query, vector: queryVector, answer, timestamp });

    return c.json({
      answer,
      hitType: "miss",
      latencyMs: Date.now() - start,
    });
  },
);

// ─── GET /api/cache ───────────────────────────────────────────────────────────

app.get("/api/cache", (c: Context) => {
  let config: Config;
  try {
    config = loadConfig();
  } catch {
    return c.json({ error: "Server misconfiguration." }, 500);
  }

  const store = openDefault();
  const keys = store.getKeys().filter((k) => k.startsWith(EXACT_PREFIX));

  const entries = keys.map((key) => {
    const raw = parseCacheEntry(safeGetJson(store, key));
    return {
      query: key.slice(EXACT_PREFIX.length),
      timestamp: raw?.timestamp ?? 0,
    };
  });

  const index = loadIndex(store);

  return c.json({
    exactCacheSize: entries.length,
    vectorIndexSize: index.entries.length,
    similarityThreshold: config.similarityThreshold,
    maxQueryLength: config.maxQueryLength,
    entries,
  });
});

// ─── DELETE /api/cache ────────────────────────────────────────────────────────

app.delete("/api/cache", (c: Context) => {
  const store = openDefault();

  const exactKeys = store.getKeys().filter((k) => k.startsWith(EXACT_PREFIX));
  for (const key of exactKeys) store.delete(key);

  store.delete("vector_index");

  return c.json({ deleted: exactKeys.length + 1 });
});

fire(app);
