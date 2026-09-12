ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cv_texte text NOT NULL DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cv_resume text NOT NULL DEFAULT '';

CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('cv','tdr')),
  nom text NOT NULL,
  chemin text NOT NULL,
  texte text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own documents" ON public.documents FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.offres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'recherche',
  titre text NOT NULL,
  entreprise text NOT NULL DEFAULT '',
  ville text NOT NULL DEFAULT '',
  contrat text NOT NULL DEFAULT '',
  mode text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '',
  date_limite text NOT NULL DEFAULT '',
  notes jsonb NOT NULL DEFAULT '{}'::jsonb,
  score integer NOT NULL DEFAULT 0,
  rapport jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.offres TO authenticated;
GRANT ALL ON public.offres TO service_role;
ALTER TABLE public.offres ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own offres" ON public.offres FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER offres_updated_at BEFORE UPDATE ON public.offres FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX offres_user_score_idx ON public.offres (user_id, score DESC);