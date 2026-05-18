type SignedPayload = {
  v: '1';
  typ: 'ops-session' | 'ops-api';
  iat: number;
  exp: number;
};

export type OpsTokenIdentity = {
  id: string;
  email: string;
  name: string;
  role: string;
  lenderId: string;
  lenderName: string;
};

type SignedSessionPayload = SignedPayload & {
  typ: 'ops-session';
  sub: string;
  email: string;
  name: string;
  role: string;
  lenderId: string;
  lenderName: string;
};

type SignedApiPayload = SignedPayload & {
  typ: 'ops-api';
  sub: string;
  email: string;
  name: string;
  role: string;
  lenderId: string;
  lenderName: string;
  iss: 'capstack-ops';
  aud: 'capstack-api';
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const OPS_API_TOKEN_TTL_SECONDS = 60 * 5;
export const OPS_AUTH_CONFIG_HINT =
  'Set OPS_INTERNAL_AUTH_SECRET to the same strong value in both the ops and api environments.';

export function getOpsAuthSharedSecret(): string | null {
  const configured = process.env.OPS_INTERNAL_AUTH_SECRET?.trim();
  if (configured) {
    return configured;
  }

  return process.env.NODE_ENV === 'production'
    ? null
    : 'capstack-dev-ops-auth-secret';
}

export async function serializeSignedSession(identity: OpsTokenIdentity, ttlSeconds: number): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return signPayload({
    v: '1',
    typ: 'ops-session',
    iat: now,
    exp: now + ttlSeconds,
    sub: identity.id,
    email: identity.email,
    name: identity.name,
    role: identity.role,
    lenderId: identity.lenderId,
    lenderName: identity.lenderName,
  });
}

export async function parseSignedSession(token?: string | null): Promise<OpsTokenIdentity | null> {
  const payload = await verifyPayload<SignedSessionPayload>(token, 'ops-session');
  if (!payload) {
    return null;
  }

  return {
    id: payload.sub,
    email: payload.email,
    name: payload.name,
    role: payload.role,
    lenderId: payload.lenderId,
    lenderName: payload.lenderName,
  };
}

export async function createOpsAccessToken(identity: OpsTokenIdentity): Promise<{ token: string; expiresAt: string }> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + OPS_API_TOKEN_TTL_SECONDS;
  const token = await signPayload({
    v: '1',
    typ: 'ops-api',
    iat: now,
    exp,
    sub: identity.id,
    email: identity.email,
    name: identity.name,
    role: identity.role,
    lenderId: identity.lenderId,
    lenderName: identity.lenderName,
    iss: 'capstack-ops',
    aud: 'capstack-api',
  });

  return {
    token,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

function toBase64Url(value: string): string {
  const bytes = textEncoder.encode(value);
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(value: string): string {
  const padded = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return textDecoder.decode(bytes);
}

async function signPayload(payload: SignedSessionPayload | SignedApiPayload): Promise<string> {
  const secret = getOpsAuthSharedSecret();
  if (!secret) {
    throw new Error(`OPS internal auth is not configured. ${OPS_AUTH_CONFIG_HINT}`);
  }

  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = await createSignature(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

async function verifyPayload<T extends SignedPayload>(token: string | null | undefined, expectedType: T['typ']): Promise<T | null> {
  const secret = getOpsAuthSharedSecret();
  if (!secret || !token) {
    return null;
  }

  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) {
    return null;
  }

  const isValid = await verifySignature(encodedPayload, signature, secret);
  if (!isValid) {
    return null;
  }

  const payload = parseSignedPayload<T>(encodedPayload);
  if (!payload || payload.typ !== expectedType || payload.v !== '1') {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(payload.iat) || !Number.isFinite(payload.exp) || payload.exp <= now) {
    return null;
  }

  return payload;
}

function parseSignedPayload<T extends SignedPayload>(encodedPayload: string): T | null {
  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as T;
    return payload;
  } catch {
    return null;
  }
}

async function createSignature(message: string, secret: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, textEncoder.encode(message));
  return toBase64Url(String.fromCharCode(...new Uint8Array(signature)));
}

async function verifySignature(message: string, signature: string, secret: string): Promise<boolean> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  try {
    const signatureBytes = Uint8Array.from(fromBase64Url(signature), (char) => char.charCodeAt(0));
    return await crypto.subtle.verify('HMAC', cryptoKey, signatureBytes, textEncoder.encode(message));
  } catch {
    return false;
  }
}