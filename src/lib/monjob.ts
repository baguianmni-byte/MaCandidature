// ==========================================
// 1. DÉFINITION DES CRITÈRES & DU SCORING
// ==========================================

export type CritereId =
  | "remuneration"
  | "adequation"
  | "organisation"
  | "evolution"
  | "stabilite"
  | "conditions"
  | "alignement"
  | "diplome";

export type Critere = {
  id: CritereId;
  libelle: string;
  regarde: string;
  poids: number;
};

export type Notes = Record<CritereId, number>;

export const criteres: Critere[] = [
  {
    id: "remuneration",
    libelle: "Rémunération & avantages",
    regarde: "Salaire net, primes, assurance santé, indemnités, prise en charge des frais",
    poids: 0.2,
  },
  {
    id: "adequation",
    libelle: "Adéquation poste / profil",
    regarde: "Correspondance avec votre expertise et vos compétences",
    poids: 0.15,
  },
  {
    id: "organisation",
    libelle: "Organisation & réputation",
    regarde: "Solidité financière, réputation sectorielle, légitimité de la structure",
    poids: 0.15,
  },
  {
    id: "evolution",
    libelle: "Évolution & apprentissage",
    regarde: "Perspectives de carrière, montée en compétences, formation",
    poids: 0.1,
  },
  {
    id: "stabilite",
    libelle: "Stabilité du contrat",
    regarde: "CDD/CDI, durée du financement du projet, sécurité de l'emploi",
    poids: 0.15,
  },
  {
    id: "conditions",
    libelle: "Conditions de travail",
    regarde: "Lieu, déplacements, charge de travail, équilibre",
    poids: 0.1,
  },
  {
    id: "alignement",
    libelle: "Alignement missionnel",
    regarde: "Cohérence avec vos valeurs et votre trajectoire professionnelle",
    poids: 0.1,
  },
  {
    id: "diplome",
    libelle: "Écart diplôme / exigences",
    regarde: "5 = aucun écart (diplôme requis acquis ou non exigé) ; 1 = écart important",
    poids: 0.05,
  },
];

export const notesParDefaut: Notes = {
  remuneration: 3,
  adequation: 3,
  organisation: 3,
  evolution: 3,
  stabilite: 3,
  conditions: 3,
  alignement: 3,
  diplome: 3,
};

export function normaliserNotes(valeur: unknown): Notes {
  const source = (valeur ?? {}) as Partial<Record<CritereId, unknown>>;
  const notes = { ...notesParDefaut };
  for (const c of criteres) {
    const n = Number(source[c.id]);
    if (Number.isFinite(n) && n >= 1 && n <= 5) notes[c.id] = Math.round(n);
  }
  return notes;
}

// ==========================================
// 2. TYPES DE RAPPORTS & D'OFFRES
// ==========================================

export type Rapport = {
  resume: string;
  adequation: string;
  points_forts: string[];
  ecarts: string[];
  conseil: string;
};

export const rapportVide: Rapport = {
  resume: "",
  adequation: "",
  points_forts: [],
  ecarts: [],
  conseil: "",
};

export function normaliserRapport(valeur: unknown): Rapport {
  const s = (valeur ?? {}) as Partial<Rapport>;
  return {
    resume: typeof s.resume === "string" ? s.resume : "",
    adequation: typeof s.adequation === "string" ? s.adequation : "",
    points_forts: Array.isArray(s.points_forts) ? s.points_forts.map(String) : [],
    ecarts: Array.isArray(s.ecarts) ? s.ecarts.map(String) : [],
    conseil: typeof s.conseil === "string" ? s.conseil : "",
  };
}

export type Offre = {
  id: string;
  source: string;
  titre: string;
  entreprise: string;
  ville: string;
  contrat: string;
  mode: string;
  description: string;
  url: string;
  date_limite: string;
  notes: Notes;
  score: number;
  rapport: Rapport;
  created_at: string;
};

// ==========================================
// 3. DU PROFIL À L'ÉVALUATION PAR PALIERS
// ==========================================

export type Profil = {
  prenom: string;
  metier: string;
  ville: string;
  experience: number;
  modePrefere: string;
  competences: string[];
};

export const profilParDefaut: Profil = {
  prenom: "",
  metier: "",
  ville: "Ouagadougou",
  experience: 0,
  modePrefere: "Hybride",
  competences: [],
};

export type Palier = { libelle: string; conseil: string };

export function palierDe(score: number): Palier {
  if (score >= 80)
    return {
      libelle: "Offre très solide, à privilégier",
      conseil: "Cette offre est à placer en tête de vos candidatures.",
    };
  if (score >= 60)
    return {
      libelle: "Offre correcte",
      conseil: "Vérifiez les critères les plus faibles avant de vous décider.",
    };
  if (score >= 40)
    return {
      libelle: "Offre moyenne",
      conseil: "À considérer seulement en l'absence de meilleure option.",
    };
  return {
    libelle: "Offre peu intéressante",
    conseil: "Les critères essentiels ne sont pas réunis.",
  };
}

export type DetailCritere = { critere: Critere; note: number; contribution: number };

export function detailsDe(notes: Notes): DetailCritere[] {
  return criteres.map((critere) => ({
    critere,
    note: notes[critere.id],
    contribution: Math.round(notes[critere.id] * critere.poids * 20),
  }));
}

export function scoreDe(notes: Notes): number {
  return Math.round(criteres.reduce((s, c) => s + notes[c.id] * c.poids, 0) * 20);
}

export function moyenneDesScores(offres: { score: number }[]): number {
  if (offres.length === 0) return 0;
  return Math.round(offres.reduce((s, o) => s + o.score, 0) / offres.length);
}

// ==========================================
// 4. INTÉGRATION DE LA RECHERCHE WEB (SUPABASE)
// ==========================================

export interface SearchResultItem {
  title: string;
  snippet: string;
  link: string;
  displayLink: string;
  isPdf: boolean;
}

/**
 * Convertit les résultats bruts renvoyés par la Edge Function 'search-jobs'
 * en objets 'Offre' structurés avec notes et score initial.
 */
export function convertirResultatsEnOffres(results: SearchResultItem[]): Offre[] {
  return results.map((item, index) => {
    // Extraction d'une entreprise approximative depuis le titre
    const partiesTitre = item.title.split(/[-|–]/);
    const titreNettoyé = partiesTitre[0]?.trim() || item.title;
    const entrepriseTrouvée = partiesTitre[1]?.trim() || item.displayLink;

    return {
      id: `web-job-${Date.now()}-${index}`,
      source: item.displayLink,
      titre: titreNettoyé,
      entreprise: entrepriseTrouvée,
      ville: "Ouagadougou",
      contrat: item.isPdf ? "TDR / Consultance (PDF)" : "Offre Web",
      mode: "Présentiel",
      description: item.snippet,
      url: item.link,
      date_limite: "",
      notes: { ...notesParDefaut },
      score: scoreDe(notesParDefaut), // Score de départ (60/100)
      rapport: { ...rapportVide },
      created_at: new Date().toISOString(),
    };
  });
}