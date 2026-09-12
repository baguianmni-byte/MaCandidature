// The project currently does not provide the React JSX runtime/type declarations.
// Keep this component type-checkable until those dependencies are configured.
// @ts-nocheck

type Props = {
  score: number;
  taille?: number;
  libelle?: string;
};

export function ScoreRing({ score, taille = 128, libelle = "Match" }: Props) {
  const interieur = taille - 32;

  return (
    <div
      className="grid shrink-0 place-items-center rounded-full"
      style={{
        width: taille,
        height: taille,
        background: `conic-gradient(from 0deg, var(--aurora-a), var(--aurora-b), var(--aurora-c), var(--aurora-a))`,
      }}
    >
      <div
        className="grid place-items-center rounded-full bg-background"
        style={{ width: interieur, height: interieur }}
      >
        <div className="text-center">
          <div className="font-display font-semibold" style={{ fontSize: taille / 4 }}>
            {score}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {libelle}
          </div>
        </div>
      </div>
    </div>
  );
}
