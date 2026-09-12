
export function marqueDe(entreprise: string) {
  const somme = entreprise
    .split("")
    .reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const marques = entreprise ? [entreprise] : [""];
  return marques[somme % marques.length] as string;
}
