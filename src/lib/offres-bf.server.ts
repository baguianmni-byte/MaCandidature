// aggregator.ts
import fetch from "node-fetch";
import { parseStringPromise } from "xml2js";
import * as cheerio from "cheerio";
import crypto from "crypto";
import pLimit from "p-limit";
import FirecrawlApp from "@mendable/firecrawl-js";
import { chromium, Browser } from "playwright";

const firecrawl = new FirecrawlApp({
  apiKey: process.env["FIRECRAWL_API_KEY"] ?? "",
});

function cleanUrl(raw: string): string {
  if (!raw) {
    return "";
  }

  const href = raw.match(
    /href="([^"]+)"/i,
  );

  if (href?.[1]) {
    return href[1];
  }

  return raw
    .replace(/<[^>]*>/g, "")
    .replace(/['",]+$/g, "")
    .trim();
}

// heuristique pour déterminer si Firecrawl est disponible
let firecrawlAvailable = true;

// heuristique pour déterminer si l'erreur est un rate limit de Firecrawl
function isFirecrawlRateLimit(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : String(error);

  return (
    message.includes("rate limit") ||
    message.includes("credits") ||
    message.includes("429") ||
    message.includes("free tier")
  );
}

// heuristique pour déterminer si le site nécessite Playwright
function requiresPlaywright(
  url: string,
): boolean {
  return [
    "linkedin.com",
    "facebook.com",
    "m.facebook.com",
    "indeed.com",
    "glassdoor.com",
  ].some((domain) =>
    url.includes(domain),
  );
}

//Logger pour les erreurs de scraping
function logScrapingError(
  source: string,
  url: string,
  error: unknown,
) {
  console.error({
    source,
    url,
    timestamp: new Date().toISOString(),
    error:
      error instanceof Error
        ? error.message
        : String(error),
  });
}

// Timeout wrapper for promises
async function withTimeout<T>(
  promise: Promise<T>,
  ms = 30000,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              `Timeout après ${ms}ms`,
            ),
          ),
        ms,
      ),
    ),
  ]);
}

export type OffreBrute = {
  titre: string;
  entreprise: string;
  ville: string;
  pays: string;
  description: string;
  url: string;
  date_limite: string; // ISO or empty
  source: string;
  hash: string;
};

//retry function for network requests
async function retry<T>(
  fn: () => Promise<T>,
  retries = 3,
): Promise<T> {
  let lastError: unknown;

  for (
    let i = 0;
    i < retries;
    i++
  ) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            (i + 1) * 2000,
          ),
      );
    }
  }

  throw lastError;
}



const USER_AGENT = "...";

const SOURCES: { name: string; type: "rss" | "api" | "html"; url: string }[] = [
  { name: "ReliefWeb Jobs", type: "rss", url: "https://reliefweb.int/jobs/rss.xml?advanced-search=%28C46%29" },
  // Ajouter ici les flux RSS/API/sites locaux
  { name: "Acted Job", type: "html", url: "https://www.acted.org/fr/mobilisation/rejoignez-nous/" },
  { name: "UNJobs", type: "html", url: "https://unjobs.org/" },
  { name: "UN Careers", type: "html", url: "https://careers.un.org/jobopening?language=en" },
  {name : "alertjob", type: "html",url: "https://alertejob.org/job-list/"},
  // { name: "EmploiBurkina RSS", type: "rss", url: "https://emploiburkina.example/rss" },
];

function hashOffre(o: Partial<OffreBrute>) {
  const s = `${o.titre ?? ""}|${o.entreprise ?? ""}|${o.url ?? ""}|${o.date_limite ?? ""}`;
  return crypto.createHash("sha256").update(s).digest("hex");
}

function decodeHtmlEntities(text: string) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function stripHtml(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<\/(p|li|div|h\d)>/gi, "\n")
      .replace(/<li[^>]*>/gi, "- ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

async function fetchText(url: string) {
  const res = await withTimeout(
    fetch(url, {
      headers: {
        "User-Agent":
          USER_AGENT,
      },
   }),
    30000,
  );
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

// Scraping avec Playwright pour les sites dynamiques
async function scrapeWithPlaywright(
  url: string,
): Promise<string> {
  let browser: Browser | null =
    null;

  try {
    browser =
      await chromium.launch({
        headless: true,
      });

    const page =
      await browser.newPage({
        userAgent: USER_AGENT,
      });

    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 45000,
    });

    await page.waitForTimeout(
      3000,
    );

    const content =
      (await page
        .locator("body")
        .textContent()) ?? "";

    return content.trim();
  } catch (error) {
    logScrapingError(
      "Playwright",
      url,
      error,
    );

    return "";
  } finally {
    try {
      await browser?.close();
    } catch {}
  }
}

// Scraping avec Firecrawl, fallback vers Playwright si échec
async function scrapeUrlSmart(rawUrl: string,): Promise<string> {
  const url = cleanUrl(rawUrl);
  if (!url) {
    return "";
  }
  console.log(
    "Scraping URL:",
    url,
  );

  if (!firecrawlAvailable) {
    return scrapeWithPlaywright(url);
  }
  /* if (requiresPlaywright(url)) {
    return scrapeWithPlaywright(url,
    );
  } */
  try {
	    const page: any = await firecrawl.scrapeUrl(
	    url,
	    {
		    formats: ["markdown"],
	    },
	    );

    const markdown = page?.markdown ??page?.data?.markdown ??"";
/*     if (
      markdown &&
      markdown.trim()
    ) {
      return markdown;
    } */
    return (
      page?.markdown ??
      page?.data?.markdown ??
      ""
	  );
//    return await scrapeWithPlaywright(url,
//    );

} catch (error) {
	  if (
		  isFirecrawlRateLimit(
		  	error,
		  )
	  ) {

	  console.warn(
		  "Quota Firecrawl atteint : désactivation"
	  );

	  firecrawlAvailable =
	    false;
	  }
	  return scrapeWithPlaywright(
		  url,
	  );
  }
}

async function parseRss(url: string, sourceName: string): Promise<OffreBrute[]> {
  const xml = await fetchText(url);
  const parsed = await parseStringPromise(xml, { explicitArray: false, trim: true });
  const items = parsed.rss?.channel?.item ? (Array.isArray(parsed.rss.channel.item) ? parsed.rss.channel.item : [parsed.rss.channel.item]) : [];
  return items.map((it: any) => {
    const descriptionRaw = it.description ?? "";
    const { org = "", city = "", country = "", closing = "" } = extractFromDescription(descriptionRaw);
    const dateIso = parseDateTextToISO(closing);
    const paysGuess = country || (descriptionRaw.match(/Burkina\s*Faso/i) ? "Burkina Faso" : "");
    const offre: OffreBrute = {
      titre: it.title ?? "",
      entreprise: org || "",
      ville: city || "",
      pays: paysGuess,
      description: stripHtml(descriptionRaw).slice(0, 12000),
      url: it.link ?? "",
      date_limite: dateIso,
      source: sourceName,
      hash: "",
    };
    offre.hash = hashOffre(offre);
    return offre;
  });
}

async function parseHtmlList(url: string, sourceName: string): Promise<OffreBrute[]> {
  const html = await fetchText(url);
  const $ = cheerio.load(html);
  const results: OffreBrute[] = [];
  // Exemple générique : adapter les sélecteurs selon le site
  $(".job-listing, .job-item, article.job").each((_, el) => {
    const title = $(el).find("h2, .title, a").first().text().trim();
    const link = $(el).find("a").first().attr("href") ?? "";
    const company = $(el).find(".company, .employer").text().trim();
    const location = $(el).find(".location, .city").text().trim();
    const desc = $(el).find(".description, .summary").text().trim();
    const closingText = $(el).find(".closing, .deadline").text().trim();
    const dateIso = parseDateTextToISO(closingText);
    const paysGuess = /Burkina\s*Faso/i.test(location + " " + desc) ? "Burkina Faso" : "";
    const offre: OffreBrute = {
      titre: title || "",
      entreprise: company || "",
      ville: location || "",
      pays: paysGuess,
      description: stripHtml(desc).slice(0, 12000),
      url: link.startsWith("http") ? link : new URL(link, url).toString(),
      date_limite: dateIso,
      source: sourceName,
      hash: "",
    };
    offre.hash = hashOffre(offre);
    results.push(offre);
  });
  return results;
}

/** heuristiques d'extraction depuis description (pattern ReliefWeb-like) */
function extractFromDescription(brut: string) {
  const org = brut.match(/Organization:\s*([^<\n]+)/i)?.[1]?.trim() ?? "";
  const city = brut.match(/City:\s*([^<\n]+)/i)?.[1]?.trim() ?? "";
  const country = brut.match(/Country:\s*([^<\n]+)/i)?.[1]?.trim() ?? "";
  const closing = brut.match(/Closing date:\s*([^<\n]+)/i)?.[1]?.trim() ?? "";
  return { org, city, country, closing };
}

/** parse date text to ISO (simple heuristics) */
function parseDateTextToISO(text: string) {
  if (!text) return "";
  const cleaned = text.replace(/\u00A0/g, " ").trim();
  const parsed = Date.parse(cleaned);
  if (!isNaN(parsed)) return new Date(parsed).toISOString();
  const m = cleaned.match(/(\d{1,2})[\/\-\s](\d{1,2})[\/\-\s](\d{2,4})/);
  if (m) {
    const day = m[1];
    const month = m[2];
    let year = m[3];
    if (!day || !month || !year) return "";
    if (year.length === 2) year = "20" + year;
    const dt = new Date(Number(year), Number(month) - 1, Number(day));
    if (!isNaN(dt.getTime())) return dt.toISOString();
  }
  return "";
}

function isOpen(dateIso: string) {
  if (!dateIso) return true;
  const d = Date.parse(dateIso);
  if (isNaN(d)) return true;
  return d >= Date.now();
}

async function recupererOffresFirecrawl(
  metier: string,
): Promise<OffreBrute[]> {
  try {
    const recherche = [
      `"${metier}" Burkina Faso`,
      `"${metier}" Ouagadougou`,
      `"${metier}" Bobo-Dioulasso`,
      `${metier} ONG Burkina Faso`,
      `${metier} développement Burkina Faso`,
    ];

    const offres: OffreBrute[] = [];

    for (const query of recherche) {
      const result = await firecrawl.search(query) as any;
      const items = Array.isArray(result?.data)
        ? result.data
        : Array.isArray(result?.results)
          ? result.results
          : [];

      for (const item of items) {
        const offre: OffreBrute = {
          titre: item.title ?? "",
          entreprise: "",
          ville: "",
          pays: "Burkina Faso",
          description: item.description ?? "",
          url: item.url ?? "",
          date_limite: "",
          source: "Firecrawl",
          hash: "",
        };

        offre.hash = hashOffre(offre);
        offres.push(offre);
      }
    }

    return offres;
  } catch (error) {
    console.error("Erreur Firecrawl", error);
    return [];
  }
}

/** Orchestrateur principal */
export async function recupererToutesOffresBurkina(
  metier = "Chargé de projet",
): Promise<OffreBrute[]> {
  const limit = pLimit(5);

  // Sources existantes
  const tasks = SOURCES.map((s) =>
    limit(async () => {
      try {
        if (s.type === "rss") {
          return await parseRss(s.url, s.name);
        }

        if (s.type === "html") {
          return await parseHtmlList(s.url, s.name);
        }

        if (s.type === "api") {
          const txt = await fetchText(s.url);
          const json = JSON.parse(txt);

          return (json.items ?? []).map((it: any) => {
            const offre: OffreBrute = {
              titre: it.title ?? "",
              entreprise: it.company ?? "",
              ville: it.city ?? "",
              pays: it.country ?? "",
              description: stripHtml(it.description ?? "").slice(0, 12000),
              url: it.url ?? "",
              date_limite: parseDateTextToISO(it.closing ?? ""),
              source: s.name,
              hash: "",
            };

            offre.hash = hashOffre(offre);
            return offre;
          });
        }

        return [];
      } catch (err) {
        console.warn(`Erreur source ${s.name}:`, err);
        return [];
      }
    }),
  );

  // Recherche Firecrawl
  const firecrawlTask = limit(async () => {
    try {
      const requetes = [
        `${metier} Burkina Faso`,
        `${metier} Ouagadougou`,
        `${metier} ONG Burkina Faso`,
        `${metier} humanitaire Burkina Faso`,
        `${metier} développement Burkina Faso`,
      ];

      const offresFirecrawl: OffreBrute[] = [];

      for (const requete of requetes) {
        const result: any = await firecrawl.search(requete);

        const items =
          result?.web ??
          result?.results ??
          result?.searchResults ??
          [];

        for (const item of items) {
          let description = item.description ?? "";

          // Enrichissement par scrape
        try {
          if (item.url){
            const content = await scrapeUrlSmart(
              item.url,
            );
           if (content && content.trim()) {
              description = content;
            }
  }
} catch (error) {logScrapingError("SmartScraper",
    item.url ?? "", error,
  );
}

          const offre: OffreBrute = {
            titre: item.title ?? "",
            entreprise: "",
            ville: "",
            pays: "Burkina Faso",
            description: description.slice(0, 12000),
            url: item.url ?? "",
            date_limite: "",
            source: "Firecrawl",
            hash: "",
          };

          offre.hash = hashOffre(offre);
          offresFirecrawl.push(offre);
        }
      }

      return offresFirecrawl;
    } catch (err) {
      console.warn("Erreur Firecrawl :", err);
      return [];
    }
  });

  const [sourcesClassiques, offresFirecrawl] =
    await Promise.all([
      Promise.all(tasks),
      firecrawlTask,
    ]);

  const all = [
    ...sourcesClassiques.flat(),
    ...offresFirecrawl,
  ];

  // Burkina Faso uniquement
  const filtered = all.filter(
    (o) =>
      /burkina/i.test(
        `${o.pays} ${o.ville} ${o.description} ${o.titre}`,
      ) && isOpen(o.date_limite),
  );

  // Déduplication
  const seen = new Set<string>();
  const dedup: OffreBrute[] = [];

  for (const offre of filtered) {
    if (!seen.has(offre.hash)) {
      seen.add(offre.hash);
      dedup.push(offre);
    }
  }

  return dedup;
}
export const recupererOffresBurkina = recupererToutesOffresBurkina;

export const recupererOffresBF = recupererToutesOffresBurkina;

export const recupererOffresBurkinaData = recupererToutesOffresBurkina;