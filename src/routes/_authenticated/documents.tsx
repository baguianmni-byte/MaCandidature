import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AuroraBackground } from "@/components/monjob/aurora-background";
import { ajouterOffre, televerserDocument } from "@/lib/monjob.functions";

export const Route = createFileRoute("/_authenticated/documents")({
  head: () => ({
    meta: [
      { title: "Mon CV et mes TDR — MonJob" },
      {
        name: "description",
        content:
          "Téléversez votre CV pour remplir votre profil automatiquement, ou des termes de référence pour les faire évaluer selon votre parcours.",
      },
      { property: "og:title", content: "Mon CV et mes TDR — MonJob" },
      {
        property: "og:description",
        content: "Téléversez votre CV ou des TDR pour une analyse personnalisée.",
      },
    ],
  }),
  component: PageDocuments,
});

async function enBase64(fichier: File): Promise<string> {
  const buffer = new Uint8Array(await fichier.arrayBuffer());
  let binaire = "";
  for (const octet of buffer) binaire += String.fromCharCode(octet);
  return btoa(binaire);
}

function PageDocuments() {
  const navigate = useNavigate();
  const envoyer = useServerFn(televerserDocument);
  const creer = useServerFn(ajouterOffre);
  const [enCours, setEnCours] = useState<"cv" | "tdr" | "manuel" | null>(null);
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");
  const [manuel, setManuel] = useState({
    titre: "",
    entreprise: "",
    ville: "",
    contrat: "CDD",
    description: "",
    url: "",
    date_limite: "",
  });

  async function televerser(type: "cv" | "tdr", fichier: File | null | undefined) {
    if (!fichier) return;
    setEnCours(type);
    setMessage("");
    setErreur("");
    try {
      const contenu = await enBase64(fichier);
      const r = await envoyer({ data: { type, nom: fichier.name, contenu } });
      if (r.type === "cv") {
        setMessage(`CV analysé. ${r.resume}`);
      } else {
        navigate({ to: "/offres/$id", params: { id: r.id } });
      }
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Le document n'a pas pu être analysé.");
    } finally {
      setEnCours(null);
    }
  }

  async function ajouterManuel() {
    if (manuel.titre.trim().length < 2) {
      setErreur("Indiquez au moins l'intitulé du poste.");
      return;
    }
    setEnCours("manuel");
    setErreur("");
    try {
      const r = await creer({ data: { ...manuel, mode: "Sur site" } });
      navigate({ to: "/offres/$id", params: { id: r.id } });
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "L'offre n'a pas pu être analysée.");
    } finally {
      setEnCours(null);
    }
  }

  const champ =
    "glass-soft w-full rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <AuroraBackground />

      <div className="relative mx-auto max-w-md px-5 py-8">
        <Link to="/" className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          ← Retour
        </Link>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Mon CV et mes TDR</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Formats acceptés : PDF contenant du texte ou fichier .txt, 10 Mo maximum.
        </p>

        <section className="glass mt-6 rounded-3xl p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Mon CV
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Votre CV remplit votre profil et sert de référence pour évaluer chaque offre.
          </p>
          <label className="bg-aurora mt-4 block cursor-pointer rounded-2xl p-4 text-center font-display text-sm font-semibold text-primary-foreground">
            {enCours === "cv" ? "Lecture du CV en cours…" : "Téléverser mon CV"}
            <input
              type="file"
              accept=".pdf,.txt"
              className="hidden"
              disabled={enCours !== null}
              onChange={(e) => void televerser("cv", e.target.files?.[0])}
            />
          </label>
        </section>

        <section className="glass mt-4 rounded-3xl p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Termes de référence (TDR)
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Vos TDR sont comparés à votre CV puis notés sur 100 comme une offre.
          </p>
          <label className="glass-soft mt-4 block cursor-pointer rounded-2xl p-4 text-center text-sm font-medium">
            {enCours === "tdr" ? "Analyse des TDR en cours…" : "Téléverser des TDR"}
            <input
              type="file"
              accept=".pdf,.txt"
              className="hidden"
              disabled={enCours !== null}
              onChange={(e) => void televerser("tdr", e.target.files?.[0])}
            />
          </label>
        </section>

        <section className="glass mt-4 space-y-3 rounded-3xl p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Ajouter une offre à la main
          </h2>
          <input
            className={champ}
            placeholder="Intitulé du poste"
            value={manuel.titre}
            onChange={(e) => setManuel((m) => ({ ...m, titre: e.target.value }))}
          />
          <input
            className={champ}
            placeholder="Structure / entreprise"
            value={manuel.entreprise}
            onChange={(e) => setManuel((m) => ({ ...m, entreprise: e.target.value }))}
          />
          <div className="flex gap-3">
            <input
              className={champ}
              placeholder="Ville"
              value={manuel.ville}
              onChange={(e) => setManuel((m) => ({ ...m, ville: e.target.value }))}
            />
            <input
              className={champ}
              placeholder="Contrat"
              value={manuel.contrat}
              onChange={(e) => setManuel((m) => ({ ...m, contrat: e.target.value }))}
            />
          </div>
          <textarea
            className={`${champ} min-h-32 resize-none`}
            placeholder="Description du poste, missions, exigences, rémunération…"
            value={manuel.description}
            onChange={(e) => setManuel((m) => ({ ...m, description: e.target.value }))}
          />
          <input
            className={champ}
            placeholder="Lien vers l'offre (facultatif)"
            value={manuel.url}
            onChange={(e) => setManuel((m) => ({ ...m, url: e.target.value }))}
          />
          <input
            className={champ}
            placeholder="Date limite (facultatif)"
            value={manuel.date_limite}
            onChange={(e) => setManuel((m) => ({ ...m, date_limite: e.target.value }))}
          />
          <button
            onClick={() => void ajouterManuel()}
            disabled={enCours !== null}
            className="bg-aurora w-full rounded-2xl p-4 font-display text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {enCours === "manuel" ? "Analyse en cours…" : "Analyser cette offre"}
          </button>
        </section>

        {message && <p className="mt-4 text-sm text-muted-foreground">{message}</p>}
        {erreur && (
          <p role="alert" className="mt-4 text-sm text-aurora-a">
            {erreur}
          </p>
        )}
      </div>
    </div>
  );
}
