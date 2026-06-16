
-- =========================================================================
-- ENUMS
-- =========================================================================
CREATE TYPE public.tradition AS ENUM (
  'catholic','orthodox','reformed','baptist','methodist','lutheran',
  'pentecostal','anglican','non_denominational','other','unspecified'
);

CREATE TYPE public.app_role AS ENUM ('admin','moderator','user');
CREATE TYPE public.group_role AS ENUM ('owner','member');
CREATE TYPE public.prayer_status AS ENUM ('open','answered','archived');

-- =========================================================================
-- USER ROLES (separate table to prevent privilege escalation)
-- =========================================================================
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins read all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- =========================================================================
-- PROFILES
-- =========================================================================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  tradition public.tradition NOT NULL DEFAULT 'unspecified',
  ai_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)));
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at helper
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================================
-- BIBLE VERSIONS + VERSES (the single source of Scripture text)
-- =========================================================================
CREATE TABLE public.bible_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  abbreviation text NOT NULL UNIQUE,
  language text NOT NULL DEFAULT 'en',
  license_notes text NOT NULL,
  is_public_domain boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bible_versions TO authenticated, anon;
GRANT ALL ON public.bible_versions TO service_role;
ALTER TABLE public.bible_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads versions" ON public.bible_versions
  FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "admins write versions" ON public.bible_versions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.verses (
  id bigserial PRIMARY KEY,
  version_id uuid NOT NULL REFERENCES public.bible_versions(id) ON DELETE CASCADE,
  book text NOT NULL,
  chapter int NOT NULL,
  verse int NOT NULL,
  text text NOT NULL,
  UNIQUE (version_id, book, chapter, verse)
);
CREATE INDEX verses_lookup_idx ON public.verses (version_id, book, chapter, verse);
CREATE INDEX verses_text_search_idx ON public.verses USING gin (to_tsvector('english', text));
GRANT SELECT ON public.verses TO authenticated, anon;
GRANT ALL ON public.verses TO service_role;
ALTER TABLE public.verses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads verses" ON public.verses
  FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "admins write verses" ON public.verses
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========================================================================
-- READING PLANS
-- =========================================================================
CREATE TABLE public.reading_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  tradition public.tradition,  -- nullable = universal
  day_count int NOT NULL CHECK (day_count > 0),
  is_premium boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reading_plans TO authenticated;
GRANT ALL ON public.reading_plans TO service_role;
ALTER TABLE public.reading_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone signed in reads plans" ON public.reading_plans
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins write plans" ON public.reading_plans
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.plan_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.reading_plans(id) ON DELETE CASCADE,
  day_number int NOT NULL CHECK (day_number > 0),
  passage_ref text NOT NULL,
  reflection_md text,
  prayer_md text,
  UNIQUE (plan_id, day_number)
);
CREATE INDEX plan_days_plan_idx ON public.plan_days(plan_id, day_number);
GRANT SELECT ON public.plan_days TO authenticated;
GRANT ALL ON public.plan_days TO service_role;
ALTER TABLE public.plan_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone signed in reads plan_days" ON public.plan_days
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins write plan_days" ON public.plan_days
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.user_plan_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.reading_plans(id) ON DELETE CASCADE,
  day_completed int NOT NULL CHECK (day_completed > 0),
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, plan_id, day_completed)
);
CREATE INDEX user_plan_progress_user_idx ON public.user_plan_progress(user_id, plan_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_plan_progress TO authenticated;
GRANT ALL ON public.user_plan_progress TO service_role;
ALTER TABLE public.user_plan_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own progress" ON public.user_plan_progress
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =========================================================================
-- CHURCHES (B2B2C)
-- =========================================================================
CREATE TABLE public.churches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  region text,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.churches TO authenticated;
GRANT ALL ON public.churches TO service_role;
ALTER TABLE public.churches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signed in see verified churches" ON public.churches
  FOR SELECT TO authenticated USING (verified = true OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins write churches" ON public.churches
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========================================================================
-- GROUPS  (created first so helper fn can reference it)
-- =========================================================================
CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  join_code text NOT NULL UNIQUE,
  church_id uuid REFERENCES public.churches(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.group_role NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);
CREATE INDEX group_members_user_idx ON public.group_members(user_id);
CREATE INDEX group_members_group_idx ON public.group_members(group_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_members TO authenticated;
GRANT ALL ON public.group_members TO service_role;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- Security definer membership check (avoid recursion)
CREATE OR REPLACE FUNCTION public.is_group_member(_group_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = _group_id AND user_id = _user_id)
$$;

-- Group policies
CREATE POLICY "lookup group by join_code or membership" ON public.groups
  FOR SELECT TO authenticated
  USING (public.is_group_member(id, auth.uid()) OR owner_id = auth.uid());
CREATE POLICY "create groups (self as owner)" ON public.groups
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owner updates group" ON public.groups
  FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owner deletes group" ON public.groups
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- Group member policies
CREATE POLICY "members read group roster" ON public.group_members
  FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "self joins group" ON public.group_members
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "self leaves group" ON public.group_members
  FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "owner removes members" ON public.group_members
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.owner_id = auth.uid()));

-- Auto-add owner as member on group creation
CREATE OR REPLACE FUNCTION public.add_owner_as_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.group_members (group_id, user_id, role) VALUES (NEW.id, NEW.owner_id, 'owner');
  RETURN NEW;
END;
$$;
CREATE TRIGGER groups_add_owner_member
  AFTER INSERT ON public.groups FOR EACH ROW EXECUTE FUNCTION public.add_owner_as_member();

-- =========================================================================
-- PRAYER REQUESTS & RESPONSES
-- =========================================================================
CREATE TABLE public.prayer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  status public.prayer_status NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX prayer_requests_group_idx ON public.prayer_requests(group_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prayer_requests TO authenticated;
GRANT ALL ON public.prayer_requests TO service_role;
ALTER TABLE public.prayer_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read prayer requests" ON public.prayer_requests
  FOR SELECT TO authenticated USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "members create prayer requests" ON public.prayer_requests
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.is_group_member(group_id, auth.uid()));
CREATE POLICY "author edits prayer request" ON public.prayer_requests
  FOR UPDATE TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY "author deletes prayer request" ON public.prayer_requests
  FOR DELETE TO authenticated USING (author_id = auth.uid());
CREATE TRIGGER prayer_requests_touch BEFORE UPDATE ON public.prayer_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.prayer_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.prayer_requests(id) ON DELETE CASCADE,
  responder_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note text,
  prayed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX prayer_responses_request_idx ON public.prayer_responses(request_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prayer_responses TO authenticated;
GRANT ALL ON public.prayer_responses TO service_role;
ALTER TABLE public.prayer_responses ENABLE ROW LEVEL SECURITY;

-- Helper: is responder a member of the group owning this request?
CREATE OR REPLACE FUNCTION public.can_access_request(_request_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.prayer_requests pr
    WHERE pr.id = _request_id AND public.is_group_member(pr.group_id, _user_id)
  )
$$;

CREATE POLICY "members read responses" ON public.prayer_responses
  FOR SELECT TO authenticated USING (public.can_access_request(request_id, auth.uid()));
CREATE POLICY "members create responses" ON public.prayer_responses
  FOR INSERT TO authenticated
  WITH CHECK (responder_id = auth.uid() AND public.can_access_request(request_id, auth.uid()));
CREATE POLICY "responder edits response" ON public.prayer_responses
  FOR UPDATE TO authenticated USING (responder_id = auth.uid()) WITH CHECK (responder_id = auth.uid());
CREATE POLICY "responder deletes response" ON public.prayer_responses
  FOR DELETE TO authenticated USING (responder_id = auth.uid());

-- =========================================================================
-- SEED: register the WEB (World English Bible) version — public domain.
-- Verse text is loaded via the importer (see /api/public/hooks/import-web-bible).
-- =========================================================================
INSERT INTO public.bible_versions (name, abbreviation, language, license_notes, is_public_domain)
VALUES (
  'World English Bible',
  'WEB',
  'en',
  'Public domain. No royalties. Source: ebible.org / openbible.com. Safe for unrestricted distribution.',
  true
);
