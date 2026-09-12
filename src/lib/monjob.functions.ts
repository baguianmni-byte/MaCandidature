import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { criteres, normaliserNotes, scoreDe, type Notes, type Rapport } from "@/lib/monjob";

type ProfilLigne = {
  prenom: string;
  metier: string;
  ville: string;
  experience: number;
  mode_prefere: string;
  competences: string[];
  cv_texte: string;
  cv_resume: string;
};

function texteProfil(p: ProfilLigne | null): string {
  if (!p) return "Profil non renseigné.";
  const base = [
    `Métier visé : ${p.metier || "non précisé"}`,
    `Ville : ${p.ville || "non précisée"}`,
    `Expérience : ${p.experience} ans`,
    `Mode de travail préféré : ${p.mode_prefere}`,
    `Compétences : ${(p.competences ?? []).join(", ") || "non précisées"}`,
  ].join("\n");
  const cv = p.cv_texte ? `\n\nCV du candidat :\n${p.cv_texte.slice(0, 12000)}` : "";
  return base + cv;
}

const SCHEMA_ANALYSE = {
  type: "object",
  required: ["notes", "resume", "adequation", "points_forts", "ecarts", "conseil"],
  properties: {
    notes: {
      type: "object",
      required: criteres.map((c) => c.id),
      properties: Object.fromEntries(
        criteres.map((c) => [
          c.id,
          {
            type: "integer",
            minimum: 1,
            maximum: 5,
          },
        ]),
      ),
    },
    resume: { type: "string" },
    adequation: { type: "string" },
    points_forts: {
      type: "array",
      items: { type: "string" },
    },
    ecarts: {
      type: "array",
      items: { type: "string" },
    },
    conseil: { type: "string" },
  },
} as const;


const SYSTEME = `Tu es un conseiller en carrière au Burkina Faso. Tu évalues une offre d'emploi pour un candidat précis, en français, avec la grille suivante notée de 1 (très faible) à 5 (excellent) :
${criteres.map((c) => `- ${c.id} (${Math.round(c.poids * 100)} %) : ${c.libelle} — ${c.regarde}`).join("\n")}
Sois réaliste et prudent : quand l'offre ne dit rien sur un critère, note 3. "adequation" compare précisément le CV et le poste. "ecarts" liste ce qui manque au candidat. Réponds uniquement en français.`;

type ResultatIA = {
  notes: Record<string, number>;
  resume: string;
  adequation: string;
  points_forts: string[];
  ecarts: string[];
  conseil: string;
};

async function analyser(offreTexte: string, profil: string) {
  const { jsonIA } = await import("@/lib/ai.server");
  const brut = await jsonIA<ResultatIA>({
    system: SYSTEME,
    prompt: `PROFIL DU CANDIDAT\n${profil}\n\nOFFRE / TERMES DE RÉFÉRENCE\n${offreTexte.slice(0, 20000)}`,
    schema: SCHEMA_ANALYSE as unknown as Record<string, unknown>,
    nomSchema: "analyse_offre",
  });
  const notes: Notes = normaliserNotes(brut.notes);
  const rapport: Rapport = {
    resume: brut.resume,
    adequation: brut.adequation,
    points_forts: brut.points_forts ?? [],
    ecarts: brut.ecarts ?? [],
    conseil: brut.conseil,
  };
  return { notes, rapport, score: scoreDe(notes) };
}

async function lireProfil(supabase: SupabaseClient<Database>, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("prenom, metier, ville, experience, mode_prefere, competences, cv_texte, cv_resume")
    .eq("id", userId)
    .maybeSingle();
  return (data ?? null) as ProfilLigne | null;
}

/** Importe les offres actuellement ouvertes au Burkina Faso et les analyse. */
export const importerOffres = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const offresMod = (await import("@/lib/offres-bf.server")) as Partial<{
      recupererOffresBurkina: (metier?: string) => Promise<Array<{ url?: string; titre?: string; entreprise?: string; description?: string; ville?: string; date_limite?: string }>>;
      recupererOffresBF: (metier?: string) => Promise<Array<{ url?: string; titre?: string; entreprise?: string; description?: string; ville?: string; date_limite?: string }>>;
      recupererOffresBurkinaData: (metier?: string) => Promise<Array<{ url?: string; titre?: string; entreprise?: string; description?: string; ville?: string; date_limite?: string }>>;
    }>;
    const recupererOffres =
      offresMod.recupererOffresBurkina ??
      offresMod.recupererOffresBF ??
      offresMod.recupererOffresBurkinaData;

    if (!recupererOffres) {
      throw new Error("Aucune fonction de récupération des offres Burkina disponible.");
    }

    const profilLigne = await lireProfil(
  supabase,
  userId,
);

const brutes = await recupererOffres();
    

    const { data: existantes } = await supabase.from("offres").select("url").eq("user_id", userId);
    const connues = new Set(((existantes ?? []) as { url: string }[]).map((o) => o.url));
    const nouvelles = brutes.filter((o) => o.url && !connues.has(o.url));

    const profil = texteProfil(profilLigne);
    let ajoutees = 0;

    for (const offre of nouvelles.slice(0, 12)) {
      try {
        const titre = offre.titre ?? "";
        const entreprise = offre.entreprise ?? "";
        const ville = offre.ville ?? "";
        const description = offre.description ?? "";
        const url = offre.url ?? "";
        const dateLimite = offre.date_limite ?? "";

        const { notes, rapport, score } = await analyser(
          `${titre} — ${entreprise}\n${description}`,
          profil,
        );
        const { error } = await supabase.from("offres").insert({
          user_id: userId,
          source: "Burkina Faso — offres humanitaires et développement",
          titre,
          entreprise,
          ville,
          contrat: "À préciser",
          mode: "Sur site",
          description,
          url,
          date_limite: dateLimite,
          notes,
          score,
          rapport,
        });
        if (!error) ajoutees += 1;
      } catch {
        // une offre en échec ne doit pas bloquer les autres
      }
    }

    return { trouvees: brutes.length, ajoutees };
  });

/** Ajoute une offre saisie à la main puis l'analyse. */
export const ajouterOffre = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        titre: z.string().min(2),
        entreprise: z.string().default(""),
        ville: z.string().default(""),
        contrat: z.string().default("À préciser"),
        mode: z.string().default("Sur site"),
        description: z.string().default(""),
        url: z.string().default(""),
        date_limite: z.string().default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const profil = texteProfil(await lireProfil(supabase, userId));
    const { notes, rapport, score } = await analyser(
      `${data.titre} — ${data.entreprise} (${data.ville}, ${data.contrat})\n${data.description}`,
      profil,
    );
    const { data: creee, error } = await supabase
      .from("offres")
      .insert({ user_id: userId, source: "Saisie manuelle", ...data, notes, score, rapport })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (creee as { id: string }).id };
  });

/** Relance l'analyse d'une offre avec le profil et le CV actuels. */
export const reanalyserOffre = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: offre } = await supabase
      .from("offres")
      .select("titre, entreprise, ville, contrat, description")
      .eq("id", data.id)
      .maybeSingle();
    if (!offre) throw new Error("Offre introuvable.");
    const o = offre as {
      titre: string;
      entreprise: string;
      ville: string;
      contrat: string;
      description: string;
    };
    const profil = texteProfil(await lireProfil(supabase, userId));
    const { notes, rapport, score } = await analyser(
      `${o.titre} — ${o.entreprise} (${o.ville}, ${o.contrat})\n${o.description}`,
      profil,
    );
    const { error } = await supabase
      .from("offres")
      .update({ notes, score, rapport, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { score };
  });

/** Enregistre les notes ajustées à la main. */
export const enregistrerNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ id: z.string().uuid(), notes: z.record(z.number()) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const notes = normaliserNotes(data.notes);
    const score = scoreDe(notes);
    const { error } = await context.supabase
      .from("offres")
      .update({ notes, score, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { score };
  });

export const supprimerOffre = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("offres").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const SCHEMA_CV = {
  type: "object",
  required: ["metier", "ville", "experience", "competences", "resume"],
  properties: {
    metier: { type: "string" },
    ville: { type: "string" },
    experience: { type: "integer" },
    competences: {
      type: "array",
      items: { type: "string" },
    },
    resume: { type: "string" },
  },
} as const;
``

/** Téléverse un CV ou des TDR : extrait le texte, remplit le profil ou crée une offre analysée. */
export const televerserDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        type: z.enum(["cv", "tdr"]),
        nom: z.string().min(1),
        contenu: z.string().min(10), // base64
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const binaire = Uint8Array.from(atob(data.contenu), (c) => c.charCodeAt(0));
    let texte = "";
    if (data.nom.toLowerCase().endsWith(".pdf")) {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(binaire);
      const extrait = await extractText(pdf, { mergePages: true });
      texte = Array.isArray(extrait.text) ? extrait.text.join("\n") : extrait.text;
    } else {
      texte = new TextDecoder().decode(binaire);
    }
    texte = texte.replace(/\s+\n/g, "\n").trim();
    if (texte.length < 40) {
      throw new Error(
        "Impossible de lire ce document. Envoyez un PDF contenant du texte (pas une photo) ou un fichier .txt.",
      );
    }

    const chemin = `${userId}/${Date.now()}-${data.nom.replace(/[^\w.\-]/g, "_")}`;
    await supabase.storage.from("documents").upload(chemin, binaire, {
      contentType: data.nom.toLowerCase().endsWith(".pdf") ? "application/pdf" : "text/plain",
      upsert: true,
    });
    await supabase.from("documents").insert({
      user_id: userId,
      type: data.type,
      nom: data.nom,
      chemin,
      texte: texte.slice(0, 40000),
    });

    if (data.type === "cv") {
      const { jsonIA } = await import("@/lib/ai.server");
      const extrait = await jsonIA<{
        metier: string;
        ville: string;
        experience: number;
        competences: string[];
        resume: string;
      }>({
        system:
          "Tu extrais en français les informations clés d'un CV. Le résumé fait 3 phrases maximum.",
        prompt: texte.slice(0, 20000),
        schema: SCHEMA_CV as unknown as Record<string, unknown>,
        nomSchema: "extrait_cv",
      });
      const { error } = await supabase
        .from("profiles")
        .update({
          metier: extrait.metier,
          ville: extrait.ville,
          experience: extrait.experience,
          competences: extrait.competences,
          cv_texte: texte.slice(0, 40000),
          cv_resume: extrait.resume,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
      if (error) throw new Error(error.message);
      return { type: "cv" as const, resume: extrait.resume };
    }

    const profil = texteProfil(await lireProfil(supabase, userId));
    const { notes, rapport, score } = await analyser(texte, profil);
    const { data: creee, error } = await supabase
      .from("offres")
      .insert({
        user_id: userId,
        source: "TDR téléversés",
        titre: data.nom.replace(/\.[^.]+$/, ""),
        entreprise: "Document téléversé",
        ville: "",
        contrat: "À préciser",
        mode: "Sur site",
        description: texte.slice(0, 20000),
        url: "",
        date_limite: "",
        notes,
        score,
        rapport,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { type: "tdr" as const, id: (creee as { id: string }).id, score };
  });
