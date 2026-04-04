import { useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Track, CloudConfig, UploadHistoryEntry } from "../types";

export interface UploadProgress {
  done: number;
  total: number;
  currentTitle: string;
}

const NAMESPACE = "tips-music/";

export function useCloudStorage() {
  const [isScanning, setIsScanning] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [uploadHistory, setUploadHistory] = useState<UploadHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<S3Client | null>(null);
  const configRef = useRef<CloudConfig | null>(null);

  const getClient = useCallback(async (): Promise<{
    client: S3Client;
    config: CloudConfig;
  }> => {
    if (clientRef.current && configRef.current) {
      return { client: clientRef.current, config: configRef.current };
    }
    const config = await invoke<CloudConfig>("get_cloud_config");
    const client = new S3Client({
      region: "auto",
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.access_key_id,
        secretAccessKey: config.secret_access_key,
      },
      forcePathStyle: true,
    });
    clientRef.current = client;
    configRef.current = config;
    return { client, config };
  }, []);

  const buildPresignedUrl = useCallback(
    async (key: string): Promise<string> => {
      const { client, config } = await getClient();
      const command = new GetObjectCommand({ Bucket: config.bucket, Key: key });
      return getSignedUrl(client, command, { expiresIn: 3600 });
    },
    [getClient],
  );

  const scanCloud = useCallback(async (): Promise<{
    tracks: Track[];
    getPresignedUrl: (key: string) => Promise<string>;
  }> => {
    setIsScanning(true);
    setError(null);
    try {
      const { client, config } = await getClient();

      // Paginate through all objects (ListObjectsV2 default MaxKeys=1000)
      const allObjects: { Key: string }[] = [];
      let continuationToken: string | undefined;
      do {
        const response = await client.send(
          new ListObjectsV2Command({
            Bucket: config.bucket,
            Prefix: NAMESPACE,
            ContinuationToken: continuationToken,
          }),
        );
        for (const obj of response.Contents ?? []) {
          if (obj.Key) allObjects.push({ Key: obj.Key });
        }
        continuationToken = response.NextContinuationToken;
      } while (continuationToken);

      const tracks: Track[] = allObjects
        .filter((obj) => obj.Key.toLowerCase().endsWith(".mp3"))
        .map((obj) => {
          const key = obj.Key;
          const filename = key.split("/").pop() || "unknown";
          const title = filename.replace(/\.mp3$/i, "").replace(/_/g, " ");
          return {
            path: "",
            title,
            subtitle: "Cloud Storage",
            is_cloud: true,
            cloud_key: key,
          };
        });

      return { tracks, getPresignedUrl: buildPresignedUrl };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      throw e;
    } finally {
      setIsScanning(false);
    }
  }, [getClient, buildPresignedUrl]);

  const uploadTracks = useCallback(async (
    localTracks: Track[],
    existingCloudKeys: string[],
  ): Promise<{ uploaded: number; skipped: number; failed: string[] }> => {
    setIsUploading(true);
    setUploadProgress({ done: 0, total: localTracks.length, currentTitle: '' });
    setError(null);

    let uploaded = 0;
    let skipped = 0;
    const failed: string[] = [];

    try {
      const { client, config } = await getClient();
      const existingSet = new Set(existingCloudKeys);

      for (let i = 0; i < localTracks.length; i++) {
        const track = localTracks[i];
        const filename = track.path.split('/').pop() || track.title + '.mp3';
        const key = NAMESPACE + filename;

        setUploadProgress({ done: i, total: localTracks.length, currentTitle: track.title });

        if (existingSet.has(key)) {
          skipped++;
          continue;
        }

        try {
          const putCmd = new PutObjectCommand({
            Bucket: config.bucket,
            Key: key,
            ContentType: 'audio/mpeg',
          });
          const presignedUrl = await getSignedUrl(client, putCmd, { expiresIn: 3600 });
          await invoke('upload_via_presigned_url', { path: track.path, url: presignedUrl });
          uploaded++;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          failed.push(`${track.title}: ${msg}`);
        }
      }
    } finally {
      setUploadProgress({ done: localTracks.length, total: localTracks.length, currentTitle: '' });
      setIsUploading(false);
    }

    const entry: UploadHistoryEntry = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      uploaded,
      skipped,
      failed,
    };
    setUploadHistory((prev) => [entry, ...prev].slice(0, 50));
    return { uploaded, skipped, failed };
  }, [getClient]);

  const deleteCloudTrack = useCallback(async (key: string): Promise<void> => {
    const { client, config } = await getClient();
    // Generate presigned DELETE URL and execute from Rust to bypass WebView CORS
    const command = new DeleteObjectCommand({ Bucket: config.bucket, Key: key });
    const presignedUrl = await getSignedUrl(client, command, { expiresIn: 300 });
    await invoke('delete_via_presigned_url', { url: presignedUrl });
  }, [getClient]);

  return {
    isScanning,
    isUploading,
    uploadProgress,
    uploadHistory,
    error,
    setError,
    scanCloud,
    buildPresignedUrl,
    uploadTracks,
    deleteCloudTrack,
  };
}
