/** Client-side Turnstile helpers (SPA forms). */

export const TURNSTILE_SITEKEY = process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY ?? "";

interface TurnstileWindow {
  turnstile?: {
    getResponse?: (el?: HTMLElement) => string;
    reset?: (el?: HTMLElement) => void;
  };
}

/** Reads the token for the widget rendered on the current page/form. */
export function getTurnstileToken(): string {
  try {
    const w = window as unknown as TurnstileWindow;
    if (!w.turnstile?.getResponse) return "";
    const el = document.querySelector<HTMLElement>(".cf-turnstile");
    return el ? w.turnstile.getResponse(el) : w.turnstile.getResponse();
  } catch {
    return "";
  }
}

/** Resets the widget so a retry gets a fresh (single-use) token. */
export function resetTurnstile(): void {
  try {
    const w = window as unknown as TurnstileWindow;
    if (!w.turnstile?.reset) return;
    const el = document.querySelector<HTMLElement>(".cf-turnstile");
    if (el) w.turnstile.reset(el);
    else w.turnstile.reset();
  } catch {
    // ignore
  }
}
