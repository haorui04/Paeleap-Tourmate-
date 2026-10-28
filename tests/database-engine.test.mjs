import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

// These are actual PostgreSQL SQL/PLpgSQL/RLS checks, not fetch mocks or regex
// checks. PGlite is an embedded, single-connection WASM PostgreSQL engine. It
// cannot prove Supabase JWT handling, deployed grants, networking, or concurrency
// across separate backend sessions. Those remain staging release gates.
const USERS = {
  a: "10000000-0000-4000-8000-000000000001",
  b: "10000000-0000-4000-8000-000000000002",
  quota: "10000000-0000-4000-8000-000000000003"
};
const CONVERSATIONS = {
  a: "20000000-0000-4000-8000-000000000001",
  b: "20000000-0000-4000-8000-000000000002",
  builtin: "20000000-0000-4000-8000-000000000003"
};
const MIGRATIONS = ["schema.sql", "faq-schema.sql", "personas-schema.sql", "conversation-personas.sql", "quota-hardening.sql", "knowledge-schema.sql"];
const sample = JSON.parse(await readFile(new URL("../examples/personas/little-de-rabbit.json", import.meta.url), "utf8"));

test("embedded PostgreSQL migration, privilege, RLS, publication, exchange and quota checks", async (t) => {
  const db = await PGlite.create();
  t.after(() => db.close());
  const query = (sql, params = []) => db.query(sql, params);
  const scalar = async (sql, params = []) => Object.values((await query(sql, params)).rows[0])[0];
  const denied = (run, code = "42501") => assert.rejects(run, (error) => {
    assert.equal(error.code, code, `Expected PostgreSQL SQLSTATE ${code}, got ${error.code}: ${error.message}`);
    return true;
  });
  async function fixedTransactionTime(run) {
    // PostgreSQL now() is stable within one transaction, keeping quota boundary
    // checks deterministic even if the test starts at a minute/day rollover.
    await db.exec("begin");
    try {
      const result = await run();
      await db.exec("commit");
      return result;
    } catch (error) {
      await db.exec("rollback");
      throw error;
    }
  }
  async function asRole(role, userId, run) {
    assert.ok(["anon", "authenticated", "service_role"].includes(role));
    await db.exec("reset role");
    await query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? ""]);
    await db.exec(`set role ${role}`);
    try {
      assert.equal(await scalar("select current_user"), role);
      return await run();
    } finally {
      await db.exec("reset role");
      await query("select set_config('request.jwt.claim.sub', '', false)");
    }
  }
  const service = (run) => asRole("service_role", undefined, run);
  const publish = (profile, previous = profile.version - 1, actor = USERS.a) => service(() => scalar(
    "select public.publish_persona_package($1::jsonb, $2::integer, $3::uuid)",
    [JSON.stringify(profile), previous, actor]
  ));
  const store = (overrides = {}) => {
    const values = {
      userId: USERS.a, conversationId: CONVERSATIONS.a, personaId: sample.id, version: 1,
      userMessage: "Who are you?", assistantMessage: sample.knowledge[0].answer_en, ...overrides
    };
    return service(() => scalar("select public.store_persona_exchange($1::uuid, $2::uuid, $3::text, $4::integer, $5::text, $6::text)",
      [values.userId, values.conversationId, values.personaId, values.version, values.userMessage, values.assistantMessage]));
  };
  const messageCount = (id = CONVERSATIONS.a) => scalar("select count(*)::integer from public.messages where conversation_id = $1::uuid", [id]);

  await t.test("apply all six repository SQL migrations verbatim to a real SQL engine", async () => {
    // Explicitly emulate managed Supabase prerequisites, not application fixes:
    // auth users/auth.uid(), API roles, public schema usage, and the standard
    // service_role table default ACL. JWT validation itself is NOT simulated.
    await db.exec(`
      create role anon nologin noinherit;
      create role authenticated nologin noinherit;
      create role service_role nologin noinherit bypassrls;
      create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      grant usage on schema public, auth to anon, authenticated, service_role;
      grant execute on function auth.uid() to anon, authenticated, service_role;
      alter default privileges in schema public grant all on tables to service_role;
    `);
    for (const name of MIGRATIONS) {
      const sql = await readFile(new URL(`../supabase/${name}`, import.meta.url), "utf8");
      await db.exec(sql);
      t.diagnostic(`${name} SHA256 ${createHash("sha256").update(sql).digest("hex")}`);
    }
    for (const id of Object.values(USERS)) await query("insert into auth.users(id) values ($1::uuid)", [id]);
    const version = await scalar("select version()");
    assert.match(version, /^PostgreSQL /);
    t.diagnostic(version);
    assert.equal(await scalar("select count(*)::integer from pg_policies where schemaname = 'public'"), 3);
  });

  await t.test("new knowledge accepts CN1000 without changing the legacy table or opening visitor writes", async () => {
    await service(async () => {
      await query("insert into public.tourism_faq(id,category,question_en,question_zh,answer_en,answer_zh) values ('CN001','fixture','Old question','旧问题','Old answer','旧回答')");
      await query("insert into public.tourism_faq_v2(id,category,question_en,question_zh,answer_en,answer_zh) values ('CN1000','fixture','New question','新问题','New answer','新回答')");
      await denied(() => query("insert into public.tourism_faq_v2(id,category,question_en,question_zh,answer_en,answer_zh) values ('CN10000','fixture','Invalid','无效','Invalid','无效')"), '23514');
    });
    assert.equal(await scalar("select count(*)::integer from public.tourism_faq"), 1);
    assert.equal(await scalar("select count(*)::integer from public.tourism_faq_v2"), 1);
    for(const role of ['anon','authenticated'])await asRole(role,USERS.a,async()=>{
      await denied(()=>query("update public.tourism_faq_v2 set answer_en='visitor edit' where id='CN1000'"));
      await denied(()=>query("insert into public.travel_itinerary_routes(id,payload,checked_on) values ('visitor','{}','2026-10-28')"));
    });
  });

  await t.test("service-only publication creates version 1 and version 2 and exposes latest version only", async () => {
    assert.deepEqual(await publish(sample), sample);
    const next = { ...sample, version: 2 };
    assert.deepEqual(await publish(next), next);
    const result = await service(() => query("select persona_id, version from public.persona_profiles_latest"));
    assert.deepEqual(result.rows, [{ persona_id: sample.id, version: 2 }]);
    assert.equal(await scalar("select count(*)::integer from public.persona_packages"), 2);
  });

  await t.test("stale publication returns PostgreSQL 23505 without changing immutable versions", async () => {
    await denied(() => publish({ ...sample, version: 2 }, 1), "23505");
    assert.equal(await scalar("select count(*)::integer from public.persona_packages"), 2);
  });

  await t.test("invalid sequence, reserved persona and nonexistent actor cannot publish", async () => {
    await denied(() => publish({ ...sample, version: 4 }, 2), "22023");
    await denied(() => publish({ ...sample, id: "tourmate" }), "22023");
    await denied(() => publish({ ...sample, id: "missing-actor" }, 0, "10000000-0000-4000-8000-999999999999"), "23503");
    assert.equal(await scalar("select count(*)::integer from public.persona_packages"), 2);
  });

  await t.test("SQL package constraints reject malformed identity, tone, scope and knowledge", async () => {
    for (const overrides of [
      { tone: "visitor-controlled" }, { scope: [] }, { knowledge: [] }, { name: "not-a-localized-object" }
    ]) {
      await denied(() => publish({ ...sample, id: "malformed-profile", ...overrides }), "23514");
    }
    await service(async () => {
      await denied(() => query("insert into public.persona_packages(persona_id, version, payload, published_by) values ('identity-mismatch', 1, $1::jsonb, $2::uuid)",
        [JSON.stringify(sample), USERS.a]), "23514");
    });
    assert.equal(await scalar("select count(*)::integer from public.persona_packages"), 2);
  });

  for (const role of ["anon", "authenticated"]) {
    await t.test(`${role} cannot read private persona packages, latest view, or FAQ bank`, async () => {
      await asRole(role, USERS.a, async () => {
        for (const table of ["persona_packages", "persona_profiles_latest", "tourism_faq", "tourism_faq_v2", "travel_knowledge_sources", "travel_destinations", "travel_itinerary_routes"]) {
          await denied(() => query(`select * from public.${table}`));
        }
      });
    });

    await t.test(`${role} cannot publish persona packages or call privileged quota/exchange RPCs`, async () => {
      await asRole(role, USERS.a, async () => {
        await denied(() => query("select public.publish_persona_package($1::jsonb, 0, $2::uuid)", [JSON.stringify(sample), USERS.a]));
        await denied(() => query("insert into public.persona_packages(persona_id, version, payload, published_by) values ($1, 1, $2::jsonb, $3::uuid)",
          ["unauthorized-profile", JSON.stringify({ ...sample, id: "unauthorized-profile" }), USERS.a]));
        await denied(() => query("select public.consume_chat_quota($1::uuid, 6)", [USERS.a]));
        await denied(() => query("select public.store_persona_exchange($1::uuid, $2::uuid, $3, 1, 'question', 'answer')",
          [USERS.a, CONVERSATIONS.a, sample.id]));
      });
    });
  }

  await t.test("published persona rows reject UPDATE and DELETE even for service_role", async () => {
    await service(async () => {
      await denied(() => query("update public.persona_packages set payload = payload || '{\"tone\":\"professional\"}'::jsonb where persona_id = $1", [sample.id]));
      await denied(() => query("delete from public.persona_packages where persona_id = $1", [sample.id]));
    });
    assert.equal(await scalar("select count(*)::integer from public.persona_packages"), 2);
  });

  await t.test("authenticated users create own conversations for published or built-in versions only", async () => {
    await asRole("authenticated", USERS.a, async () => {
      await query("insert into public.conversations(id, user_id, persona_id, persona_version) values ($1::uuid, $2::uuid, $3, 1)",
        [CONVERSATIONS.a, USERS.a, sample.id]);
      await query("insert into public.conversations(id, user_id) values ($1::uuid, $2::uuid)", [CONVERSATIONS.builtin, USERS.a]);
      await denied(() => query("insert into public.conversations(user_id, persona_id, persona_version) values ($1::uuid, $2, 999)", [USERS.a, sample.id]), "23503");
      await denied(() => query("insert into public.conversations(user_id, persona_id) values ($1::uuid, 'unpublished-museum')", [USERS.a]), "23503");
      await denied(() => query("insert into public.conversations(user_id, persona_id) values ($1::uuid, $2)", [USERS.b, sample.id]));
    });
    await asRole("authenticated", USERS.b, () => query("insert into public.conversations(id, user_id, persona_id, persona_version) values ($1::uuid, $2::uuid, $3, 2)",
      [CONVERSATIONS.b, USERS.b, sample.id]));
    assert.equal(await scalar("select count(*)::integer from public.conversations"), 3);
  });

  await t.test("conversation persona identity and version cannot be changed by privileged writes", async () => {
    await service(async () => {
      await denied(() => query("update public.conversations set persona_version = 2 where id = $1::uuid", [CONVERSATIONS.a]));
      await denied(() => query("update public.conversations set persona_id = 'tourmate' where id = $1::uuid", [CONVERSATIONS.a]));
    });
    assert.deepEqual((await query("select persona_id, persona_version from public.conversations where id = $1::uuid", [CONVERSATIONS.a])).rows,
      [{ persona_id: sample.id, persona_version: 1 }]);
  });

  await t.test("atomic exchange rejects wrong owner, absent conversation and profile/version mismatch without partial writes", async () => {
    for (const overrides of [
      { userId: USERS.b }, { conversationId: "20000000-0000-4000-8000-999999999999" },
      { personaId: "tourmate" }, { version: 2 }, { version: null }, { userId: null }
    ]) {
      assert.equal(await store(overrides), false);
      assert.equal(await messageCount(), 0);
    }
  });

  await t.test("atomic exchange rejects empty, null and oversize text without orphan user rows", async () => {
    for (const overrides of [
      { userMessage: "" }, { assistantMessage: "" }, { userMessage: null }, { assistantMessage: null },
      { userMessage: "x".repeat(1501) }, { assistantMessage: "x".repeat(6001) }
    ]) {
      assert.equal(await store(overrides), false);
      assert.equal(await messageCount(), 0);
    }
  });

  await t.test("valid atomic exchange inserts exactly two ordered rows for the bound owner and persona", async () => {
    assert.equal(await store(), true);
    assert.equal(await store({ userId: USERS.b, conversationId: CONVERSATIONS.b, version: 2, userMessage: "Museum B question", assistantMessage: "Museum B answer" }), true);
    assert.equal(await messageCount(), 2);
    const result = await query("select role, content, created_at from public.messages where conversation_id = $1::uuid order by created_at", [CONVERSATIONS.a]);
    assert.deepEqual(result.rows.map(({ role, content }) => ({ role, content })), [
      { role: "user", content: "Who are you?" }, { role: "assistant", content: sample.knowledge[0].answer_en }
    ]);
    // JS Date truncates microseconds; check the SQL ordering difference directly.
    assert.equal(await scalar(`select (max(created_at) - min(created_at)) = interval '1 microsecond'
      from public.messages where conversation_id = $1::uuid`, [CONVERSATIONS.a]), true);
  });

  await t.test("a database insert failure rolls back the entire exchange rather than leaving an orphan user message", async () => {
    // Test-only fault injection: cause the assistant row to fail an additional
    // database constraint after input validation. No application SQL is patched.
    await db.exec(`alter table public.messages add constraint engine_test_assistant_failure
      check (role <> 'assistant' or content <> 'SQL_CONSTRAINT_FAILURE')`);
    try {
      await denied(() => store({ assistantMessage: "SQL_CONSTRAINT_FAILURE" }), "23514");
      assert.equal(await messageCount(), 2);
    } finally {
      await db.exec("alter table public.messages drop constraint engine_test_assistant_failure");
    }
  });

  for (const [key, expectedConversations] of [["a", [CONVERSATIONS.a, CONVERSATIONS.builtin]], ["b", [CONVERSATIONS.b]]]) {
    await t.test(`RLS user ${key.toUpperCase()} reads only own conversations and messages`, async () => {
      await asRole("authenticated", USERS[key], async () => {
        assert.equal(await scalar("select auth.uid()"), USERS[key]);
        assert.deepEqual((await query("select id from public.conversations order by id")).rows.map(row => row.id), expectedConversations);
        const visible = (await query("select conversation_id, role from public.messages order by created_at")).rows;
        assert.equal(visible.length, 2);
        assert.ok(visible.every(row => row.conversation_id === CONVERSATIONS[key]));
        assert.equal(await scalar("select count(*)::integer from public.messages where conversation_id = $1::uuid", [CONVERSATIONS[key === "a" ? "b" : "a"]]), 0);
      });
    });
  }

  await t.test("anonymous role cannot read conversations/messages or create any conversation", async () => {
    await asRole("anon", undefined, async () => {
      await denied(() => query("select * from public.conversations"));
      await denied(() => query("select * from public.messages"));
      await denied(() => query("insert into public.conversations(user_id) values ($1::uuid)", [USERS.a]));
    });
  });

  await t.test("authenticated browsers cannot insert, update or delete messages or update conversation bindings", async () => {
    await asRole("authenticated", USERS.a, async () => {
      await denied(() => query("insert into public.messages(conversation_id, role, content) values ($1::uuid, 'assistant', 'FORGED')", [CONVERSATIONS.a]));
      await denied(() => query("update public.messages set content = 'FORGED' where conversation_id = $1::uuid", [CONVERSATIONS.a]));
      await denied(() => query("delete from public.messages where conversation_id = $1::uuid", [CONVERSATIONS.a]));
      await denied(() => query("update public.conversations set persona_version = 2 where id = $1::uuid", [CONVERSATIONS.a]));
    });
    assert.equal(await messageCount(), 2);
  });

  await t.test("six requests per minute are admitted; seventh rolls back both minute and day increments", async () => {
    await fixedTransactionTime(async () => {
      await service(async () => {
        for (let index = 0; index < 6; index++) assert.equal(await scalar("select public.consume_chat_quota($1::uuid, 6)", [USERS.quota]), true);
        assert.equal(await scalar("select public.consume_chat_quota($1::uuid, 6)", [USERS.quota]), false);
      });
      assert.equal(await scalar("select used from public.chat_usage_minute where user_id = $1::uuid", [USERS.quota]), 6);
      assert.equal(await scalar("select used from public.chat_usage_day where user_id = $1::uuid", [USERS.quota]), 6);
    });
  });

  await t.test("sixtieth daily request succeeds; rejected sixty-first does not increment a fresh minute", async () => {
    // Seed the boundary explicitly rather than pretending the single connection
    // ran sixty requests across ten different wall-clock minutes.
    await fixedTransactionTime(async () => {
      await query("delete from public.chat_usage_day where user_id = $1::uuid", [USERS.quota]);
      await query("insert into public.chat_usage_day(user_id, day_start, used) values ($1::uuid, (now() at time zone 'UTC')::date, 59)", [USERS.quota]);
      await query("delete from public.chat_usage_minute where user_id = $1::uuid", [USERS.quota]);
      await service(async () => {
        assert.equal(await scalar("select public.consume_chat_quota($1::uuid, 6)", [USERS.quota]), true);
        assert.equal(await scalar("select public.consume_chat_quota($1::uuid, 6)", [USERS.quota]), false);
      });
      assert.equal(await scalar("select used from public.chat_usage_day where user_id = $1::uuid", [USERS.quota]), 60);
      assert.equal(await scalar("select used from public.chat_usage_minute where user_id = $1::uuid", [USERS.quota]), 1);
    });
  });

  await t.test("invalid or null quota arguments fail closed without creating usage rows", async () => {
    await service(async () => {
      for (const limit of [0, -1, 101, null]) assert.equal(await scalar("select public.consume_chat_quota($1::uuid, $2::integer)", [USERS.b, limit]), false,
        `Quota argument ${String(limit)} must fail closed`);
      assert.equal(await scalar("select public.consume_chat_quota(null, 6)"), false);
    });
    assert.equal(await scalar("select count(*)::integer from public.chat_usage_day where user_id = $1::uuid", [USERS.b]), 0);
    assert.equal(await scalar("select count(*)::integer from public.chat_usage_minute where user_id = $1::uuid", [USERS.b]), 0);
  });

  await t.test("browser roles cannot read or mutate quota tables directly", async () => {
    for (const role of ["anon", "authenticated"]) await asRole(role, USERS.a, async () => {
      for (const table of ["chat_usage_minute", "chat_usage_day"]) {
        await denied(() => query(`select * from public.${table}`));
        await denied(() => query(`update public.${table} set used = 0`));
      }
    });
  });

  await t.test("owner-filtered server deletion cascades messages and cannot erase a different visitor's chat", async () => {
    const id = "20000000-0000-4000-8000-000000000099";
    await asRole("authenticated", USERS.a, () => query("insert into public.conversations(id,user_id,title) values ($1,$2,'Delete me')", [id, USERS.a]));
    assert.equal(await store({ conversationId: id, personaId: "tourmate", version: 1 }), true);
    assert.equal(await messageCount(id), 2);
    const otherBefore = await messageCount(CONVERSATIONS.b);
    await asRole("authenticated", USERS.a, () => denied(() => query("delete from public.conversations where id=$1", [id])));
    const foreign = await service(() => query("delete from public.conversations where id=$1 and user_id=$2 returning id", [id, USERS.b]));
    assert.equal(foreign.rows.length, 0); assert.equal(await messageCount(id), 2);
    const removed = await service(() => query("delete from public.conversations where id=$1 and user_id=$2 returning id", [id, USERS.a]));
    assert.equal(removed.rows.length, 1); assert.equal(await messageCount(id), 0);
    assert.equal(await messageCount(CONVERSATIONS.b), otherBefore);
    assert.equal(await store({ conversationId: id, personaId: "tourmate", version: 1 }), false);
    assert.equal(await messageCount(id), 0, "A late generated exchange cannot recreate a deleted chat");
  });
});
