import test from "node:test";
import assert from "node:assert/strict";
import { fetchArchiveEntries, ARCHIVE_COLLECTIONS, ARCHIVE_MIN_HEIGHT } from "../src/ingest/archive.ts";

/** Finto Internet Archive: due item, uno con solo ogv (da scartare). */
function fakeIa(risposte: Record<string, unknown>): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = String(input);
    for (const [frammento, body] of Object.entries(risposte)) {
      if (url.includes(frammento)) {
        return new Response(JSON.stringify(body), { status: 200 });
      }
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
}

test("costruisce le voci dal search + files, e scarta chi non ha mp4", async () => {
  const fetchImpl = fakeIa({
    advancedsearch: {
      response: {
        docs: [
          { identifier: "film1", title: "Film Uno", year: "1954", description: "Una trama." },
          { identifier: "senzamp4", title: "Solo Ogv", year: "1930" },
        ],
      },
    },
    "metadata/film1/files": {
      result: [
        { name: "film1.ogv", format: "Ogg Video" },
        { name: "film1_512kb.mp4", format: "512Kb MPEG4" },
      ],
    },
    "metadata/senzamp4/files": { result: [{ name: "x.ogv", format: "Ogg Video" }] },
  });

  const items = await fetchArchiveEntries({
    collection: "feature_films",
    limit: 2,
    group: "Film (pubblico dominio)",
    fetchImpl,
  });

  assert.equal(items.length, 1, "chi non ha mp4 va scartato");
  const f = items[0];
  assert.equal(f.name, "Film Uno");
  assert.equal(f.year, 1954);
  assert.equal(f.plot, "Una trama.");
  assert.equal(f.group, "Film (pubblico dominio)");
  assert.equal(f.kind, "movie");
  // preferisce il file leggero
  assert.match(f.url, /film1_512kb\.mp4$/);
  assert.match(f.url, /^https:\/\/archive\.org\/download\/film1\//);
  // copertina di archive.org, senza chiavi API
  assert.equal(f.logo, "https://archive.org/services/img/film1");
});

test("se il search non risponde, l'errore è chiaro", async () => {
  await assert.rejects(
    () => fetchArchiveEntries({ collection: "x", limit: 1, fetchImpl: fakeIa({}) }),
    /Internet Archive HTTP 404/
  );
});

test("le collezioni dichiarate sono quelle verificate", () => {
  assert.deepEqual(Object.keys(ARCHIVE_COLLECTIONS).sort(), [
    "classic_tv",
    "feature_films",
    "more_animation",
    "open_hd",
    "silent_films",
  ]);
});

test("open_hd chiede almeno 720p", () => {
  assert.equal(ARCHIVE_MIN_HEIGHT.open_hd, 720);
});

test("sceglie il file a risoluzione più alta", async () => {
  const fetchImpl = fakeIa({
    advancedsearch: { response: { docs: [{ identifier: "f1", title: "F1" }] } },
    "metadata/f1/files": {
      result: [
        { name: "f1_512kb.mp4", format: "512Kb MPEG4", height: "360" },
        { name: "f1_1080p.mp4", format: "h.264 MPEG4", height: "1080" },
        { name: "f1_720p.mp4", format: "h.264 MPEG4", height: "720" },
      ],
    },
  });
  const items = await fetchArchiveEntries({ collection: "c", limit: 1, fetchImpl });
  assert.match(items[0].url, /f1_1080p\.mp4$/);
});

test("con minHeight 720 scarta chi resta sotto", async () => {
  const fetchImpl = fakeIa({
    advancedsearch: {
      response: { docs: [{ identifier: "sd", title: "Solo SD" }, { identifier: "hd", title: "HD" }] },
    },
    "metadata/sd/files": { result: [{ name: "sd.mp4", height: "360" }] },
    "metadata/hd/files": { result: [{ name: "hd.mp4", height: "1080" }] },
  });
  const items = await fetchArchiveEntries({ collection: "c", limit: 2, minHeight: 720, fetchImpl });
  assert.equal(items.length, 1);
  assert.equal(items[0].name, "HD");
});
