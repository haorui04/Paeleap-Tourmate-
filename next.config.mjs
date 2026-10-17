import { fileURLToPath } from "node:url";

// Anchor Next.js to this project instead of an unrelated lockfile above Downloads.
const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default {
  turbopack: { root: projectRoot },
  outputFileTracingRoot: projectRoot,
  devIndicators: false,
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "X-Frame-Options", value: "DENY" }
    ] }];
  }
};
