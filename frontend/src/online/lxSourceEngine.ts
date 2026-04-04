import { invoke } from '@tauri-apps/api/core';

import { writeRuntimeLog } from '../utils/runtimeLog';

function computeMd5(input: string): string {
  function add(x: number, y: number) {
    const l = (x & 0xffff) + (y & 0xffff);
    return (((x >> 16) + (y >> 16) + (l >> 16)) << 16) | (l & 0xffff);
  }
  function rol(n: number, c: number) { return (n << c) | (n >>> (32 - c)); }
  function cmn(q: number, a: number, b: number, x: number, s: number, t: number) {
    return add(rol(add(add(a, q), add(x, t)), s), b);
  }
  const ff = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) => cmn((b & c) | (~b & d), a, b, x, s, t);
  const gg = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) => cmn((b & d) | (c & ~d), a, b, x, s, t);
  const hh = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) => cmn(b ^ c ^ d, a, b, x, s, t);
  const ii = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) => cmn(c ^ (b | ~d), a, b, x, s, t);

  const nb = ((input.length + 8) >> 6) + 1;
  const x: number[] = Array(nb * 16).fill(0);
  for (let i = 0; i < input.length; i++) x[i >> 2] |= input.charCodeAt(i) << ((i % 4) * 8);
  x[input.length >> 2] |= 0x80 << ((input.length % 4) * 8);
  x[nb * 16 - 2] = input.length * 8;

  let a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476;
  for (let i = 0; i < x.length; i += 16) {
    const [oa, ob, oc, od] = [a, b, c, d];
    a=ff(a,b,c,d,x[i],7,-680876936);b=ff(d,a,b,c,x[i+1],12,-389564586);c=ff(c,d,a,b,x[i+2],17,606105819);d=ff(b,c,d,a,x[i+3],22,-1044525330);
    a=ff(a,b,c,d,x[i+4],7,-176418897);b=ff(d,a,b,c,x[i+5],12,1200080426);c=ff(c,d,a,b,x[i+6],17,-1473231341);d=ff(b,c,d,a,x[i+7],22,-45705983);
    a=ff(a,b,c,d,x[i+8],7,1770035416);b=ff(d,a,b,c,x[i+9],12,-1958414417);c=ff(c,d,a,b,x[i+10],17,-42063);d=ff(b,c,d,a,x[i+11],22,-1990404162);
    a=ff(a,b,c,d,x[i+12],7,1804603682);b=ff(d,a,b,c,x[i+13],12,-40341101);c=ff(c,d,a,b,x[i+14],17,-1502002290);d=ff(b,c,d,a,x[i+15],22,1236535329);
    a=gg(a,b,c,d,x[i+1],5,-165796510);b=gg(d,a,b,c,x[i+6],9,-1069501632);c=gg(c,d,a,b,x[i+11],14,643717713);d=gg(b,c,d,a,x[i],20,-373897302);
    a=gg(a,b,c,d,x[i+5],5,-701558691);b=gg(d,a,b,c,x[i+10],9,38016083);c=gg(c,d,a,b,x[i+15],14,-660478335);d=gg(b,c,d,a,x[i+4],20,-405537848);
    a=gg(a,b,c,d,x[i+9],5,568446438);b=gg(d,a,b,c,x[i+14],9,-1019803690);c=gg(c,d,a,b,x[i+3],14,-187363961);d=gg(b,c,d,a,x[i+8],20,1163531501);
    a=gg(a,b,c,d,x[i+13],5,-1444681467);b=gg(d,a,b,c,x[i+2],9,-51403784);c=gg(c,d,a,b,x[i+7],14,1735328473);d=gg(b,c,d,a,x[i+12],20,-1926607734);
    a=hh(a,b,c,d,x[i+5],4,-378558);b=hh(d,a,b,c,x[i+8],11,-2022574463);c=hh(c,d,a,b,x[i+11],16,1839030562);d=hh(b,c,d,a,x[i+14],23,-35309556);
    a=hh(a,b,c,d,x[i+1],4,-1530992060);b=hh(d,a,b,c,x[i+4],11,1272893353);c=hh(c,d,a,b,x[i+7],16,-155497632);d=hh(b,c,d,a,x[i+10],23,-1094730640);
    a=hh(a,b,c,d,x[i+13],4,681279174);b=hh(d,a,b,c,x[i],11,-358537222);c=hh(c,d,a,b,x[i+3],16,-722521979);d=hh(b,c,d,a,x[i+6],23,76029189);
    a=hh(a,b,c,d,x[i+9],4,-640364487);b=hh(d,a,b,c,x[i+12],11,-421815835);c=hh(c,d,a,b,x[i+15],16,530742520);d=hh(b,c,d,a,x[i+2],23,-995338651);
    a=ii(a,b,c,d,x[i],6,-198630844);b=ii(d,a,b,c,x[i+7],10,1126891415);c=ii(c,d,a,b,x[i+14],15,-1416354905);d=ii(b,c,d,a,x[i+5],21,-57434055);
    a=ii(a,b,c,d,x[i+12],6,1700485571);b=ii(d,a,b,c,x[i+3],10,-1894986606);c=ii(c,d,a,b,x[i+10],15,-1051523);d=ii(b,c,d,a,x[i+1],21,-2054922799);
    a=ii(a,b,c,d,x[i+8],6,1873313359);b=ii(d,a,b,c,x[i+15],10,-30611744);c=ii(c,d,a,b,x[i+6],15,-1560198380);d=ii(b,c,d,a,x[i+13],21,1309151649);
    a=ii(a,b,c,d,x[i+4],6,-145523070);b=ii(d,a,b,c,x[i+11],10,-1120210379);c=ii(c,d,a,b,x[i+2],15,718787259);d=ii(b,c,d,a,x[i+9],21,-343485551);
    a=add(a,oa);b=add(b,ob);c=add(c,oc);d=add(d,od);
  }
  return [a,b,c,d].map(w=>[0,1,2,3].map(b=>((w>>(b*8))&0xff).toString(16).padStart(2,'0')).join('')).join('');
}

type LxCallback = (err: Error | null, resp: { body: unknown } | null) => void;

function makeLxRequest() {
  return function (url: string, options: unknown, callback: LxCallback): void {
    const opts = (options ?? {}) as {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    };
    void invoke<{ status: number; text: string; ok: boolean }>('proxy_http_request', {
      url,
      method: opts.method ?? 'GET',
      headers: opts.headers ?? null,
      body: opts.body ?? null,
    })
      .then((resp) => {
        let body: unknown;
        try {
          body = JSON.parse(resp.text);
        } catch {
          body = resp.text;
        }
        callback(null, { body });
      })
      .catch((err) => {
        callback(err instanceof Error ? err : new Error(String(err)), null);
      });
  };
}

export interface LxSourceInfo {
  name: string;
  actions: string[];
  qualitys: string[];
}

export class LxSourceEngine {
  private requestHandler: ((payload: unknown) => Promise<unknown>) | null = null;
  private _sources: Record<string, LxSourceInfo> = {};

  get sources(): Record<string, LxSourceInfo> {
    return this._sources;
  }

  async load(scriptContent: string): Promise<void> {
    let resolveInited: (data: unknown) => void = () => {};
    let capturedHandler: ((payload: unknown) => Promise<unknown>) | null = null;

    const initedPromise = new Promise<unknown>((resolve) => {
      resolveInited = resolve;
    });

    const lxHost = {
      EVENT_NAMES: {
        request: 'request',
        inited: 'inited',
        updateAlert: 'updateAlert',
      },
      env: 'desktop',
      version: '2.10.2',
      request: makeLxRequest(),
      on(event: string, handler: (payload: unknown) => Promise<unknown>) {
        if (event === 'request') capturedHandler = handler;
      },
      send(event: string, payload: unknown) {
        if (event === 'inited') resolveInited(payload);
      },
      utils: {
        md5: computeMd5,
        encodeURIComponent,
      },
    };

    // Inject lx into real globalThis so every access pattern works:
    // lx.xxx  /  window.lx.xxx  /  globalThis.lx.xxx  /  Function('return this')().lx.xxx
    const g = globalThis as Record<string, unknown>;
    const savedLx = g.lx;
    g.lx = lxHost;

    try {
      // Run without a custom sandbox — the real global scope is fully accessible,
      // and lx is already injected above.
      new Function(scriptContent).call(globalThis);
    } catch (e) {
      g.lx = savedLx !== undefined ? savedLx : undefined;
      if (savedLx === undefined) delete g.lx;
      const msg = `音源脚本执行错误: ${e instanceof Error ? e.message : String(e)}`;
      void writeRuntimeLog('error', msg);
      throw new Error(msg);
    }

    let inited: unknown;
    try {
      inited = await Promise.race([
        initedPromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('音源初始化超时（15秒）')), 15000),
        ),
      ]);
    } finally {
      // Restore globalThis.lx after init completes or fails
      if (savedLx === undefined) delete g.lx;
      else g.lx = savedLx;
    }

    this.requestHandler = capturedHandler;

    const initedData = inited as { sources?: Record<string, unknown> } | null;
    if (initedData?.sources) {
      for (const [key, val] of Object.entries(initedData.sources)) {
        const s = (val ?? {}) as Record<string, unknown>;
        this._sources[key] = {
          name: String(s.name ?? key),
          actions: Array.isArray(s.actions) ? (s.actions as unknown[]).map(String) : ['musicUrl'],
          qualitys: Array.isArray(s.qualitys)
            ? (s.qualitys as unknown[]).map(String)
            : ['128k', '320k'],
        };
      }
    }

    void writeRuntimeLog(
      'info',
      `LxSourceEngine loaded sources=${Object.keys(this._sources).join(',')}`,
    );
  }

  async resolveUrl(
    source: string,
    trackId: string,
    quality: string,
    extra?: { name?: string; singer?: string; album?: string; interval?: number },
  ): Promise<string> {
    if (!this.requestHandler) throw new Error('音源未加载');

    void writeRuntimeLog(
      'info',
      `LxSourceEngine resolveUrl source=${source} quality=${quality} id=${trackId}`,
    );

    const intervalStr =
      extra?.interval && extra.interval > 0
        ? `${Math.floor(extra.interval / 60)}:${String(Math.floor(extra.interval % 60)).padStart(2, '0')}`
        : null;

    const musicInfo: Record<string, unknown> = {
      // Top-level identifiers used by different sources
      id: trackId,
      songmid: trackId,   // QQ Music
      rid: trackId,       // Kuwo
      hash: trackId,      // Kugou
      songId: trackId,
      copyrightId: trackId,
      // Metadata
      name: extra?.name ?? '',
      singer: extra?.singer ?? '',
      artist: extra?.singer ?? '',
      album: extra?.album ?? '',
      albumName: extra?.album ?? '',
      // source: CRITICAL — juhe.js API uses this to route to the right backend
      source,
      // interval as "M:SS" string (lx-music format)
      interval: intervalStr,
      // meta object matching lx-music MusicInfoMetaBase
      meta: {
        songId: trackId,
        albumName: extra?.album ?? '',
      },
    };

    const result = await (this.requestHandler as (p: unknown) => Promise<unknown>)({
      action: 'musicUrl',
      source,
      info: { musicInfo, type: quality },
    });

    if (typeof result === 'string' && result.startsWith('http')) {
      try {
        const host = new URL(result).hostname;
        void writeRuntimeLog('info', `LxSourceEngine resolved source=${source} id=${trackId} host=${host}`);
      } catch {
        void writeRuntimeLog('info', `LxSourceEngine resolved source=${source} id=${trackId} url_prefix=${result.slice(0, 80)}`);
      }
      return result;
    }
    throw new Error(`音源返回了无效的播放链接: ${JSON.stringify(result).slice(0, 200)}`);
  }

  isLoaded(): boolean {
    return this.requestHandler !== null;
  }
}

export function extractApiBaseUrl(content: string): string | null {
  const patterns = [
    /(?:const|let|var)\s+API_URL\s*=\s*["']([^"'\s]+)["']/,
    /(?:const|let|var)\s+[A-Z_]+\s*=\s*["'](https?:\/\/[^"'\s]{4,120})["']/,
    /["'](https?:\/\/[^"'\s]{8,120})["']/,
  ];
  for (const re of patterns) {
    const m = content.match(re);
    const url = m?.[1];
    if (url && url.startsWith('http') && !url.includes(' ')) return url;
  }
  return null;
}

export function extractScriptName(content: string): string {
  const m = content.match(/@name\s+(.+)/);
  return m?.[1]?.trim() ?? '未命名音源';
}
