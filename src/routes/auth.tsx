import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type SubmitEvent } from "react";
import { AuroraBackground } from "@/components/monjob/aurora-background";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Connexion — MonJob" },
      {
        name: "description",
        content:
          "Connectez-vous à MonJob pour évaluer les offres d'emploi selon votre profil et retrouver vos notes sur tous vos appareils.",
      },
      { property: "og:title", content: "Connexion — MonJob" },
      {
        property: "og:description",
        content: "Accédez à votre grille d'évaluation personnelle des offres d'emploi.",
      },
    ],
  }),
  component: PageAuth,
});

function PageAuth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"connexion" | "inscription">("connexion");
  const [prenom, setPrenom] = useState("");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        navigate({ to: "/", replace: true });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function soumettre(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setErreur(null);
    setInfo(null);
    setOccupe(true);
    try {
      if (mode === "connexion") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: motDePasse });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: motDePasse,
          options: {
            emailRedirectTo: window.location.origin,
            data: { prenom },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setInfo("Compte créé. Ouvrez l'email de confirmation pour activer votre accès.");
        }
      }
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setOccupe(false);
    }
  }

  async function google() {
    setErreur(null);
    setOccupe(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) {
      setErreur("La connexion avec Google a échoué.");
      setOccupe(false);
      return;
    }
  }

  const champ =
    "glass-soft w-full rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <AuroraBackground />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
        <div className="flex items-center gap-2">
          <div className="bg-aurora grid size-9 place-items-center rounded-xl font-display text-sm font-bold text-primary-foreground">
            M
          </div>
          <span className="font-display text-lg font-semibold tracking-tight">MonJob</span>
        </div>

        <h1 className="mt-6 text-3xl font-semibold leading-tight tracking-tight">
          {mode === "connexion" ? "Content de vous " : "Créer votre "}
          <span className="text-aurora">{mode === "connexion" ? "revoir" : "compte"}</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Vos notes et votre profil vous suivent sur tous vos appareils.
        </p>

        <form className="glass mt-6 space-y-4 rounded-3xl p-5" onSubmit={soumettre}>
          {mode === "inscription" && (
            <label className="block">
              <span className="mb-2 block text-xs uppercase tracking-[0.15em] text-muted-foreground">
                Prénom
              </span>
              <input
                className={champ}
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
                autoComplete="given-name"
                required
              />
            </label>
          )}

          <label className="block">
            <span className="mb-2 block text-xs uppercase tracking-[0.15em] text-muted-foreground">
              Email
            </span>
            <input
              type="email"
              className={champ}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs uppercase tracking-[0.15em] text-muted-foreground">
              Mot de passe
            </span>
            <input
              type="password"
              className={champ}
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              autoComplete={mode === "connexion" ? "current-password" : "new-password"}
              minLength={6}
              required
            />
          </label>

          {erreur && <p className="text-sm text-aurora-a">{erreur}</p>}
          {info && <p className="text-sm text-muted-foreground">{info}</p>}

          <button
            type="submit"
            disabled={occupe}
            className="bg-aurora w-full rounded-2xl p-4 font-display text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {mode === "connexion" ? "Se connecter" : "Créer mon compte"}
          </button>

          <button
            type="button"
            onClick={google}
            disabled={occupe}
            className="glass-soft w-full rounded-2xl p-4 text-sm font-medium disabled:opacity-60"
          >
            Continuer avec Google
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === "connexion" ? "inscription" : "connexion");
            setErreur(null);
            setInfo(null);
          }}
          className="mt-5 text-center text-sm text-muted-foreground"
        >
          {mode === "connexion"
            ? "Pas encore de compte ? Créer un compte"
            : "Déjà inscrit ? Se connecter"}
        </button>
      </div>
    </div>
  );
}
