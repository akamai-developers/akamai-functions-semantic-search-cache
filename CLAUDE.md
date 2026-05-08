# Project: EdgeIntent (Semantic Search Cache)

## 🎯 Vision
A high-performance "Semantic Search Cache" built on Akamai Functions (Spin + Wasm). 
The goal is to intercept user queries at the edge, check for "semantically similar" 
previously answered questions using embeddings, and serve cached responses to 
save GPU cycles and reduce latency.

## 🛠️ Stack & Architecture
- **Runtime:** Spin (WebAssembly) — https://spinframework.dev
- **Frontend:** Astro (located in `/frontend`, mapped to `/...`)
- **API:** TypeScript + Hono (located in `/api`, mapped to `/api/...`)
- **Intelligence:** Ollama (running `nomic-embed-text` and a chat model like `llama3`)
- **State:** Spin KV Store (used for exact-match caching and vector-index persistence)

## 📁 File Structure
- `/api/src/index.ts`: Hono router and API logic.
- `/api/src/embeddings.ts`: Logic for calling Ollama and calculating vector similarity.
- `/frontend/src/...`: Astro components and logic.
- `spin.toml`: Root configuration defining components and outbound hosts.

## 🧠 Core Architecture Logic
1. **The Request:** Frontend hits `GET /api/search?q=...`.
2. **Step 1 (Exact Cache):** Check Spin KV for an exact string match.
3. **Step 2 (Semantic Check):** Use `ollama.embed()` to get a vector for the query.
4. **Step 3 (Vector Math):** Compare the vector against a local index (stored in KV) using `compute-cosine-similarity`.
5. **Step 4 (Branching):**
   - **HIT (Similarity > 0.85):** Return the cached JSON answer instantly.
   - **MISS:** Call `ollama.chat()`, store the new answer and its vector in KV, then return.

## 🛡️ Guardrails & Safety
- **Strict Typing:** Use `Zod` for all request/response validation.
- **Prompt Injection:** Sanitize inputs to ensure users cannot "jailbreak" 
  the underlying Ollama instance via the API.
- **Outbound Restrictions:** Ensure `spin.toml` only allows traffic to the 
  dedicated GPU IP and the KV store.

## 📝 Coding Instructions for Claude
- Use the `@spinframework/spin-kv` for KV.
- Use the `fetch` API for outbound HTTP from API to Ollama
- Use the `@spinframework/spin-variables` for loading configuration data
- Ensure configuration is defined as Spin Variables and loaded + validated for incoming requests
- Use `hono` for routing within the `/api` component.
- Prioritize functional, clean TypeScript.
- When generating UI, use **Tailwind CSS** and ensure the Astro frontend 
  interacts with the API asynchronously (hydration).
- Implement a "Latency Toggle" in the UI to show the difference between 
  an Edge-Cache hit (~5ms) and a full GPU generation (~2000ms).
