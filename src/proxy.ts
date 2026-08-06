import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const handle = createMiddleware(routing);

// A clean, crawler-friendly page served at the bare domain root (/), with no
// locale redirect and no JavaScript, so Google's OAuth branding review can read
// the app name and purpose directly. Real users land here only if they type the
// bare domain — the link takes them into the app.
const ROOT_PAGE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Jyotish</title>
    <meta
      name="description"
      content="Jyotish is an AI Vedic astrology app. Share your birth details and chat with Arya for personal answers on love, marriage, career, money and health — grounded in your real Kundli, never generic predictions."
    />
    <meta name="application-name" content="Jyotish" />
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #0e0b1a;
        color: #f4ead6;
        display: grid;
        place-items: center;
        min-height: 100vh;
        margin: 0;
        text-align: center;
        padding: 24px;
      }
      h1 {
        font-size: 2.4rem;
        margin: 0 0 6px;
        color: #e8b64c;
        letter-spacing: 0.1em;
      }
      p {
        max-width: 42ch;
        line-height: 1.6;
        margin: 0 auto 18px;
        color: #cbbf9f;
      }
      a {
        display: inline-block;
        background: #e8b64c;
        color: #0e0b1a;
        font-weight: 700;
        text-decoration: none;
        padding: 12px 22px;
        border-radius: 999px;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Jyotish</h1>
      <p>
        Jyotish is an AI Vedic astrology app. Share your birth details and chat
        with Arya for personal answers on love, marriage, career, money and
        health — grounded in your real Kundli, never generic predictions.
      </p>
      <a href="/en">Open Jyotish</a>
    </main>
  </body>
</html>`;

export default function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/") {
    return new NextResponse(ROOT_PAGE, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
  return handle(request);
}

export const config = {
  // Skip API routes, Next internals and static files
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
