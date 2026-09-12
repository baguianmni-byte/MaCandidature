const URL_IA =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent";

export async function jsonIA<T>(options: {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  nomSchema: string;
}): Promise<T> {
  const cle = process.env["GEMINI_API_KEY"];

  if (!cle) {
    throw new Error("Le service d'analyse n'est pas configuré.");
  }

  const reponse = await fetch(`${URL_IA}?key=${cle}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: options.system }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: options.prompt }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: options.schema,
      },
    }),
  });

  if (!reponse.ok) {
    const texte = await reponse.text();

    if (reponse.status === 429) {
      throw new Error(
        "Trop de demandes d'analyse à la suite. Réessayez dans une minute."
      );
    }

    throw new Error(
      `L'analyse a échoué (${reponse.status}). ${texte.slice(0, 200)}`
    );
  }

  const data = await reponse.json();

  const contenu =
    data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!contenu) {
    throw new Error("L'analyse n'a renvoyé aucun résultat.");
  }

  return JSON.parse(contenu) as T;
}