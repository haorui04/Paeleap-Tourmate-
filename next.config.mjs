import { fileURLToPath } from "node:url";

// Anchor Next.js to this project instead of an unrelated lockfile above Downloads.
const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default {
  turbopack: { root: projectRoot },
  outputFileTracingRoot: projectRoot,
  // The bounded document parser is a real Node worker, outside the route bundle.
  outputFileTracingIncludes: {
    '/api/chat': ['./lib/attachments/document-worker.cjs', './node_modules/pdf-lib/**/*',
      './node_modules/@pdf-lib/**/*', './node_modules/pako/**/*', './node_modules/tslib/**/*', './node_modules/fflate/**/*']
  },
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
