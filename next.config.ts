import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  serverExternalPackages: ["swisseph-wasm"],
  turbopack: {
    root: __dirname,
  },
};

export default withNextIntl(nextConfig);
