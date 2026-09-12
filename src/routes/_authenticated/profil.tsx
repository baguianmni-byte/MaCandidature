import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuroraBackground } from "@/components/monjob/aurora-background";
import { useProfil } from "@/hooks/use-profil";
import type { Offre, Profil } from "@/lib/monjob";

export const Route = createFileRoute("/_authenticated/profil")({
  head: () => ({
    meta: [
      { title: "Mon profil — MonJob" },
      {
        name: "description",
        content:
          "Renseignez votre métier, votre ville, votre expérience et vos compétences pour affiner l'évaluation des offres d'emploi.",
      },
      { property: "og:title", content: "Mon profil — MonJob" },
      {
        property: "og:description",
        content: "Ajustez votre profil pour affiner l'évaluation des offres d'emploi.",
      },
    ],
  }),
  component: PageProfil,
});

const modes: Offre["mode"][] = ["Sur site", "Hybride", "Télétravail"];

function PageProfil() {
  const { profil, enregistrer, charge } = useProfil();
  const [brouillon, setBrouillon] = useState<Profil>(profil);
  const [enregistre, setEnregistre] = useState(false);

  useEffect(() => {
    if (charge) setBrouillon(profil);
  }, [charge, profil]);

  function maj<K extends keyof Profil>(cle: K, valeur: Profil[K]) {
    setBrouillon((p) => ({ ...p, [cle]: valeur }));
    setEnregistre(false);
  }

  async function valider() {
    await enregistrer(brouillon);
    setEnregistre(true);
  }

  const champ =
    "glass-soft w-full rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring";
  const initialesProfil = (profil.prenom || "M").trim().slice(0, 2).toUpperCase();

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <AuroraBackground />

      <div className="relative mx-auto max-w-md px-5 py-8">
        <Link to="/" className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          ← Retour
        </Link>

        <section className="glass mt-6 rounded-3xl p-6">
          <div className="flex items-center gap-4">
            <div className="grid size-16 place-items-center rounded-full bg-aurora font-display text-lg font-bold text-primary-foreground">
              {initialesProfil}
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Mon profil</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Ces informations vous suivent sur tous vos appareils.
              </p>
            </div>
          </div>
        </section>

        <section className="glass mt-4 space-y-4 rounded-3xl p-5">
          <label className="block">
            <span className="mb-2 block text-xs uppercase tracking-[0.15em] text-muted-foreground">
              Prénom
            </span>
            <input
              className={champ}
              value={brouillon.prenom}
              onChange={(e) => maj("prenom", e.target.value)}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs uppercase tracking-[0.15em] text-muted-foreground">
              Métier visé
            </span>
            <input
              className={champ}
              value={brouillon.metier}
              onChange={(e) => maj("metier", e.target.value)}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs uppercase tracking-[0.15em] text-muted-foreground">
              Ville
            </span>
            <input
              className={champ}
              value={brouillon.ville}
              onChange={(e) => maj("ville", e.target.value)}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs uppercase tracking-[0.15em] text-muted-foreground">
              Années d'expérience : {brouillon.experience}
            </span>
            <input
              type="range"
              min={0}
              max={25}
              value={brouillon.experience}
              onChange={(e) => maj("experience", Number(e.target.value))}
              className="w-full accent-primary"
            />
          </label>

          <div>
            <span className="mb-2 block text-xs uppercase tracking-[0.15em] text-muted-foreground">
              Mode de travail préféré
            </span>
            <div className="flex gap-2">
              {modes.map((m) => (
                <button
                  key={m}
                  onClick={() => maj("modePrefere", m)}
                  className={`flex-1 rounded-xl py-2.5 text-xs font-medium transition-colors ${
                    brouillon.modePrefere === m
                      ? "bg-aurora text-primary-foreground"
                      : "glass-soft text-muted-foreground"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-2 block text-xs uppercase tracking-[0.15em] text-muted-foreground">
              Compétences (séparées par une virgule)
            </span>
            <textarea
              className={`${champ} min-h-24 resize-none`}
              value={brouillon.competences.join(", ")}
              onChange={(e) =>
                maj(
                  "competences",
                  e.target.value
                    .split(",")
                    .map((c) => c.trim())
                    .filter(Boolean),
                )
              }
            />
          </label>
        </section>

        <button
          onClick={() => void valider()}
          className="bg-aurora mt-4 w-full rounded-2xl p-4 font-display text-sm font-semibold text-primary-foreground"
        >
          {enregistre ? "Profil enregistré" : "Enregistrer mon profil"}
        </button>
      </div>
    </div>
  );
}
