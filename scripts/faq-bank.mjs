import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { readLocalFaqBank } from "../lib/db/faq.js";
const records = readLocalFaqBank();
console.log(`FAQ database ready: ${records.length} bilingual questions at .paeleap/faq.sqlite`);
if (process.argv.includes("--export")) {
  const literal = (value) => "'" + String(value).replaceAll("'", "''") + "'";
  const rows = records.map((row) => "(" + [row.id, row.category, row.question_en, row.question_zh, row.answer_en, row.answer_zh, JSON.stringify(row.aliases), JSON.stringify(row.sources), JSON.stringify(row.research || {})].map(literal).join(",") + ")");
  const sql = "-- Apply knowledge-schema.sql first. Versioned bank; legacy tourism_faq is retained.\nBEGIN;\nINSERT INTO public.tourism_faq_v2 (id,category,question_en,question_zh,answer_en,answer_zh,aliases,sources,research) VALUES\n" + rows.join(",\n") + "\nON CONFLICT (id) DO UPDATE SET category=excluded.category,question_en=excluded.question_en,question_zh=excluded.question_zh,answer_en=excluded.answer_en,answer_zh=excluded.answer_zh,aliases=excluded.aliases,sources=excluded.sources,research=excluded.research;\nCOMMIT;\n";
  const target = resolve("supabase", "faq-seed-v2.sql");
  writeFileSync(target, sql, "utf8");
  console.log("Exported Supabase SQL import: " + target);
}
