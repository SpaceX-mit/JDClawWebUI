/**
 * Device Identity utilities for JDClawWebUI
 * Based on OpenClaw's device identity implementation
 */

type StoredIdentity = {
  version: 1;
  deviceId: string;
  publicKey: string;
  privateKey: string;
  createdAtMs: number;
};

export type DeviceIdentity = {
  deviceId: string;
  publicKey: string;
  privateKey: string;
};

const STORAGE_KEY = 'jdclaw-device-identity-v1';

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}

function base64UrlDecode(input: string): Uint8Array {
  const normalized = input.replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Ed25519 helpers using Web Crypto API
async function generateEd25519KeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    'Ed25519',
    true, // extractable
    ['sign', 'verify']
  );
}

async function fingerprintPublicKey(publicKey: CryptoKey): Promise<string> {
  const rawKey = await crypto.subtle.exportKey('raw', publicKey);
  const hash = await crypto.subtle.digest('SHA-256', rawKey);
  return bytesToHex(new Uint8Array(hash));
}

async function generateIdentity(): Promise<DeviceIdentity> {
  const keyPair = await generateEd25519KeyPair();
  const publicKeyRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
  const privateKeyRaw = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
  
  const deviceId = await fingerprintPublicKey(keyPair.publicKey);
  
  return {
    deviceId,
    publicKey: base64UrlEncode(new Uint8Array(publicKeyRaw)),
    privateKey: base64UrlEncode(new Uint8Array(privateKeyRaw)),
  };
}

export async function loadOrCreateDeviceIdentity(): Promise<DeviceIdentity | null> {
  // Check if Web Crypto is available
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    console.log('[DeviceIdentity] Web Crypto not available, skipping device identity');
    return null;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredIdentity;
      if (
        parsed?.version === 1 &&
        typeof parsed.deviceId === 'string' &&
        typeof parsed.publicKey === 'string' &&
        typeof parsed.privateKey === 'string'
      ) {
        return {
          deviceId: parsed.deviceId,
          publicKey: parsed.publicKey,
          privateKey: parsed.privateKey,
        };
      }
    }
  } catch {
    // fall through to regenerate
  }

  // Generate new identity
  const identity = await generateIdentity();
  const stored: StoredIdentity = {
    version: 1,
    deviceId: identity.deviceId,
    publicKey: identity.publicKey,
    privateKey: identity.privateKey,
    createdAtMs: Date.now(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  return identity;
}

export async function signDevicePayload(privateKeyBase64Url: string, payload: string): Promise<string> {
  const keyData = base64UrlDecode(privateKeyBase64Url);
  
  // Import the private key
  const key = await crypto.subtle.importKey(
    'pkcs8',
    keyData.buffer as ArrayBuffer,
    { name: 'Ed25519', namedCurve: 'Ed25519' },
    false,
    ['sign']
  );
  
  const data = new TextEncoder().encode(payload);
  const signature = await crypto.subtle.sign('Ed25519', key, data);
  return base64UrlEncode(new Uint8Array(signature as ArrayBuffer));
}

/**
 * Build the device auth payload that needs to be signed
 * Format: v2|{deviceId}|{clientId}|{clientMode}|{role}|{scopes}|{signedAtMs}|{token}|{nonce}
 */
export function buildDeviceAuthPayload(params: {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token?: string | null;
  nonce: string;
}): string {
  const scopes = params.scopes.join(',');
  const token = params.token ?? '';
  return [
    'v2',
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    scopes,
    String(params.signedAtMs),
    token,
    params.nonce,
  ].join('|');
}
