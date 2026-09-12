import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { profilParDefaut, type Offre, type Profil } from "@/lib/monjob";

type LigneProfil = {
  prenom: string | null;
  metier: string | null;
  ville: string | null;
  experience: number | null;
  mode_prefere: string | null;
  competences: string[] | null;
};

export function useProfil() {
  const [profil, setProfil] = useState<Profil>(profilParDefaut);
  const [charge, setCharge] = useState(false);

  useEffect(() => {
    let actif = true;
    (async () => {
      const { data: session } = await supabase.auth.getUser();
      const utilisateur = session.user;
      if (!utilisateur) {
        if (actif) setCharge(true);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("prenom, metier, ville, experience, mode_prefere, competences")
        .eq("id", utilisateur.id)
        .maybeSingle();
      if (!actif) return;
      const ligne = data as LigneProfil | null;
      if (ligne) {
        setProfil({
          prenom: ligne.prenom || profilParDefaut.prenom,
          metier: ligne.metier || profilParDefaut.metier,
          ville: ligne.ville || profilParDefaut.ville,
          experience: ligne.experience ?? profilParDefaut.experience,
          modePrefere: (ligne.mode_prefere as Offre["mode"]) || profilParDefaut.modePrefere,
          competences: ligne.competences?.length ? ligne.competences : profilParDefaut.competences,
        });
      }
      setCharge(true);
    })();
    return () => {
      actif = false;
    };
  }, []);

  const enregistrer = useCallback(async (maj: Profil) => {
    setProfil(maj);
    const { data: session } = await supabase.auth.getUser();
    if (!session.user) return;
    await supabase.from("profiles").upsert({
      id: session.user.id,
      prenom: maj.prenom,
      metier: maj.metier,
      ville: maj.ville,
      experience: maj.experience,
      mode_prefere: maj.modePrefere,
      competences: maj.competences,
    });
  }, []);

  return { profil, enregistrer, charge };
}
