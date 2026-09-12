import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  normaliserNotes,
  normaliserRapport,
  scoreDe,
  type Notes,
  type Offre,
} from "@/lib/monjob";

const COLONNES =
  "id, source, titre, entreprise, ville, contrat, mode, description, url, date_limite, notes, score, rapport, created_at";

type Ligne = Record<string, unknown>;

function versOffre(l: Ligne): Offre {
  const notes = normaliserNotes(l["notes"]);
  return {
    id: String(l["id"]),
    source: String(l["source"] ?? ""),
    titre: String(l["titre"] ?? ""),
    entreprise: String(l["entreprise"] ?? ""),
    ville: String(l["ville"] ?? ""),
    contrat: String(l["contrat"] ?? ""),
    mode: String(l["mode"] ?? ""),
    description: String(l["description"] ?? ""),
    url: String(l["url"] ?? ""),
    date_limite: String(l["date_limite"] ?? ""),
    notes,
    score: Number(l["score"] ?? scoreDe(notes)),
    rapport: normaliserRapport(l["rapport"]),
    created_at: String(l["created_at"] ?? ""),
  };
}

export function useOffres() {
  const [offres, setOffres] = useState<Offre[]>([]);
  const [charge, setCharge] = useState(false);

  const recharger = useCallback(async () => {
    const { data } = await supabase
      .from("offres")
      .select(COLONNES)
      .order("score", { ascending: false });
    setOffres(((data ?? []) as Ligne[]).map(versOffre));
    setCharge(true);
  }, []);

  useEffect(() => {
    void recharger();
  }, [recharger]);

  return { offres, charge, recharger };
}

export function useOffre(id: string) {
  const [offre, setOffre] = useState<Offre | null>(null);
  const [charge, setCharge] = useState(false);

  const recharger = useCallback(async () => {
    const { data } = await supabase.from("offres").select(COLONNES).eq("id", id).maybeSingle();
    setOffre(data ? versOffre(data as Ligne) : null);
    setCharge(true);
  }, [id]);

  useEffect(() => {
    void recharger();
  }, [recharger]);

  const majNotes = useCallback((notes: Notes) => {
    setOffre((o) => (o ? { ...o, notes, score: scoreDe(notes) } : o));
  }, []);

  return { offre, charge, recharger, majNotes };
}
