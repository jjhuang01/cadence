export interface OnlineTrackRef {
  sourceId: string;
  trackId: string;
  title: string;
  artist: string;
  album?: string;
  streamUrl?: string;
  artworkUrl?: string;
  resolverPayload?: Record<string, unknown>;
}

export interface ControlledCatalogResponse {
  items: OnlineTrackRef[];
}
