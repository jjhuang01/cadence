import type { OnlineTrackRef } from "./types";

export const DEFAULT_CONTROLLED_CATALOG_LIMIT = 20;
const MAX_CONTROLLED_CATALOG_LIMIT = 50;

const CONTROLLED_CATALOG_ITEMS: OnlineTrackRef[] = [
  {
    sourceId: "controlled-demo",
    trackId: "blue-sky-drive",
    title: "Blue Sky Drive",
    artist: "SoundHelix",
    album: "Controlled Catalog Vol.1",
    streamUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  },
  {
    sourceId: "controlled-demo",
    trackId: "night-metro",
    title: "Night Metro",
    artist: "SoundHelix",
    album: "Controlled Catalog Vol.1",
    streamUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
  },
  {
    sourceId: "controlled-demo",
    trackId: "morning-dew",
    title: "Morning Dew",
    artist: "SoundHelix",
    album: "Controlled Catalog Vol.1",
    streamUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
  },
  {
    sourceId: "controlled-demo",
    trackId: "city-lights",
    title: "City Lights",
    artist: "SoundHelix",
    album: "Controlled Catalog Vol.2",
    streamUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
  },
  {
    sourceId: "controlled-demo",
    trackId: "silent-river",
    title: "Silent River",
    artist: "SoundHelix",
    album: "Controlled Catalog Vol.2",
    streamUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
  },
  {
    sourceId: "controlled-demo",
    trackId: "rain-letter",
    title: "Rain Letter",
    artist: "SoundHelix",
    album: "Controlled Catalog Vol.2",
    streamUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3",
  },
  {
    sourceId: "controlled-demo",
    trackId: "neon-runner",
    title: "Neon Runner",
    artist: "SoundHelix",
    album: "Controlled Catalog Vol.3",
    streamUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3",
  },
  {
    sourceId: "controlled-demo",
    trackId: "northern-wind",
    title: "Northern Wind",
    artist: "SoundHelix",
    album: "Controlled Catalog Vol.3",
    streamUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
  },
];

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

function toSearchableText(item: OnlineTrackRef): string {
  return [item.title, item.artist, item.album, item.sourceId, item.trackId]
    .filter((field): field is string => typeof field === "string" && field.length > 0)
    .join(" ")
    .toLowerCase();
}

function clampLimit(limit: number | undefined): number {
  if (typeof limit !== "number" || Number.isNaN(limit)) {
    return DEFAULT_CONTROLLED_CATALOG_LIMIT;
  }

  return Math.max(1, Math.min(MAX_CONTROLLED_CATALOG_LIMIT, Math.floor(limit)));
}

export function searchControlledCatalog(
  query: string,
  options: { limit?: number } = {},
): OnlineTrackRef[] {
  let normalizedQuery = normalizeQuery(query);

  if (!normalizedQuery) {
    return [];
  }

  let tokens = normalizedQuery.split(" ");
  let limit = clampLimit(options.limit);

  return CONTROLLED_CATALOG_ITEMS.filter((item) => {
    let searchable = toSearchableText(item);
    return tokens.every((token) => searchable.includes(token));
  }).slice(0, limit);
}
