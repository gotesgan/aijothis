import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Skip API routes, the admin control center, Next internals and static files
  matcher: ["/((?!api|admin|_next|.*\\..*).*)"],
};
