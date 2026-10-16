import { fileURLToPath } from "node:url";

// Anchor Next.js to this project instead of an unrelated lockfile above Downloads.
const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default {
  turbopack: { root: projectRoot },
  outputFileTracingRoot: projectRoot,
  devIndicators: false
};
