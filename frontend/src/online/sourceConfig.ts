import { invoke } from "@tauri-apps/api/core";

export interface LoadedSourceMeta {
  id: string;
  name: string;
  scriptContent: string;
  apiBaseUrl: string;
}

export interface SourceConfig {
  apiBaseUrl: string;
  activeSource: string;
  activeSourceId: string | null;
  quality: string;
  loadedSources: LoadedSourceMeta[];
}

export const DEFAULT_SOURCE_CONFIG: SourceConfig = {
  apiBaseUrl: "",
  activeSource: "kw",
  activeSourceId: null,
  quality: "128k",
  loadedSources: [],
};

export const SOURCE_LABELS: Record<string, string> = {
  wy: "网易云 (163)",
  kw: "酷我",
  tx: "QQ音乐",
  kg: "酷狗",
  mg: "咪咕",
};

export const QUALITY_LABELS: Record<string, string> = {
  "128k": "标准 128k",
  "320k": "高品质 320k",
};

export async function loadSourceConfig(): Promise<SourceConfig> {
  try {
    const raw = await invoke<SourceConfig | null>("load_source_config");
    if (!raw) return { ...DEFAULT_SOURCE_CONFIG };
    const sources: LoadedSourceMeta[] = Array.isArray(raw.loadedSources)
      ? (raw.loadedSources as LoadedSourceMeta[])
      : [];
    const rawId = (raw as unknown as Record<string, unknown>).activeSourceId;
    const activeSourceId =
      typeof rawId === 'string' && sources.some((s) => s.id === rawId) ? rawId : (sources[0]?.id ?? null);
    return {
      apiBaseUrl:
        typeof raw.apiBaseUrl === 'string' ? raw.apiBaseUrl.trim() : DEFAULT_SOURCE_CONFIG.apiBaseUrl,
      activeSource:
        typeof raw.activeSource === 'string' && raw.activeSource.trim()
          ? raw.activeSource.trim()
          : DEFAULT_SOURCE_CONFIG.activeSource,
      activeSourceId,
      quality:
        typeof raw.quality === 'string' && raw.quality.trim()
          ? raw.quality.trim()
          : DEFAULT_SOURCE_CONFIG.quality,
      loadedSources: sources,
    };
  } catch {
    return { ...DEFAULT_SOURCE_CONFIG };
  }
}

export async function saveSourceConfig(config: SourceConfig): Promise<void> {
  await invoke("save_source_config", { config });
}
