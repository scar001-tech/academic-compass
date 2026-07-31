-- Academic Compass Supabase Schema
-- Matches the current SQLite schema structure

-- Profiles table (matches ac_profiles)
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  department TEXT,
  approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by authed" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid()::TEXT = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid()::TEXT = id);

-- User roles table (matches ac_user_roles)
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  PRIMARY KEY (user_id, role)
);

GRANT SELECT, INSERT, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid()::TEXT);
CREATE POLICY "Users insert own roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid()::TEXT);
CREATE POLICY "Users delete own roles" ON public.user_roles FOR DELETE TO authenticated USING (user_id = auth.uid()::TEXT);

-- Role helper function
CREATE OR REPLACE FUNCTION public.has_role(_user_id TEXT, _role TEXT)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Updated at helper
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Mark entries (matches ac_mark_entries)
CREATE TABLE IF NOT EXISTS public.mark_entries (
  id TEXT PRIMARY KEY,
  curriculum_id TEXT NOT NULL,
  sheet_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  score NUMERIC,
  updated_by TEXT REFERENCES public.profiles(id),
  device_name TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mark_entries TO authenticated;
GRANT ALL ON public.mark_entries TO service_role;

ALTER TABLE public.mark_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authed read marks" ON public.mark_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authed write marks" ON public.mark_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authed update marks" ON public.mark_entries FOR UPDATE TO authenticated USING (true);

CREATE TRIGGER touch_mark_entries BEFORE UPDATE ON public.mark_entries FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Timetable slots (matches ac_timetable_slots)
CREATE TABLE IF NOT EXISTS public.timetable_slots (
  id TEXT PRIMARY KEY,
  curriculum_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  stream_id TEXT,
  day_of_week SMALLINT NOT NULL,
  period SMALLINT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  subject_id TEXT,
  teacher_id TEXT,
  room TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT REFERENCES public.profiles(id),
  device_name TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.timetable_slots TO authenticated;
GRANT ALL ON public.timetable_slots TO service_role;

ALTER TABLE public.timetable_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authed read timetable" ON public.timetable_slots FOR SELECT TO authenticated USING (true);
CREATE POLICY "HOD/Principal insert timetable" ON public.timetable_slots FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid()::TEXT, 'principal') OR public.has_role(auth.uid()::TEXT, 'hod') OR public.has_role(auth.uid()::TEXT, 'admin'));
CREATE POLICY "HOD/Principal update timetable" ON public.timetable_slots FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid()::TEXT, 'principal') OR public.has_role(auth.uid()::TEXT, 'hod') OR public.has_role(auth.uid()::TEXT, 'admin'));
CREATE POLICY "HOD/Principal delete timetable" ON public.timetable_slots FOR DELETE TO authenticated
  USING (public.has_role(auth.uid()::TEXT, 'principal') OR public.has_role(auth.uid()::TEXT, 'hod') OR public.has_role(auth.uid()::TEXT, 'admin'));

CREATE TRIGGER touch_timetable BEFORE UPDATE ON public.timetable_slots FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Sync conflicts (matches ac_sync_conflicts)
CREATE TABLE IF NOT EXISTS public.sync_conflicts (
  id TEXT PRIMARY KEY,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  field TEXT NOT NULL,
  server_value TEXT,
  incoming_value TEXT,
  incoming_by TEXT REFERENCES public.profiles(id),
  incoming_device TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  resolution TEXT,
  custom_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sync_conflicts TO authenticated;
GRANT ALL ON public.sync_conflicts TO service_role;

ALTER TABLE public.sync_conflicts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authed read conflicts" ON public.sync_conflicts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authed write conflicts" ON public.sync_conflicts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authed update conflicts" ON public.sync_conflicts FOR UPDATE TO authenticated USING (true);

-- School data snapshot (matches ac_school_data)
CREATE TABLE IF NOT EXISTS public.school_data (
  id TEXT PRIMARY KEY DEFAULT 'global',
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.school_data TO authenticated;
GRANT ALL ON public.school_data TO service_role;

ALTER TABLE public.school_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authed read school_data" ON public.school_data FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authed write school_data" ON public.school_data FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authed update school_data" ON public.school_data FOR UPDATE TO authenticated USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_mark_entries_sheet_student ON public.mark_entries(sheet_id, student_id);
CREATE INDEX IF NOT EXISTS idx_mark_entries_student ON public.mark_entries(student_id);
CREATE INDEX IF NOT EXISTS idx_timetable_slots_class_stream ON public.timetable_slots(class_id, stream_id, day_of_week, period);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_status ON public.sync_conflicts(status);
