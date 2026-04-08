// Brand detection for the smart-filtered FatSecret RAG.
//
// Rationale: a benchmark run with unconditional FatSecret RAG showed -6
// macro_aggregate and -7 judge_overall vs no-RAG, because FatSecret returns
// noisy results for generic queries (e.g. "Big Mac" pulls Potbelly's
// "Smokestack Pork & Mac Sandwich" as a similar food, which derails the
// model). RAG helps ONLY when the user query clearly references a brand
// or an iconic branded dish — then FatSecret has authoritative data and
// the noise is worth it.
//
// This list is curated for US market (Nov 2025). Add to it as we see real
// queries miss. Each entry is matched as a case-insensitive substring.

const US_BRAND_KEYWORDS: readonly string[] = [
  // Fast food
  "mcdonald", "mcdonalds", "mcdonald's",
  "burger king", "whopper",
  "wendy", "wendys", "wendy's", "baconator", "frosty",
  "taco bell", "crunchwrap", "chalupa",
  "kfc",
  "subway",
  "in-n-out", "in n out", "double-double", "double double", "animal style",
  "five guys",
  "chick-fil-a", "chick fil a",
  "chipotle",
  "panera",
  "sweetgreen",
  "shake shack", "shackburger",
  "whataburger",
  "jack in the box",
  "arby", "arbys", "arby's",
  "sonic drive",
  "popeye", "popeyes", "popeye's",
  "raising cane",
  "jersey mike",
  "panda express", "orange chicken",
  // Coffee / drinks
  "starbucks", "frappuccino", "macchiato", "pike place",
  "dunkin", "dunkin'",
  "tim horton",
  "peet's coffee", "peets coffee",
  // Pizza
  "domino", "dominos", "domino's",
  "pizza hut",
  "papa john",
  "little caesar",
  "papa murphy",
  "blaze pizza",
  // Casual dining
  "chili's", "chilis",
  "applebee",
  "olive garden",
  "outback steakhouse",
  "texas roadhouse",
  "cheesecake factory",
  "ihop",
  "denny's", "dennys",
  "cracker barrel",
  "buffalo wild wing",
  "red robin",
  "tgi friday", "tgi fridays",
  "p.f. chang", "pf chang",
  "the capital grille",
  // Snacks / CPG
  "ben & jerry", "ben and jerry",
  "haagen", "häagen",
  "talenti",
  "halo top",
  "cheetos", "doritos", "pringles", "fritos",
  "oreo", "chips ahoy",
  "lay's", "lays",
  "goldfish cracker",
  "annie's", "annies",
  "kind bar", "kind protein",
  "clif bar", "clif",
  "rxbar", "rx bar",
  "quest bar", "quest protein",
  "pop-tart", "pop tart",
  // Plant / health
  "beyond burger", "beyond meat", "beyond chicken",
  "impossible burger", "impossible meat", "impossible whopper",
  "morningstar",
  // Retailers w/ prepared foods
  "trader joe", "trader joe's", "tj's",
  "whole foods",
  "costco",
  "sam's club", "sams club",
  "wegmans",
  "publix",
  "kroger",
  // Beverages
  "coca-cola", "coca cola", "diet coke", "coke zero",
  "pepsi",
  "dr pepper", "dr. pepper",
  "mountain dew",
  "sprite", "fanta",
  "red bull",
  "monster energy",
  "celsius",
  "la croix",
  "liquid death",
  "athletic greens", "ag1",
  "bloom nutrition",
  "olipop", "poppi",
  "gatorade", "powerade",
  "vitamin water",
  // Cereal / breakfast
  "cheerios", "frosted flakes", "lucky charms",
  "kellogg",
  "general mills",
  "kashi",
  // Protein / supplements
  "vital proteins",
  "optimum nutrition",
  "premier protein",
  "muscle milk",
  "fairlife",
  "core power",
  "owyn",
  // Frozen
  "stouffer", "lean cuisine", "healthy choice",
  "amy's kitchen", "amys kitchen",
  "digiorno",
  "tombstone pizza",
  "totino",
  "hot pocket",
  // Dairy alternatives
  "oatly",
  "silk milk", "silk almond", "silk soy", "silk oat",
  "almond breeze",
  "califia",
  "chobani",
  "fage",
  "siggi",
  // Bars / candy
  "snickers", "twix", "kit kat", "kitkat",
  "reese", "reese's",
  "hershey",
  "m&m", "m&ms",
  "milky way",
  "butterfinger",
  // Bakery / chains
  "krispy kreme",
  "cinnabon",
  "auntie anne",
  "pretzelmaker",
];

/**
 * Returns true if the query likely references a US brand or branded dish.
 * Used to gate FatSecret RAG: skip RAG for generic queries to avoid noise.
 */
export function containsBrand(query: string): boolean {
  if (!query) return false;
  const lower = query.toLowerCase();
  for (const kw of US_BRAND_KEYWORDS) {
    if (lower.includes(kw)) return true;
  }
  return false;
}
