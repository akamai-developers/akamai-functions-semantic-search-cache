// Two-layer defence: these patterns reject obvious abuse before the query
// ever reaches the model. The hardcoded system prompt in embeddings.ts is the
// second layer for anything that slips through.
const INJECTION_PATTERNS = [
  // Instruction override
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /disregard\s+(all\s+)?(previous|prior|above)/i,
  /your\s+(new\s+)?instructions\s+are/i,
  /override\s+(your\s+)?(previous\s+)?instructions/i,
  // Persona / jailbreak hijack
  /you\s+are\s+now\s+(a|an)\s/i,
  /act\s+as\s+(a|an|if)\s/i,
  /pretend\s+(you\s+are|to\s+be)/i,
  /roleplay\s+as/i,
  /do\s+anything\s+now/i,
  /\bDAN\b/,
  // Model/prompt delimiter tokens used by common LLM formats
  /###\s*(system|instruction)/i,
  /\[INST\]/i,
  /<\|system\|>/i,
  /<\|im_start\|>/i,
  // Code / exploit generation
  /write\s+(me\s+)?(a\s+)?(function|script|program|code|class|exploit|malware|virus)/i,
  /generate\s+(code|a?\s*script|a?\s*program|a?\s*exploit)/i,
  /create\s+(a\s+)?(script|program|exploit|malware|virus|ransomware)/i,
  // Hate speech solicitation
  /write\s+(hate|racist|sexist|homophobic|transphobic)/i,
  /generate\s+(hate|slurs?|harassment)/i,
];

export function sanitize(q: string, maxLength: number): string | null {
  const trimmed = q.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) return null;
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(trimmed)) return null;
  }
  return trimmed;
}
