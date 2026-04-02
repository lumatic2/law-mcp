import { LawGoProvider } from "./providers/lawgo-provider.js";

async function main(): Promise<void> {
  const provider = new LawGoProvider();
  const search = await provider.searchLaw("소득세", { limit: 3 });
  console.log("search_law:", JSON.stringify(search, null, 2));

  const lawId = search.items[1]?.law_id ?? search.items[0]?.law_id;
  if (!lawId) throw new Error("law_id not found from search result.");

  const article = await provider.getLawArticle(lawId, "1");
  console.log("get_law_article:", JSON.stringify(article, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
