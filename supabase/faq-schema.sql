-- Optional remote FAQ storage. Does not change existing chat tables.
CREATE TABLE IF NOT EXISTS public.tourism_faq (
  id text PRIMARY KEY CHECK (id ~ '^CN[0-9]{3}$'),
  category text NOT NULL,
  question_en text NOT NULL,
  question_zh text NOT NULL,
  answer_en text NOT NULL,
  answer_zh text NOT NULL,
  aliases jsonb NOT NULL DEFAULT '[]',
  sources jsonb NOT NULL DEFAULT '[]'
);
ALTER TABLE public.tourism_faq ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tourism_faq FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.tourism_faq TO service_role;
-- No browser policies. Only the server reads via its service-role key.
