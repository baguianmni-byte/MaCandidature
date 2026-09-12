import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Gestion des requêtes CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { 
      query, 
      location = "Burkina Faso", 
      fileTypeOnly = false,
      page = 1 
    } = await req.json();

    if (!query) {
      return new Response(
        JSON.stringify({ error: "Le terme de recherche 'query' (ex: métier, compétences) est requis." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("GOOGLE_SEARCH_API_KEY");
    const cx = Deno.env.get("GOOGLE_SEARCH_ENGINE_ID");

    if (!apiKey || !cx) {
      throw new Error("Les clés API Google (GOOGLE_SEARCH_API_KEY / GOOGLE_SEARCH_ENGINE_ID) ne sont pas configurées.");
    }

    // 1. Construction de la requête ciblant le marché de l'emploi au Burkina Faso
    let searchQuery = `"${query}" "${location}" (recrutement OR "offre d'emploi" OR TDR OR "avis de recrutement")`;
    
    if (fileTypeOnly) {
      searchQuery += " filetype:pdf";
    }

    // 2. Configuration des paramètres de l'API Google Custom Search
    const googleUrl = new URL("https://www.googleapis.com/customsearch/v1");
    googleUrl.searchParams.set("key", apiKey);
    googleUrl.searchParams.set("cx", cx);
    googleUrl.searchParams.set("q", searchQuery);
    googleUrl.searchParams.set("num", "10"); // Nombre de résultats par page
    googleUrl.searchParams.set("start", `${(page - 1) * 10 + 1}`); // Pagination
    
    // Filtres géographiques pour prioriser les résultats au Burkina Faso
    googleUrl.searchParams.set("gl", "bf");
    googleUrl.searchParams.set("cr", "countryBF");

    // 3. Appel de l'API Google
    const response = await fetch(googleUrl.toString());
    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    // 4. Nettoyage et structuration des résultats pour le Frontend
    const results = (data.items || []).map((item: any) => {
      const isPdf = item.link.toLowerCase().endsWith(".pdf") || 
                    item.mime === "application/pdf" || 
                    item.title.toLowerCase().includes("tdr");

      return {
        title: item.title,
        snippet: item.snippet,
        link: item.link,
        displayLink: item.displayLink,
        isPdf: isPdf,
        pagemap: item.pagemap || {},
      };
    });

    return new Response(
      JSON.stringify({ 
        results,
        totalResults: data.searchInformation?.totalResults || 0,
        page 
      }), 
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});