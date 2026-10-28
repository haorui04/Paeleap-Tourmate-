import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { CHINA_TOURISM_FAQS } from "../../data/china-tourism-faq.js";
import { hasConfiguredValue } from "../config.js";
import { FAQ_BANK_SIZE, FAQ_ID_PATTERN } from '../knowledge-config.js';

export function validateFaqBank(records) {
  if (!Array.isArray(records) || records.length !== FAQ_BANK_SIZE) throw new Error(`FAQ bank must contain exactly ${FAQ_BANK_SIZE} records`);
  const ids = new Set();
  const questions = new Set();
  for (const row of records) {
    if (!row || !FAQ_ID_PATTERN.test(row.id) || ids.has(row.id)) throw new Error("Invalid or duplicate FAQ ID");
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
  for (let i = 1; i <= FAQ_BANK_SIZE; i++) if (!ids.has(`CN${String(i).padStart(3, "0")}`)) throw new Error("Missing FAQ ID");
  return [...records].sort((a,b)=>Number(a.id.slice(2))-Number(b.id.slice(2)));
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
      if (version !== fingerprint || db.prepare("SELECT COUNT(*) AS count FROM tourism_faq").get().count !== FAQ_BANK_SIZE) {
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
  url.pathname = "/rest/v1/tourism_faq_v2";
  // Fixed pages avoid PostgREST's default row cap and keep oversized banks visible.
  const records = [];
  for(let offset=0;offset<=FAQ_BANK_SIZE;offset+=500){
   url.search = `?select=id,category,question_en,question_zh,answer_en,answer_zh,aliases,sources,research&order=id.asc&limit=500&offset=${offset}`;
   const response = await fetch(url, {
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000)
  });
   if (!response.ok) throw new Error("FAQ database unavailable");
   if(Number(response.headers.get('content-length'))>4*1024*1024)throw new Error('FAQ database response too large');
   const reader=response.body?.getReader();if(!reader)throw new Error('Invalid FAQ database response');
   const chunks=[];let size=0;
   try{for(;;){const{value,done}=await reader.read();if(done)break;size+=value.length;if(size>4*1024*1024){await reader.cancel();throw new Error('FAQ database response too large');}chunks.push(value);}}finally{reader.releaseLock();}
   const page=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   if(!Array.isArray(page)||page.length>500)throw new Error('Invalid FAQ database page');
   records.push(...page);if(page.length<500)break;
  }
  return validateFaqBank(records);
}
