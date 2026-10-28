-- Versioned, additive expansion. Keep tourism_faq (100 rows) for rollback.
-- Visitor accounts, conversations and messages are untouched.
CREATE TABLE IF NOT EXISTS public.tourism_faq_v2 (
 id text PRIMARY KEY CHECK (id ~ '^CN[0-9]{3,4}$'),
 category text NOT NULL, question_en text NOT NULL, question_zh text NOT NULL,
 answer_en text NOT NULL, answer_zh text NOT NULL,
 aliases jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(aliases)='array'),
 sources jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(sources)='array'),
 research jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(research)='object')
);
CREATE TABLE IF NOT EXISTS public.travel_knowledge_sources (
 id text PRIMARY KEY, title text NOT NULL, url text NOT NULL CHECK(url ~ '^https://'),
 kind text NOT NULL CHECK(kind IN ('official','tour_operator','traveler_report')),
 checked_on date NOT NULL, evidence_scope text NOT NULL
);
CREATE TABLE IF NOT EXISTS public.travel_destinations (
 id text PRIMARY KEY CHECK(id ~ '^[a-z][a-z0-9_-]{1,63}$'),
 name_en text NOT NULL, name_zh text NOT NULL, payload jsonb NOT NULL,
 checked_on date NOT NULL
);
CREATE TABLE IF NOT EXISTS public.travel_itinerary_routes (
 id text PRIMARY KEY, payload jsonb NOT NULL, checked_on date NOT NULL
);
ALTER TABLE public.tourism_faq_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_itinerary_routes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tourism_faq_v2,public.travel_knowledge_sources,public.travel_destinations,public.travel_itinerary_routes FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON public.tourism_faq_v2,public.travel_knowledge_sources,public.travel_destinations,public.travel_itinerary_routes TO service_role;
