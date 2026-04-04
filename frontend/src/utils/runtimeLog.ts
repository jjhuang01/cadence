import { invoke } from '@tauri-apps/api/core';

export type RuntimeLogLevel = 'debug' | 'info' | 'warn' | 'error';

export async function writeRuntimeLog(level: RuntimeLogLevel, message: string): Promise<void> {
  const trimmed = message.trim();
  if (!trimmed) return;

  try {
    await invoke('write_runtime_log', { level, message: trimmed });
  } catch (error) {
    console.error('write_runtime_log failed:', error);
  }
}
