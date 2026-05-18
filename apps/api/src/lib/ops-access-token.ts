type SignedApiPayload = {
  v: '1';
  typ: 'ops-api';
  iat: number;
  exp: number;
  sub: string;
  email: string;
  name: string;
  role: string;
  lenderId: string;
  lenderName: string;
  iss: 'capstack-ops';
  aud: 'capstack-api';
};

export type VerifiedOpsAccessToken = {
  staffId: string;
  email: string;
  actor: string;
  role: string;
  lenderId: string;
  lenderName: string;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const DEV_FALLBACK_SECRET = 'capstack-dev-ops-auth-secret';
const DEMO_FALLBACK_SECRET = 'capstack-demo-ops-auth-secret';
const DEMO_IDENTITY = {
  staffId: 'demo_staff_001',
  email: 'ops@capstack.demo',
  actor: 'Demo Advisor',
  role: 'ADMIN',
  lenderId: 'demo_lender_001',
  lenderName: 'Capstack Demo',
} as const;

export function getOpsAuthSharedSecret(): string | null {
  const configured = getConfiguredOpsAuthSharedSecret();
  if (configured) {
    return configured;
  }

  return process.env.NODE_ENV === 'production'
    ? null
    : DEV_FALLBACK_SECRET;
}

export async function verifyOpsAccessToken(token: string | null | undefined): Promise<VerifiedOpsAccessToken | null> {
  if (!token) {
    return null;
  }

  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) {
    return null;
  }

  for (const secret of getVerificationSecrets()) {
    const isValid = await verifySignature(encodedPayload, signature, secret);
    if (!isValid) {
      continue;
    }

    const payload = parsePayload(encodedPayload);
    if (!payload) {
      continue;
    }

    const now = Math.floor(Date.now() / 1000);
    if (!Number.isFinite(payload.iat) || !Number.isFinite(payload.exp) || payload.exp <= now) {
      continue;
    }

    if (payload.v !== '1' || payload.typ !== 'ops-api' || payload.iss !== 'capstack-ops' || payload.aud !== 'capstack-api') {
      continue;
    }

    if (!payload.sub || !payload.email.includes('@') || !payload.name || !payload.role || !payload.lenderId || !payload.lenderName) {
      continue;
    }

    if (secret === DEMO_FALLBACK_SECRET && !isDemoPayload(payload)) {
      continue;
    }

    return {
      staffId: payload.sub,
      email: payload.email,
      actor: payload.name,
      role: payload.role,
      lenderId: payload.lenderId,
      lenderName: payload.lenderName,
    };
  }

  return null;
}

function getConfiguredOpsAuthSharedSecret(): string | null {
  return process.env.OPS_INTERNAL_AUTH_SECRET?.trim() || null;
}

function getVerificationSecrets(): string[] {
  const configured = getConfiguredOpsAuthSharedSecret();
  if (configured) {
    return [configured];
  }

  return process.env.NODE_ENV === 'production'
    ? [DEMO_FALLBACK_SECRET]
    : [DEV_FALLBACK_SECRET, DEMO_FALLBACK_SECRET];
}

function isDemoPayload(payload: SignedApiPayload): boolean {
  return (
    payload.sub === DEMO_IDENTITY.staffId &&
    payload.email === DEMO_IDENTITY.email &&
    payload.name === DEMO_IDENTITY.actor &&
    payload.role === DEMO_IDENTITY.role &&
    payload.lenderId === DEMO_IDENTITY.lenderId &&
    payload.lenderName === DEMO_IDENTITY.lenderName
  );
}

function parsePayload(encodedPayload: string): SignedApiPayload | null {
  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as SignedApiPayload;
    return payload;
  } catch {
    return null;
  }
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