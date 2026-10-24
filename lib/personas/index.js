import { readFile } from "node:fs/promises";
import { hasConfiguredValue } from "../config.js";
import { MAX_PERSONA_BYTES, MAX_STORED_PERSONA_BYTES, PERSONA_ID_PATTERN, PersonaError, publicPersona, validatePersonaPackage } from "./validation.js";

export { MAX_PERSONA_BYTES, PersonaError, publicPersona, validatePersonaPackage, personaKnowledge } from "./validation.js";
export const DEFAULT_PERSONA_ID = "tourmate";

const defaultPersona = validatePersonaPackage({
  id: DEFAULT_PERSONA_ID, version: 1,
  name: { en: "TourMate", zh: "旅伴" }, venue: { en: "China tourism", zh: "中国旅游" },
  role: { en: "A professional bilingual China-tourism companion providing evidence-based visitor guidance.",
    zh: "提供有据可查的游客指引的专业中英双语中国旅游伙伴。" },
  tone: "professional", greeting: { en: "Hello, I’m TourMate. How can I help with your travels in China?",
    zh: "您好，我是旅伴。有什么中国旅游相关的问题需要帮助？" },
  scope: ["Tourism in China", "中国旅游"], knowledge: []
}, { allowEmptyKnowledge: true });

function config(env) {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env;
  if (![SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY].every(hasConfiguredValue)) {
    throw new PersonaError("Persona storage is not configured", 503, "persona_storage_unavailable");
  }
  let url;
  try { url = new URL(SUPABASE_URL); } catch { throw new PersonaError("Invalid persona storage configuration", 503); }
  if (url.username || url.password || (url.protocol !== "https:" &&
      !(env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) {
    throw new PersonaError("Invalid persona storage configuration", 503);
  }
  return { origin: url.origin, key: SUPABASE_SERVICE_ROLE_KEY };
}

function hasStorage(env) {
  return [env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY].every(hasConfiguredValue);
}

function disabledPersonaIds(env) {
  const raw = env.PERSONA_DISABLED_IDS;
  if (raw === undefined || raw === null || raw === "" || (typeof raw === "string" && !raw.trim())) return new Set();
  if (typeof raw !== "string" || raw.length > 6500) {
    throw new PersonaError("Invalid persona incident-control configuration", 503, "persona_control_unconfigured");
  }
  const ids = raw.split(",").map((id) => id.trim());
  if (ids.length > 100 || ids.some((id) => !PERSONA_ID_PATTERN.test(id))) {
    throw new PersonaError("Invalid persona incident-control configuration", 503, "persona_control_unconfigured");
  }
  return new Set(ids);
}

async function rest(path, env, body) {
  const { origin, key } = config(env);
  const response = await fetch(`${origin}/rest/v1/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000), cache: "no-store"
  });
  if (!response.ok) {
    // Do not expose Postgres statements, stored content or service-role credentials.
    if (response.status === 409) throw new PersonaError("Persona version conflict; reload the latest version", 409, "persona_version_conflict");
    throw new PersonaError("Persona storage unavailable; check the migration and server configuration", 503, "persona_storage_unavailable");
  }
  // Read an actively bounded stream rather than allocating an unbounded text()
  // response first. The admin catalogue can contain up to 100 full packages.
  const limit = path.includes("name:payload") ? 1024 * 1024
    : path.startsWith("persona_profiles_latest") ? MAX_STORED_PERSONA_BYTES * 100 + 32768 : MAX_STORED_PERSONA_BYTES + 32768;
  const reader = response.body?.getReader();
  const chunks = [];
  let size = 0;
  if (reader) {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) { await reader.cancel(); throw new PersonaError("Persona storage response exceeded its limit", 503); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  try { return raw ? JSON.parse(raw) : null; } catch { throw new PersonaError("Invalid persona storage response", 503); }
}

async function example(env) {
  if (env.NODE_ENV === "production" || env.PERSONA_LOAD_EXAMPLES !== "true") return null;
  const raw = await readFile(new URL("../../examples/personas/little-de-rabbit.json", import.meta.url), "utf8");
  if (Buffer.byteLength(raw) > MAX_PERSONA_BYTES) throw new PersonaError("Example persona exceeds its limit", 503);
  return validatePersonaPackage(JSON.parse(raw));
}

export async function resolvePersona(id = DEFAULT_PERSONA_ID, env = process.env, version) {
  // Server-only incident control applies to pinned conversations as well as new
  // requests, before storage/history/model access. A malformed control fails
  // closed rather than silently re-enabling a compromised profile.
  if (disabledPersonaIds(env).has(id)) return null;
  if (typeof id !== "string" || !PERSONA_ID_PATTERN.test(id)) return null;
  if (version !== undefined && (!Number.isSafeInteger(version) || version < 1)) return null;
  if (id === DEFAULT_PERSONA_ID) return version === undefined || version === 1 ? defaultPersona : null;
  if (hasStorage(env)) {
    const rows = await rest(`persona_packages?select=payload&persona_id=eq.${encodeURIComponent(id)}` +
      (version === undefined ? "&order=version.desc&limit=1" : `&version=eq.${version}&limit=1`), env);
    if (!Array.isArray(rows) || rows.length > 1) throw new PersonaError("Invalid persona storage response", 503);
    if (rows.length) {
      const profile = validatePersonaPackage(rows[0].payload);
      if (profile.id !== id || (version !== undefined && profile.version !== version)) throw new PersonaError("Persona storage identity mismatch", 503);
      return profile;
    }
  } else if (env.NODE_ENV === "production") {
    throw new PersonaError("Persona storage is not configured", 503, "persona_storage_unavailable");
  }
  const sample = await example(env);
  return sample?.id === id && (version === undefined || version === sample.version) ? sample : null;
}

export async function listPersonas(env = process.env) {
  const profiles = [defaultPersona];
  if (hasStorage(env)) {
    const rows = await rest("persona_profiles_latest?select=payload&order=persona_id.asc&limit=101", env);
    if (!Array.isArray(rows) || rows.length > 100) throw new PersonaError("Persona catalogue limit exceeded", 503);
    for (const row of rows) {
      const profile = validatePersonaPackage(row.payload);
      if (profile.id === DEFAULT_PERSONA_ID || profiles.some((other) => other.id === profile.id)) throw new PersonaError("Duplicate stored persona", 503);
      profiles.push(profile);
    }
  }
  const sample = await example(env);
  if (sample && !profiles.some((profile) => profile.id === sample.id)) profiles.push(sample);
  return profiles;
}

export async function listPublicPersonas(env = process.env) {
  const disabled = disabledPersonaIds(env);
  const profiles = disabled.has(DEFAULT_PERSONA_ID) ? [] : [publicPersona(defaultPersona)];
  if (hasStorage(env)) {
    // Do not load all private knowledge merely to render a public selector.
    const rows = await rest("persona_profiles_latest?select=persona_id,version,name:payload->name,venue:payload->venue,greeting:payload->greeting,tone:payload->>tone&order=persona_id.asc&limit=101", env);
    if (!Array.isArray(rows) || rows.length > 100) throw new PersonaError("Persona catalogue limit exceeded", 503);
    for (const row of rows) {
      if (disabled.has(row?.persona_id)) continue;
      const profile = validatePersonaPackage({ id: row.persona_id, version: row.version,
        name: row.name, venue: row.venue, greeting: row.greeting, tone: row.tone,
        role: { en: "Public metadata", zh: "公开资料" }, scope: ["Public metadata"], knowledge: [] }, { allowEmptyKnowledge: true });
      if (profile.id === DEFAULT_PERSONA_ID || profiles.some((other) => other.id === profile.id)) throw new PersonaError("Duplicate stored persona", 503);
      profiles.push(publicPersona(profile));
    }
  }
  const sample = disabled.has("little-de-rabbit") ? null : await example(env);
  if (sample && !profiles.some((profile) => profile.id === sample.id)) profiles.push(publicPersona(sample));
  return profiles;
}

export async function publishPersona(input, actorId, env = process.env) {
  const profile = validatePersonaPackage(input);
  if (profile.id === DEFAULT_PERSONA_ID) throw new PersonaError("The platform default persona cannot be overwritten", 409, "reserved_persona");
  if (!adminIds(env).has(actorId)) throw new PersonaError("Administrator access required", 403, "admin_required");
  const result = await rest("rpc/publish_persona_package", env, {
    p_package: profile, p_expected_previous_version: profile.version - 1, p_actor_id: actorId
  });
  const stored = validatePersonaPackage(result);
  if (stored.id !== profile.id || stored.version !== profile.version) throw new PersonaError("Persona publication verification failed", 503);
  return stored;
}

function adminIds(env) {
  const entries = (env.PERSONA_ADMIN_USER_IDS || "").split(",").map((id) => id.trim()).filter(Boolean);
  if (entries.length > 100 || entries.some((id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) return new Set();
  return new Set(entries.map((id) => id.toLowerCase()));
}

export async function authorizePersonaAdmin(request, env = process.env) {
  const allowed = adminIds(env);
  if (!allowed.size) throw new PersonaError("Persona administration is disabled until an administrator is configured", 503, "admin_unconfigured");
  const match = /^Bearer ([^\s]{1,8192})$/.exec(request.headers.get("Authorization") || "");
  if (!match) throw new PersonaError("Sign in as a persona administrator", 401, "authentication_required");
  const { origin } = config(env);
  if (!hasConfiguredValue(env.SUPABASE_PUBLISHABLE_KEY)) throw new PersonaError("Authentication is not configured", 503);
  const response = await fetch(`${origin}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${match[1]}` },
    cache: "no-store", signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new PersonaError("Sign in again to administer personas", 401, "authentication_required");
  const user = await response.json();
  if (!user || typeof user.id !== "string" || !allowed.has(user.id.toLowerCase())) {
    throw new PersonaError("Administrator access required", 403, "admin_required");
  }
  // Authorization is based ONLY on the verified ID, never user_metadata, request JSON or a claimed role.
  return { id: user.id.toLowerCase() };
}

export async function readPersonaRequest(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("Content-Type") || "")) throw new PersonaError("Use application/json", 415);
  const announced = request.headers.get("Content-Length");
  if (announced && (!/^\d+$/.test(announced) || Number(announced) > MAX_PERSONA_BYTES)) throw new PersonaError("Persona package exceeds 2 MB", 413);
  if (!request.body) throw new PersonaError("A persona package is required");
  const reader = request.body.getReader();
  let size = 0;
  const chunks = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_PERSONA_BYTES) { await reader.cancel(); throw new PersonaError("Persona package exceeds 2 MB", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks))); }
  catch { throw new PersonaError("The upload must be a valid UTF-8 JSON file"); }
}

export function personaErrorResponse(error) {
  const known = error instanceof PersonaError;
  return Response.json({ error: { code: known ? error.code : "persona_unavailable",
    message: known ? error.message : "Persona service unavailable" } },
  { status: known ? error.status : 503, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
