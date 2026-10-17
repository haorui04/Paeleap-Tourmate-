import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { CHINA_TOURISM_FAQS } from "../../data/china-tourism-faq.js";
import { hasConfiguredValue } from "../config.js";

export function validateFaqBank(records) {
  if (!Array.isArray(records) || records.length !== 100) throw new Error("FAQ bank must contain exactly 100 records");
  const ids = new Set();
  const questions = new Set();
  for (const row of records) {
    if (!row || !/^CN\d{3}$/.test(row.id) || ids.has(row.id)) throw new Error("Invalid or duplicate FAQ ID");
    ids.add(row.id);
    for (const field of ["category", "question_en", "question_zh", "answer_en", "answer_zh"]) {
      if (typeof row[field] !== "string" || !row[field].trim() || row[field].length > 3000) throw new Error("Invalid FAQ text");
    }
    for (const key of ["question_en", "question_zh"]) {
      if (questions.has(row[key])) throw new Error("Duplicate FAQ question");
      questions.add(row[key]);
    }
    if (!Array.isArray(row.aliases) || row.aliases.some((v) => typeof v !== "string" || v.length > 500)) throw new Error("Invalid FAQ aliases");
    if (!Array.isArray(row.sources) || row.sources.some((s) => !s || typeof s.name !== "string" || !/^https:\/\//.test(s.url))) throw new Error("Invalid FAQ sources");
  }
  for (let i = 1; i <= 100; i++) if (!ids.has(`CN${String(i).padStart(3, "0")}`)) throw new Error("Missing FAQ ID");
  return records;
}

export function readLocalFaqBank(databasePath = resolve(process.cwd(), ".paeleap", "faq.sqlite")) {
  validateFaqBank(CHINA_TOURISM_FAQS);
  mkdirSync(dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  try {
    db.exec("PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS faq_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS tourism_faq (id TEXT PRIMARY KEY, payload TEXT NOT NULL);");
    const fingerprint = createHash("sha256").update(JSON.stringify(CHINA_TOURISM_FAQS)).digest("hex");
    // The editable seed is authoritative. Resync atomically when it changes.
    db.exec("BEGIN IMMEDIATE");
    try {
      const version = db.prepare("SELECT value FROM faq_meta WHERE key = 'seed_hash'").get()?.value;
      if (version !== fingerprint || db.prepare("SELECT COUNT(*) AS count FROM tourism_faq").get().count !== 100) {
        db.exec("DELETE FROM tourism_faq");
        const insert = db.prepare("INSERT INTO tourism_faq (id, payload) VALUES (?, ?)");
        for (const faq of CHINA_TOURISM_FAQS) insert.run(faq.id, JSON.stringify(faq));
        db.prepare("INSERT OR REPLACE INTO faq_meta (key, value) VALUES ('seed_hash', ?)").run(fingerprint);
      }
      db.exec("COMMIT");
    } catch (error) { db.exec("ROLLBACK"); throw error; }
    return validateFaqBank(db.prepare("SELECT payload FROM tourism_faq ORDER BY id").all().map((row) => JSON.parse(row.payload)));
  } finally { db.close(); }
}

export async function getFaqBank() {
  const source = process.env.FAQ_BANK_SOURCE || (process.env.NODE_ENV === "production" ? "supabase" : "local");
  if (process.env.NODE_ENV === "production" && source !== "supabase") throw new Error("FAQ database not configured: production requires Supabase");
  if (source === "local") return readLocalFaqBank();
  if (source !== "supabase") throw new Error("FAQ_BANK_SOURCE must be local or supabase");
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (![SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY].every(hasConfiguredValue)) throw new Error("FAQ database not configured");
  const url = new URL(SUPABASE_URL);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) throw new Error("Invalid FAQ database URL");
  url.pathname = "/rest/v1/tourism_faq";
  url.search = "?select=id,category,question_en,question_zh,answer_en,answer_zh,aliases,sources&order=id.asc&limit=101";
  const response = await fetch(url, {
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
    cache: "no-store", signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error("FAQ database unavailable");
  return validateFaqBank(await response.json());
}
