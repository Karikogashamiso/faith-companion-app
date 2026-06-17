CREATE TYPE public.ai_provider AS ENUM ('openai', 'anthropic', 'api_bible');

ALTER TABLE public.profiles ADD COLUMN ai_provider public.ai_provider NULL;

UPDATE public.profiles SET ai_provider = 'openai' WHERE ai_enabled = true AND ai_provider IS NULL;

GRANT USAGE ON TYPE public.ai_provider TO authenticated, anon, service_role;