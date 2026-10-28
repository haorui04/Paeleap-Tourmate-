import { writeFile } from "node:fs/promises";
import { DESHOU_PERSONA } from "../data/personas/deshou-palace.js";
import { validatePersonaPackage } from "../lib/personas/validation.js";

const profile = validatePersonaPackage(DESHOU_PERSONA);
const target = process.argv[2];
if (target) await writeFile(target, JSON.stringify(profile, null, 2) + "\n", { encoding: "utf8", flag: "wx" });
console.log(JSON.stringify({ profile: profile.id, version: profile.version, records: profile.knowledge.length,
  sourceUrls: new Set(profile.knowledge.flatMap(record => record.sources.map(source => source.url))).size,
  ...(target ? { exported: target } : {}) }));
