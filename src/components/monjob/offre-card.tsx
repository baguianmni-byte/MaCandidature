// @ts-nocheck

import { Link } from "@tanstack/react-router";
import { palierDe, type Offre } from "@/lib/monjob";
import { marqueDe } from "./marks";

function couleurScore(score: number) {
  if (score >= 80) return "bg-aurora-c/15 text-aurora-c";
  if (score >= 60) return "bg-aurora-b/15 text-aurora-b";
  return "bg-aurora-a/15 text-aurora-a";
}

export function OffreCard({ offre }: { offre: Offre }) {
  return (
    <Link
      to="/offres/$id"
      params={{ id: offre.id }}
      className="glass-soft flex items-center gap-4 rounded-2xl p-4 transition-colors hover:bg-secondary/40"
    >
      <img
        src={marqueDe(offre.entreprise)}
        alt=""
        loading="lazy"
        width={512}
        height={512}
        className="size-12 shrink-0 rounded-xl object-cover"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate font-medium">{offre.titre}</p>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${couleurScore(offre.score)}`}
          >
            {offre.score}/100
          </span>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {offre.entreprise} · {offre.ville || "Burkina Faso"}
        </p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {palierDe(offre.score).libelle}
        </p>
      </div>
    </Link>
  );
}
