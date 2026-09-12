import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AuroraBackground } from "@/components/monjob/aurora-background";
import { marqueDe } from "@/components/monjob/marks";
import { ScoreRing } from "@/components/monjob/score-ring";
import { useOffre } from "@/hooks/use-offres";
import { enregistrerNotes, reanalyserOffre, supprimerOffre } from "@/lib/monjob.functions";
import { criteres, detailsDe, palierDe, type Notes } from "@/lib/monjob";

export const Route = createFileRoute("/_authenticated/offres/$id")({
  head: () => ({
    meta: [
      { title: "Analyse de l'offre — MonJob" },
      {
        name: "description",
        content:
          "Score sur 100, notes par critère, adéquation avec votre CV, points forts et écarts à combler pour cette offre d'emploi.",
      },
      { property: "og:title", content: "Analyse de l'offre — MonJob" },
      {
        property: "og:description",
        content: "Évaluation détaillée d'une offre d'emploi selon votre profil.",
      },
    ],
  }),
  component: DetailOffre,
});

function DetailOffre() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { offre, charge, recharger, majNotes } = useOffre(id);
  const relancer = useServerFn(reanalyserOffre);
  const sauver = useServerFn(enregistrerNotes);
  const supprimer = useServerFn(supprimerOffre);
  const [enCours, setEnCours] = useState(false);

  if (!charge) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Chargement…</div>;
  }
  if (!offre) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Offre introuvable.</div>;
  }

  const palier = palierDe(offre.score);
  const details = detailsDe(offre.notes);
  const forts = details.filter((d) => d.note >= 4);
  const faibles = details.filter((d) => d.note <= 2);

  function changer(critereId: keyof Notes, valeur: number) {
    if (!offre) return;
    const maj = { ...offre.notes, [critereId]: valeur };
    majNotes(maj);
    void sauver({ data: { id: offre.id, notes: maj } });
  }

  async function relancerAnalyse() {
    setEnCours(true);
    try {
      await relancer({ data: { id } });
      await recharger();
    } finally {
      setEnCours(false);
    }
  }

  async function retirer() {
    await supprimer({ data: { id } });
    navigate({ to: "/" });
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <AuroraBackground />

      <div className="relative mx-auto max-w-md px-5 py-8">
        <Link to="/" className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          ← Retour
        </Link>

        <section className="glass mt-6 rounded-3xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <img
                src={marqueDe(offre.entreprise)}
                alt=""
                loading="lazy"
                width={512}
                height={512}
                className="size-12 rounded-xl object-cover"
              />
              <h1 className="mt-3 text-2xl font-semibold leading-tight tracking-tight">
                {offre.titre}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {offre.entreprise} · {offre.ville || "Burkina Faso"}
              </p>
              {offre.date_limite && (
                <p className="mt-1 text-sm text-muted-foreground">
                  Date limite : {offre.date_limite}
                </p>
              )}
            </div>
            <ScoreRing score={offre.score} taille={96} libelle="/ 100" />
          </div>
          <p className="text-aurora mt-4 text-sm font-semibold">{palier.libelle}</p>
          <p className="mt-1 text-sm text-muted-foreground">{palier.conseil}</p>
        </section>

        {offre.rapport.resume && (
          <section className="glass mt-4 rounded-3xl p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Résumé
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {offre.rapport.resume}
            </p>
            {offre.rapport.adequation && (
              <>
                <h2 className="mt-6 text-sm font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  Adéquation avec votre CV
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {offre.rapport.adequation}
                </p>
              </>
            )}
            {offre.rapport.ecarts.length > 0 && (
              <>
                <h2 className="mt-6 text-sm font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  Écarts à combler
                </h2>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {offre.rapport.ecarts.map((e) => (
                    <li key={e}>• {e}</li>
                  ))}
                </ul>
              </>
            )}
            {offre.rapport.conseil && (
              <p className="text-aurora mt-6 text-sm font-medium">{offre.rapport.conseil}</p>
            )}
          </section>
        )}

        <section className="glass mt-4 rounded-3xl p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Notes par critère
          </h2>
          <div className="mt-5 space-y-5">
            {details.map(({ critere, note, contribution }) => (
              <div key={critere.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-medium">{critere.libelle}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {Math.round(critere.poids * 100)} % · {contribution} pts
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {critere.regarde}
                </p>
                <div className="mt-2 flex gap-2">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button
                      key={v}
                      onClick={() => changer(critere.id, v)}
                      aria-label={`${critere.libelle} : note ${v} sur 5`}
                      className={`flex-1 rounded-xl py-2 text-xs font-semibold transition-colors ${
                        note === v
                          ? "bg-aurora text-primary-foreground"
                          : "glass-soft text-muted-foreground"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="glass mt-4 rounded-3xl p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Points forts
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {forts.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Aucun critère n'atteint la note de 4 sur 5.
              </p>
            )}
            {forts.map((d) => (
              <span
                key={d.critere.id}
                className="rounded-full bg-aurora-c/15 px-3 py-1 text-xs font-medium text-aurora-c"
              >
                {d.critere.libelle} · {d.note}/5
              </span>
            ))}
          </div>

          <h2 className="mt-6 text-sm font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Points de vigilance
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {faibles.length === 0 && (
              <p className="text-sm text-muted-foreground">Aucun critère faible.</p>
            )}
            {faibles.map((d) => (
              <span
                key={d.critere.id}
                className="glass-soft rounded-full px-3 py-1 text-xs text-muted-foreground"
              >
                {d.critere.libelle} · {d.note}/5
              </span>
            ))}
          </div>
        </section>

        <section className="glass mt-4 rounded-3xl p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Méthode de calcul
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Chaque critère est noté de 1 (très faible) à 5 (excellent), multiplié par son poids, puis
            la somme est ramenée sur 100. Les {criteres.length} poids totalisent 100 %.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">Source : {offre.source}</p>
        </section>

        {offre.url && (
          <a
            href={offre.url}
            target="_blank"
            rel="noreferrer"
            className="bg-aurora mt-4 block w-full rounded-2xl p-4 text-center font-display text-sm font-semibold text-primary-foreground"
          >
            Voir l'offre et postuler
          </a>
        )}

        <button
          onClick={() => void relancerAnalyse()}
          disabled={enCours}
          className="glass-soft mt-3 w-full rounded-2xl p-4 text-sm font-medium disabled:opacity-60"
        >
          {enCours ? "Analyse en cours…" : "Relancer l'analyse avec mon CV actuel"}
        </button>

        <button
          onClick={() => void retirer()}
          className="mt-3 w-full rounded-2xl p-3 text-xs text-muted-foreground"
        >
          Retirer cette offre
        </button>
      </div>
    </div>
  );
}
