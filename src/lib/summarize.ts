import { chatCompletion } from "./llm";

/**
 * Tier-3 memory: a short, situational summary of a long conversation.
 * Deliberately EXCLUDES timing windows / predictions (those live verbatim in
 * the prior-window extraction so they can never be contradicted). Runs rarely
 * (every ~10 exchanges on long threads) and is cheap (~150 output tokens).
 */
export async function updateChatSummary(params: {
  existing: string | null;
  recent: { role: string; content: string }[];
  lang: string;
}): Promise<string | null> {
  const { existing, recent, lang } = params;
  try {
    const context = recent
      .slice(-12)
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    const { text } = await chatCompletion({
      messages: [
        {
          role: "system",
          content:
            "You maintain a short, factual memory of an ongoing Vedic astrology chat. Update the existing memory with any NEW facts from the recent exchange. Include: the user's situation, topics discussed, and concrete facts (names, dashas, doshas, placements, family details). Do NOT include timing windows or predictions — those are tracked separately. Keep it under 120 words, concise. Write in " +
            lang +
            " with a natural Hinglish/Maralish mix.",
        },
        {
          role: "user",
          content: `Existing memory (or "none"):\n${existing ?? "none"}\n\nRecent exchange:\n${context}`,
        },
      ],
      maxTokens: 250,
      // Compression task — no hidden reasoning needed.
      reasoningEffort: "none",
    });

    const s = text.trim();
    return s && s.length < 700 ? s : null;
  } catch {
    return null;
  }
}
