import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AuroraBackground } from "@/components/monjob/aurora-background";
import { OffreCard } from "@/components/monjob/offre-card";
import { ScoreRing } from "@/components/monjob/score-ring";
import { useOffres } from "@/hooks/use-offres";
import { useProfil } from "@/hooks/use-profil";
import { supabase } from "@/integrations/supabase/client";
import { importerOffres } from "@/lib/monjob.functions";
import { criteres, moyenneDesScores } from "@/lib/monjob";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "MonJob — offres ouvertes au Burkina Faso analysées pour votre profil" },
      {
        name: "description",
        content:
          "MonJob récupère les offres d'emploi actuellement ouvertes au Burkina Faso et les évalue sur 100 selon votre CV et huit critères pondérés.",
      },
      { property: "og:title", content: "MonJob — offres d'emploi analysées pour votre profil" },
      {
        property: "og:description",
        content:
          "Offres ouvertes au Burkina Faso, score sur 100, adéquation avec votre CV et écarts à combler.",
      },
    ],
  }),
  component: Accueil,
});

const filtres = ["Toutes", "80 et plus", "60 – 79", "Moins de 60"] as const;

function Accueil() {
  const { profil } = useProfil();
  const { offres, charge, recharger } = useOffres();
  const importer = useServerFn(importerOffres);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filtre, setFiltre] = useState<(typeof filtres)[number]>("Toutes");
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState("");

  const moyenne = useMemo(() => moyenneDesScores(offres), [offres]);
  const initialesProfil = (profil.prenom || "M").trim().slice(0, 2).toUpperCase();

  const visibles = offres.filter((o) => {
    if (filtre === "80 et plus") return o.score >= 80;
    if (filtre === "60 – 79") return o.score >= 60 && o.score < 80;
    if (filtre === "Moins de 60") return o.score < 60;
    return true;
  });

  const solides = offres.filter((o) => o.score >= 80).length;

  async function actualiser() {
    setEnCours(true);
    setMessage("");
    try {
      const r = await importer({});
      await recharger();
      setMessage(
        r.ajoutees > 0
          ? `${r.ajoutees} nouvelle(s) offre(s) analysée(s) sur ${r.trouvees} trouvée(s).`
          : "Aucune nouvelle offre pour le moment.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "La récupération des offres a échoué.");
    } finally {
      setEnCours(false);
    }
  }

  async function deconnexion() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <AuroraBackground />

      <div className="relative mx-auto max-w-md px-5 py-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-aurora grid size-9 place-items-center rounded-xl font-display text-sm font-bold text-primary-foreground">
              M
            </div>
            <span className="font-display text-lg font-semibold tracking-tight">MonJob</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={deconnexion}
              className="glass-soft rounded-full px-3 py-1.5 text-xs text-muted-foreground"
            >
              Se déconnecter
            </button>
            <Link
              to="/profil"
              aria-label="Voir votre profil"
              className="grid size-10 place-items-center rounded-full bg-aurora font-display text-sm font-bold text-primary-foreground"
            >
              {initialesProfil}
            </Link>
          </div>
        </header>

        <section className="glass mt-8 rounded-3xl p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Offres ouvertes au Burkina Faso
              </p>
              <h1 className="mt-2 text-3xl font-semibold leading-none tracking-tight">
                Bonjour{profil.prenom ? ", " : ""}
                <span className="text-aurora">{profil.prenom}</span>
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">
                {offres.length} offre(s) analysée(s) selon votre profil, {solides} atteignent 80 sur
                100 ou plus.
              </p>
            </div>
            <ScoreRing score={moyenne} taille={104} libelle="Moyenne" />
          </div>

          <button
            onClick={() => void actualiser()}
            disabled={enCours}
            className="bg-aurora mt-5 w-full rounded-2xl p-3.5 font-display text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {enCours ? "Recherche et analyse en cours…" : "Actualiser les offres"}
          </button>
          {message && <p className="mt-3 text-xs text-muted-foreground">{message}</p>}
        </section>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Link
            to="/documents"
            className="glass-soft rounded-2xl p-4 text-center text-sm font-medium"
          >
            Mon CV & mes TDR
          </Link>
          <Link to="/profil" className="glass-soft rounded-2xl p-4 text-center text-sm font-medium">
            Mon profil
          </Link>
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {filtres.map((f) => (
            <button
              key={f}
              onClick={() => setFiltre(f)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                filtre === f
                  ? "bg-aurora text-primary-foreground"
                  : "glass-soft text-muted-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <section className="glass mt-4 rounded-3xl p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Offres classées
            </h2>
            <span className="text-xs text-muted-foreground">
              {visibles.length} sur {offres.length}
            </span>
          </div>
          <div className="mt-5 space-y-4">
            {visibles.map((o) => (
              <OffreCard key={o.id} offre={o} />
            ))}
            {charge && offres.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Aucune offre pour l'instant. Ajoutez votre CV puis appuyez sur « Actualiser les
                offres ».
              </p>
            )}
            {charge && offres.length > 0 && visibles.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Aucune offre ne correspond à ce filtre.
              </p>
            )}
          </div>
        </section>

        <section className="glass mt-4 rounded-3xl p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Pondération des critères
          </h2>
          <ul className="mt-5 space-y-3">
            {criteres.map((c) => (
              <li key={c.id}>
                <div className="mb-1.5 flex justify-between gap-3 text-xs">
                  <span className="truncate">{c.libelle}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {Math.round(c.poids * 100)} %
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="bg-aurora h-full rounded-full"
                    style={{ width: `${c.poids * 500}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="glass mt-4 rounded-3xl p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Repères de lecture
          </h2>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>80 – 100 : offre très solide, à privilégier.</li>
            <li>60 – 79 : offre correcte, vérifier les critères faibles.</li>
            <li>40 – 59 : offre moyenne, à considérer par défaut.</li>
            <li>Moins de 40 : offre peu intéressante.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
