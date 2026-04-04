import { invoke } from "@tauri-apps/api/core";

export async function loadFavorites(): Promise<Set<string>> {
  let ids = await invoke<string[]>("load_online_favorites");
  return new Set(ids);
}

export async function saveFavorites(ids: Iterable<string>): Promise<void> {
  let uniqueIds = [...new Set(ids)];
  await invoke("save_online_favorites", { ids: uniqueIds });
}
