import type { AppSettings } from '../types/index.js';
import { storage } from './index.js';

export const STORAGE_KEY = 'jdclaw.settings';

export const DEFAULT_SETTINGS: AppSettings = {
  gatewayUrl: 'ws://localhost:18789',
  theme: 'dark',
  language: 'zh-CN',
  fontSize: 'medium',
  streamingEnabled: true,
  soundEnabled: false,
  notificationsEnabled: false,
  lastSessionKey: undefined,
};

export function loadSettings(): AppSettings {
  const stored = storage.get<Partial<AppSettings>>(STORAGE_KEY);
  if (!stored) {
    return { ...DEFAULT_SETTINGS };
  }
  return { ...DEFAULT_SETTINGS, ...stored };
}

export function saveSettings(partial: Partial<AppSettings>): void {
  const current = loadSettings();
  const merged = { ...current, ...partial };
  storage.set(STORAGE_KEY, merged);
}

export function getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
  const settings = loadSettings();
  return settings[key];
}

export function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
  saveSettings({ [key]: value } as Partial<AppSettings>);
}

export function onSettingsChange(callback: (settings: AppSettings) => void): () => void {
  const handler = (event: StorageEvent): void => {
    if (event.key !== STORAGE_KEY) return;
    const settings = loadSettings();
    callback(settings);
  };

  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

export function resetSettings(): void {
  storage.remove(STORAGE_KEY);
}
