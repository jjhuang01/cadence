export interface Track {
  path: string;
  title: string;
  subtitle: string;
  is_cloud?: boolean;
  cloud_key?: string;
  is_online?: boolean;
  online_id?: string;
  online_source_id?: string;
  online_stream_url?: string;
  online_album?: string;
  duration_secs?: number;
  is_favorite?: boolean;
}

export interface UploadHistoryEntry {
  id: string;
  timestamp: number;
  uploaded: number;
  skipped: number;
  failed: string[];
}

export interface CloudConfig {
  endpoint: string;
  access_key_id: string;
  secret_access_key: string;
  bucket: string;
}
