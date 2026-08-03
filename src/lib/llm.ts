export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmUsage {
  promptTokens: number;
  cachedTokens: number;
  completionTokens: number;
  reasoningTokens: number;
  totalTokens: number;
}

/**
 * Minimal OpenAI-compatible chat completion streamer.
 * Works with DeepSeek, Groq, OpenAI, Together, etc. via env config.
 */
export async function streamChatCompletion(params: {
  messages: LlmMessage[];
  onToken: (token: string) => void;
  onUsage?: (usage: LlmUsage) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const { messages, onToken, onUsage, signal } = params;

  const baseUrl = process.env.LLM_BASE_URL ?? "https://api.groq.com/openai/v1";
  const apiKey = process.env.LLM_API_KEY ?? "";
  const model = process.env.LLM_MODEL ?? "llama-3.3-70b-versatile";
  const maxTokens = Number(process.env.LLM_MAX_TOKENS ?? 4096);
  const reasoningEffort = process.env.LLM_REASONING_EFFORT;

  if (!apiKey) {
    // Friendly fallback so the app never hard-fails during local testing
    // without keys. Remove once keys are configured.
    const placeholder =
      "Namaste 🙏 (Add LLM_API_KEY to .env.local to enable Arya's live replies.)";
    onToken(placeholder);
    return;
  }

  const body: Record<string, unknown> = {
    model,
    messages,
    stream: true,
    temperature: 0.7,
    max_tokens: maxTokens,
  };
  if (reasoningEffort) {
    // DeepSeek v4 flash: "low" cuts hidden reasoning tokens (~40%) —
    // the single biggest cost lever for reasoning models.
    body.reasoning_effort = reasoningEffort;
  }
  try {
    // Ask providers to include a final usage chunk so we can log cost.
    body.stream_options = { include_usage: true };
  } catch {
    // ignore
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`LLM request failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const json = JSON.parse(payload);
        const delta = json?.choices?.[0]?.delta?.content;
        // `reasoning_content` (reasoning models) is intentionally skipped —
        // only the final answer is streamed to the user.
        if (delta) onToken(delta);

        if (onUsage && json?.usage) {
          const details = json.usage.completion_tokens_details ?? {};
          const promptDetails = json.usage.prompt_tokens_details ?? {};
          onUsage({
            promptTokens: json.usage.prompt_tokens ?? 0,
            cachedTokens:
              promptDetails.cached_tokens ?? json.usage.prompt_cache_hit_tokens ?? 0,
            completionTokens: json.usage.completion_tokens ?? 0,
            reasoningTokens: details.reasoning_tokens ?? 0,
            totalTokens: json.usage.total_tokens ?? 0,
          });
        }
      } catch {
        // ignore malformed chunks
      }
    }
  }
}

/** Non-streaming completion — used by the reflection node. */
export async function chatCompletion(params: {
  messages: LlmMessage[];
  maxTokens?: number;
  signal?: AbortSignal;
}): Promise<{ text: string; usage?: LlmUsage }> {
  const baseUrl = process.env.LLM_BASE_URL ?? "https://api.groq.com/openai/v1";
  const apiKey = process.env.LLM_API_KEY ?? "";
  const model = process.env.LLM_MODEL ?? "llama-3.3-70b-versatile";
  const maxTokens = params.maxTokens ?? Number(process.env.LLM_MAX_TOKENS ?? 4096);
  const reasoningEffort = process.env.LLM_REASONING_EFFORT;

  if (!apiKey) return { text: "" };

  const body: Record<string, unknown> = {
    model,
    messages: params.messages,
    stream: false,
    max_tokens: maxTokens,
  };
  if (reasoningEffort) body.reasoning_effort = reasoningEffort;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: params.signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LLM request failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const json = await res.json();
  const details = json?.usage?.completion_tokens_details ?? {};
  const promptDetails = json?.usage?.prompt_tokens_details ?? {};
  return {
    text: json?.choices?.[0]?.message?.content ?? "",
    usage: json?.usage
      ? {
          promptTokens: json.usage.prompt_tokens ?? 0,
          cachedTokens:
            promptDetails.cached_tokens ?? json.usage.prompt_cache_hit_tokens ?? 0,
          completionTokens: json.usage.completion_tokens ?? 0,
          reasoningTokens: details.reasoning_tokens ?? 0,
          totalTokens: json.usage.total_tokens ?? 0,
        }
      : undefined,
  };
}
