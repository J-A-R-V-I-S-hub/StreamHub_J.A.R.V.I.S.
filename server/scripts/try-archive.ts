import { fetchArchiveEntries } from "../src/ingest/archive.ts";

const limit = Number(process.argv[2] ?? 8);
const collection = process.argv[3] ?? "feature_films";
const minHeight = Number(process.argv[4] ?? 0);

const t0 = Date.now();
const items = await fetchArchiveEntries({ collection, limit, minHeight });
console.log(`  ${items.length} titoli (min ${minHeight || "nessuno"}px) in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
for (const i of items) {
  const file = decodeURIComponent(i.url.split("/").pop()!);
  console.log("  -", String(i.year ?? "----"), "|", i.name.slice(0, 38).padEnd(38), "|", file.slice(0, 34));
}
