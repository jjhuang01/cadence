import type { Track } from "../types";

import type { SourceConfig } from "./sourceConfig";
import { searchMusic, searchNetease163, searchKuwo, searchKugou, searchQQMusic, searchViaLxApi, type MusicTrackRef } from "./musicSearch";

export function musicTrackRefToTrack(item: MusicTrackRef): Track {
  return {
    path: "",
    title: item.name,
    subtitle: item.artist,
    online_album: item.album || undefined,
    duration_secs: item.duration > 0 ? item.duration : undefined,
    is_online: true,
    online_id: item.id,
    online_source_id: item.source,
    online_stream_url: undefined,
  };
}

async function builtinSearch(platform: string, query: string, page: number): Promise<MusicTrackRef[]> {
  try {
    if (platform === "wy") return await searchNetease163(query, page);
    if (platform === "kw") return await searchKuwo(query, page);
    if (platform === "kg") return await searchKugou(query, page);
    if (platform === "tx") return await searchQQMusic(query, page);
  } catch {
    // built-in search failed; return empty so caller shows empty state
  }
  return [];
}

async function trySearchViaSource(apiBaseUrl: string, platform: string, query: string, page: number): Promise<MusicTrackRef[]> {
  try {
    const r = await searchViaLxApi(apiBaseUrl, platform, query, page);
    if (r.length > 0) return r;
  } catch { /* try GET */ }
  try {
    const r = await searchMusic(query, apiBaseUrl, platform, page);
    if (r.length > 0) return r;
  } catch { /* nothing */ }
  return [];
}

export async function searchCatalog(
  query: string,
  sourceConfig: SourceConfig,
  platform = "kw",
  page = 1,
): Promise<Track[]> {
  // 1. Try active source first
  const activeId = sourceConfig.activeSourceId;
  const activeMeta = activeId
    ? sourceConfig.loadedSources.find((s) => s.id === activeId)
    : sourceConfig.loadedSources.find((s) => s.apiBaseUrl);

  if (activeMeta?.apiBaseUrl) {
    const r = await trySearchViaSource(activeMeta.apiBaseUrl, platform, query, page);
    if (r.length > 0) return r.map(musicTrackRefToTrack);
  }

  // 2. Try other loaded sources in order
  for (const meta of sourceConfig.loadedSources) {
    if (!meta.apiBaseUrl || meta.id === activeMeta?.id) continue;
    const r = await trySearchViaSource(meta.apiBaseUrl, platform, query, page);
    if (r.length > 0) return r.map(musicTrackRefToTrack);
  }

  // 3. Legacy apiBaseUrl
  if (sourceConfig.apiBaseUrl) {
    try {
      const r = await searchMusic(query, sourceConfig.apiBaseUrl, platform, page);
      if (r.length > 0) return r.map(musicTrackRefToTrack);
    } catch { /* fall through */ }
  }

  // 4. Built-in fallback
  const fallback = await builtinSearch(platform, query, page);
  return fallback.map(musicTrackRefToTrack);
}
