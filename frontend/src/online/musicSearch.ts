import { invoke } from '@tauri-apps/api/core';

interface ProxyResponse {
  status: number;
  text: string;
  ok: boolean;
}

export interface MusicTrackRef {
  id: string;
  name: string;
  artist: string;
  album: string;
  source: string;
  /** duration in seconds (may be 0 if unknown) */
  duration: number;
}

async function proxyGet(
  url: string,
  headers?: Record<string, string>,
): Promise<unknown> {
  const resp = await invoke<ProxyResponse>('proxy_http_request', {
    url,
    method: 'GET',
    headers: headers ?? null,
    body: null,
  });

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} from ${url}: ${resp.text.slice(0, 300)}`);
  }

  try {
    return JSON.parse(resp.text);
  } catch {
    return resp.text;
  }
}

function extractStringArray(v: unknown): string[] {
  if (!v) return [];
  if (typeof v === 'string') return [v];
  if (Array.isArray(v)) {
    return v.map((a) =>
      typeof a === 'string' ? a : String((a as Record<string, unknown>).name ?? a),
    );
  }
  return [];
}

function normalizeTrack(item: Record<string, unknown>, source: string): MusicTrackRef | null {
  const id = String(
    item.id ?? item.hash ?? item.songmid ?? item.rid ?? item.copyrightId ?? '',
  );
  const name = String(
    item.name ?? item.songName ?? item.title ?? item.musicName ?? '',
  );
  if (!id || !name) return null;

  const artistArr = Array.isArray(item.artists)
    ? extractStringArray(item.artists)
    : Array.isArray(item.ar)
    ? extractStringArray(item.ar)
    : [];
  const artist =
    artistArr.length > 0
      ? artistArr.join(' / ')
      : String(
          item.artist ?? item.artistName ?? item.singer ?? item.author ?? '',
        );

  const albumObj = item.album ?? item.al;
  const album =
    typeof albumObj === 'object' && albumObj !== null
      ? String((albumObj as Record<string, unknown>).name ?? '')
      : String(item.album ?? item.albumName ?? item.albumTitle ?? '');

  const raw = item.duration ?? item.dt ?? item.interval ?? item.timelength ?? item.DURATION ?? 0;
  const rawNum = typeof raw === 'number' ? raw : Number(raw) || 0;
  // NetEase dt is in ms; if > 3600 assume ms and convert
  const duration = rawNum > 3600 ? Math.round(rawNum / 1000) : rawNum;
  return { id, name, artist, album, source, duration };
}

function parseSearchData(data: unknown, source: string): MusicTrackRef[] {
  let list: unknown[] = [];

  if (Array.isArray(data)) {
    list = data;
  } else if (typeof data === 'object' && data !== null) {
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.data)) {
      list = d.data;
    } else if (Array.isArray(d.tracks)) {
      list = d.tracks;
    } else if (Array.isArray(d.songs)) {
      list = d.songs;
    } else if (typeof d.result === 'object' && d.result !== null) {
      const r = d.result as Record<string, unknown>;
      if (Array.isArray(r.songs)) list = r.songs;
    }
  }

  return list
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => normalizeTrack(item, source))
    .filter((t): t is MusicTrackRef => t !== null);
}

export async function searchMusic(
  keyword: string,
  apiBaseUrl: string,
  source: string,
  page = 1,
  limit = 30,
): Promise<MusicTrackRef[]> {
  const base = apiBaseUrl.replace(/\/$/, '');
  const url = `${base}/search?keyword=${encodeURIComponent(keyword)}&source=${source}&page=${page}&limit=${limit}`;
  const data = await proxyGet(url);
  return parseSearchData(data, source);
}

function parseLxSinger(singer: unknown): string {
  if (typeof singer === 'string') return singer;
  if (Array.isArray(singer)) {
    return singer
      .map((a) => (typeof a === 'string' ? a : String((a as Record<string, unknown>).name ?? '')))
      .filter(Boolean)
      .join(' / ');
  }
  return '';
}

function parseLxList(list: unknown[], source: string): MusicTrackRef[] {
  return list
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item): MusicTrackRef | null => {
      const id = String(item.id ?? item.hash ?? item.songmid ?? item.rid ?? '');
      const name = String(item.name ?? item.songname ?? item.songName ?? '');
      if (!id || !name) return null;
      const artist = parseLxSinger(item.singer ?? item.artist ?? item.artistName ?? '');
      const album = String(
        typeof item.album === 'object' && item.album !== null
          ? (item.album as Record<string, unknown>).name ?? ''
          : (item.album ?? item.albumName ?? ''),
      );
      const resolvedSource = String(item.source ?? source);
      const rawDur = item.interval ?? item.duration ?? item.dt ?? item.timelength ?? 0;
      const rawNum = typeof rawDur === 'number' ? rawDur : Number(rawDur) || 0;
      const duration = rawNum > 3600 ? Math.round(rawNum / 1000) : rawNum;
      return { id, name, artist, album, source: resolvedSource, duration };
    })
    .filter((t): t is MusicTrackRef => t !== null);
}

export async function searchViaLxApi(
  apiBaseUrl: string,
  source: string,
  keywords: string,
  page = 1,
  limit = 30,
): Promise<MusicTrackRef[]> {
  const base = apiBaseUrl.replace(/\/$/, '');
  const url = `${base}/search`;

  const resp = await invoke<ProxyResponse>('proxy_http_request', {
    url,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, keywords, page, limit }),
  });

  if (!resp.ok) {
    throw new Error(`搜索失败 HTTP ${resp.status}`);
  }

  let root: unknown;
  try {
    root = JSON.parse(resp.text);
  } catch {
    throw new Error('搜索接口返回了非法 JSON');
  }

  if (typeof root !== 'object' || root === null) return [];
  const r = root as Record<string, unknown>;

  // lx-music-api-server format: {status:1, data:{list:[...],total:N}}
  // alt format: {code:200, data:{list:[...],total:N}}  or {code:0, data:[...]}
  let list: unknown[] = [];
  const data = r.data;
  if (typeof data === 'object' && data !== null) {
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.list)) list = d.list;
    else if (Array.isArray(d.songs)) list = d.songs;
    else if (Array.isArray(data)) list = data as unknown[];
  } else if (Array.isArray(data)) {
    list = data;
  }

  if (list.length === 0 && Array.isArray(r.list)) list = r.list;

  return parseLxList(list, source);
}

export async function searchNetease163(
  keywords: string,
  page = 1,
  limit = 30,
): Promise<MusicTrackRef[]> {
  const offset = (page - 1) * limit;
  const url = `https://music.163.com/api/search/get/web?s=${encodeURIComponent(keywords)}&type=1&offset=${offset}&total=true&limit=${limit}`;
  const resp = await invoke<ProxyResponse>('proxy_http_request', {
    url,
    method: 'GET',
    headers: {
      'Referer': 'https://music.163.com',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
    body: null,
  });

  if (!resp.ok) {
    throw new Error(`网易云搜索 HTTP ${resp.status}`);
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(resp.text) as Record<string, unknown>;
  } catch {
    throw new Error('网易云搜索返回了非法 JSON');
  }

  if (data.code !== 200) {
    throw new Error(`网易云搜索错误码: ${String(data.code)}`);
  }

  const result = data.result as Record<string, unknown> | undefined;
  const songs = (result?.songs ?? []) as Array<Record<string, unknown>>;

  return songs
    .map((song): MusicTrackRef | null => {
      const id = String(song.id ?? '');
      const name = String(song.name ?? '');
      if (!id || !name) return null;

      const artists = Array.isArray(song.artists)
        ? (song.artists as Array<{ name?: string }>).map((a) => a.name ?? '').join(' / ')
        : String(song.artistName ?? '');

      const album =
        typeof song.album === 'object' && song.album !== null
          ? String((song.album as Record<string, unknown>).name ?? '')
          : '';

      const dtMs = typeof song.duration === 'number' ? song.duration
        : typeof song.dt === 'number' ? song.dt : 0;
      const duration = dtMs > 3600 ? Math.round(dtMs / 1000) : dtMs;
      return { id, name, artist: artists, album, source: 'wy', duration };
    })
    .filter((t): t is MusicTrackRef => t !== null);
}

export async function searchKuwo(
  keywords: string,
  page = 1,
  limit = 30,
): Promise<MusicTrackRef[]> {
  // Verified: search.kuwo.cn mobile API, ft=music returns NAME (not SONGNAME which is for MV)
  // pn is 0-indexed
  const url = `http://search.kuwo.cn/r.s?all=${encodeURIComponent(keywords)}&pn=${page - 1}&rn=${limit}&ft=music&newsearch=1&client=kt&cluster=0&strategy=2012&encoding=utf8&rformat=json&mobi=1&issubtitle=1`;
  const resp = await invoke<ProxyResponse>('proxy_http_request', {
    url,
    method: 'GET',
    headers: { 'Referer': 'https://www.kuwo.cn' },
    body: null,
  });
  if (!resp.ok) throw new Error(`酷我搜索 HTTP ${resp.status}`);

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(resp.text) as Record<string, unknown>;
  } catch {
    throw new Error('酷我搜索返回了非法 JSON');
  }

  const abslist = (data.abslist ?? []) as Array<Record<string, unknown>>;
  return abslist
    .map((song): MusicTrackRef | null => {
      const musicrid = String(song.MUSICRID ?? '');
      // MUSICRID format: "MUSIC_123456" → split by '_' to get numeric ID
      const parts = musicrid.split('_');
      const id = parts.length >= 2 ? parts[1] : musicrid;
      // ft=music returns NAME; ft=mv returns SONGNAME — use NAME with SONGNAME fallback
      const name = String(song.NAME ?? song.SONGNAME ?? '');
      if (!id || !name) return null;
      const artist = String(song.ARTIST ?? '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
      const album = String(song.ALBUM ?? '');
      const duration = Number(song.DURATION ?? 0) || 0;
      return { id, name, artist, album, source: 'kw', duration };
    })
    .filter((t): t is MusicTrackRef => t !== null);
}

export async function searchKugou(
  keywords: string,
  page = 1,
  limit = 30,
): Promise<MusicTrackRef[]> {
  // Verified: msearchcdn host; params plat/tagtype/version required; status===1 means success
  const url = `http://msearchcdn.kugou.com/api/v3/search/song?plat=0&keyword=${encodeURIComponent(keywords)}&tagtype=%E5%85%A8%E9%83%A8&pagesize=${limit}&page=${page}&version=9108`;
  const resp = await invoke<ProxyResponse>('proxy_http_request', {
    url,
    method: 'GET',
    headers: null,
    body: null,
  });
  if (!resp.ok) throw new Error(`酷狗搜索 HTTP ${resp.status}`);

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(resp.text) as Record<string, unknown>;
  } catch {
    throw new Error('酷狗搜索返回了非法 JSON');
  }

  // Response: {status:1, errcode:0, data:{info:[...], total:N}}
  if (data.status !== 1) {
    throw new Error(`酷狗搜索失败: status=${String(data.status)} errcode=${String(data.errcode)}`);
  }

  const info = ((data.data as Record<string, unknown> | undefined)?.info ?? []) as Array<Record<string, unknown>>;
  return info
    .map((song): MusicTrackRef | null => {
      const hash = String(song.hash ?? '');
      if (!hash) return null;
      // songname and singername are direct fields in the response
      const name = String(song.songname ?? '');
      const artist = String(song.singername ?? '');
      const album = String(song.album_name ?? '');
      if (!name) return null;
      // kugou duration is in ms
      const rawDur = Number(song.duration ?? 0) || 0;
      const duration = rawDur > 3600 ? Math.round(rawDur / 1000) : rawDur;
      return { id: hash, name, artist, album, source: 'kg', duration };
    })
    .filter((t): t is MusicTrackRef => t !== null);
}

export async function searchQQMusic(
  keywords: string,
  page = 1,
  limit = 30,
): Promise<MusicTrackRef[]> {
  const url = `https://c.y.qq.com/soso/fcgi-bin/client_search_cp?p=${page}&n=${limit}&w=${encodeURIComponent(keywords)}&format=json&inCharset=utf-8&outCharset=utf-8&cr=1&g_tk=5381&t=0`;
  const resp = await invoke<ProxyResponse>('proxy_http_request', {
    url,
    method: 'GET',
    headers: {
      'Referer': 'https://y.qq.com',
      'Origin': 'https://y.qq.com',
    },
    body: null,
  });
  if (!resp.ok) throw new Error(`QQ音乐搜索 HTTP ${resp.status}`);

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(resp.text) as Record<string, unknown>;
  } catch {
    throw new Error('QQ音乐搜索返回了非法 JSON');
  }

  if (data.code !== 0) throw new Error(`QQ音乐搜索错误码: ${String(data.code)}`);

  const songData = (data.data as Record<string, unknown> | undefined)?.song as Record<string, unknown> | undefined;
  const list = (songData?.list ?? []) as Array<Record<string, unknown>>;
  return list
    .map((song): MusicTrackRef | null => {
      const mid = String(song.songmid ?? '');
      const name = String(song.songname ?? '');
      if (!mid || !name) return null;
      const singers = Array.isArray(song.singer)
        ? (song.singer as Array<{ name?: string }>).map((s) => s.name ?? '').join(' / ')
        : '';
      const album = typeof song.album === 'object' && song.album !== null
        ? String((song.album as Record<string, unknown>).name ?? '')
        : '';
      // QQ Music interval is in seconds
      const duration = Number(song.interval ?? 0) || 0;
      return { id: mid, name, artist: singers, album, source: 'tx', duration };
    })
    .filter((t): t is MusicTrackRef => t !== null);
}

export async function resolveStreamUrl(
  trackId: string,
  apiBaseUrl: string,
  source: string,
  quality: string,
): Promise<string> {
  const base = apiBaseUrl.replace(/\/$/, '');
  const url = `${base}/url/${source}/${encodeURIComponent(trackId)}/${quality}`;
  const data = await proxyGet(url);

  if (typeof data === 'string' && data.startsWith('http')) return data;

  if (typeof data === 'object' && data !== null) {
    const d = data as Record<string, unknown>;
    if (typeof d.url === 'string' && d.url.startsWith('http')) return d.url;
    if (typeof d.data === 'object' && d.data !== null) {
      const inner = d.data as Record<string, unknown>;
      if (typeof inner.url === 'string' && inner.url.startsWith('http')) return inner.url;
    }
  }

  throw new Error(
    `无法从 API 响应中提取流地址 (source=${source} id=${trackId}): ${JSON.stringify(data).slice(0, 200)}`,
  );
}
