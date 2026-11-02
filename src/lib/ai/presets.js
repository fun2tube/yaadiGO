import "server-only";

/**
 * Where the AI actually runs.
 *
 * Every entry except `gemini` speaks the OpenAI chat-completions format, which
 * is why they cost one adapter between them rather than one each. All of the
 * hosted ones below serve OPEN-WEIGHT models (Llama, Qwen, Kimi, Mistral) on a
 * free tier, and `ollama` / `vllm` are the same models self-hosted — so moving
 * from someone else's free tier to your own hardware is a URL change.
 *
 * `model` here is only a default. Model ids on these services are retired and
 * renamed frequently, so AI_MODEL overrides it and a wrong one surfaces as a
 * named 404 rather than a mystery.
 *
 * `strictJson` says whether the endpoint honours response_format json_schema.
 * Where it does not, the adapter falls back to json_object and leans on the
 * schema it puts in the prompt.
 */
export const PRESETS = {
  gemini: {
    kind: "gemini",
    label: "Gemini",
    // Verified working on a free AI Studio key on 2026-09-30, including
    // responseJsonSchema and thinkingConfig, which the planner both need.
    //
    // The previous value, gemini-3.8-flash, is not served on the free tier and
    // — this is the trap — Google answers for it with **503 UNAVAILABLE**, not
    // 404. So a model that will never work looked exactly like a model that
    // was briefly busy, and the planner told every visitor to "try again in a
    // few seconds" indefinitely. Confirm a model is in
    // `GET /v1beta/models` for YOUR key before setting it here; do not assume
    // a higher version number is available. `npm run ai:doctor` does this.
    model: "gemini-3.6-flash",
    keyEnv: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
    signup: "https://aistudio.google.com/apikey",
    openWeight: false,
  },

  groq: {
    kind: "openai",
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
    keyEnv: ["GROQ_API_KEY", "AI_API_KEY"],
    signup: "https://console.groq.com/keys",
    strictJson: true,
    openWeight: true,
  },

  openrouter: {
    kind: "openai",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    // The ":free" suffix is what keeps it free; without it the account is
    // billed. Check openrouter.ai/models?q=free before changing this.
    model: "meta-llama/llama-3.3-70b-instruct:free",
    keyEnv: ["OPENROUTER_API_KEY", "AI_API_KEY"],
    signup: "https://openrouter.ai/keys",
    strictJson: false,
    openWeight: true,
  },

  cerebras: {
    kind: "openai",
    label: "Cerebras",
    baseUrl: "https://api.cerebras.ai/v1",
    model: "llama-3.3-70b",
    keyEnv: ["CEREBRAS_API_KEY", "AI_API_KEY"],
    signup: "https://cloud.cerebras.ai",
    strictJson: true,
    openWeight: true,
  },

  together: {
    kind: "openai",
    label: "Together",
    baseUrl: "https://api.together.xyz/v1",
    model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    keyEnv: ["TOGETHER_API_KEY", "AI_API_KEY"],
    signup: "https://api.together.ai/settings/api-keys",
    strictJson: true,
    openWeight: true,
  },

  mistral: {
    kind: "openai",
    label: "Mistral",
    baseUrl: "https://api.mistral.ai/v1",
    model: "mistral-small-latest",
    keyEnv: ["MISTRAL_API_KEY", "AI_API_KEY"],
    signup: "https://console.mistral.ai/api-keys",
    strictJson: true,
    openWeight: true,
  },

  // Fully self-hosted, no key, no quota, no third party. Needs a machine with
  // real memory and ideally a GPU — not a 8GB ultrabook.
  ollama: {
    kind: "openai",
    label: "Ollama",
    baseUrl: process.env.AI_BASE_URL || "http://localhost:11434/v1",
    model: "qwen2.5:7b",
    keyEnv: ["AI_API_KEY"],
    signup: "https://ollama.com/download",
    strictJson: false,
    openWeight: true,
    selfHosted: true,
  },

  vllm: {
    kind: "openai",
    label: "vLLM",
    baseUrl: process.env.AI_BASE_URL || "http://localhost:8000/v1",
    model: process.env.AI_MODEL || "",
    keyEnv: ["AI_API_KEY"],
    signup: "https://docs.vllm.ai",
    strictJson: true,
    openWeight: true,
    selfHosted: true,
  },
};

export const PRESET_NAMES = Object.keys(PRESETS);

/** Any endpoint not listed above, given a base URL. */
export function customPreset(baseUrl) {
  return {
    kind: "openai",
    label: "Custom endpoint",
    baseUrl,
    model: process.env.AI_MODEL || "",
    keyEnv: ["AI_API_KEY"],
    strictJson: false,
    openWeight: true,
  };
}
