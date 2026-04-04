import { invoke } from "@tauri-apps/api/core";

interface DownloadableTrack {
  title: string;
  online_stream_url?: string;
}

export async function downloadOnlineTrack(track: DownloadableTrack): Promise<string> {
  if (!track.online_stream_url) {
    throw new Error("missing online stream url");
  }

  return invoke<string>("download_online_track", {
    url: track.online_stream_url,
    title: track.title,
  });
}
