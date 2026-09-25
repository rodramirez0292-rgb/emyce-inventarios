import type { NextConfig } from "next";
const config: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  ...(process.env.NODE_ENV === "development"
    ? {
        async rewrites() {
          return [
            {
              source: "/((?!_next|favicon|manifest|sw.js|icons|api).*)",
              destination: "/",
            },
          ];
        },
      }
    : {}),
};
export default config;
