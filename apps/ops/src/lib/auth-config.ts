export type OpsAuthMode = 'demo' | 'passwordless' | 'hybrid' | 'sso';
export type OpsSsoProvider = 'google' | 'microsoft';

export const OPS_SSO_PROVIDER_LABELS: Record<OpsSsoProvider, string> = {
  google: 'Google Workspace SSO',
  microsoft: 'Microsoft SSO',
};

const AUTH_MODES = new Set<OpsAuthMode>(['demo', 'passwordless', 'hybrid', 'sso']);
const SSO_PROVIDERS = new Set<OpsSsoProvider>(['google', 'microsoft']);

function parseAuthMode(raw: string | undefined): OpsAuthMode {
  const value = raw?.trim().toLowerCase();
  return value && AUTH_MODES.has(value as OpsAuthMode)
    ? (value as OpsAuthMode)
    : 'demo';
}

function parseProviders(raw: string | undefined): OpsSsoProvider[] {
  if (!raw) return [];

  const seen = new Set<OpsSsoProvider>();
  for (const part of raw.split(',').map((value) => value.trim().toLowerCase())) {
    if (SSO_PROVIDERS.has(part as OpsSsoProvider)) {
      seen.add(part as OpsSsoProvider);
    }
  }

  return [...seen];
}

export function isOpsSsoProvider(value: string): value is OpsSsoProvider {
  return SSO_PROVIDERS.has(value as OpsSsoProvider);
}

export function getOpsAuthModeLabel(mode: OpsAuthMode): string {
  switch (mode) {
    case 'passwordless': return 'Passwordless Work Email';
    case 'hybrid': return 'Hybrid Access';
    case 'sso': return 'SSO Only';
    default: return 'Demo Access';
  }
}

export function getPublicOpsAuthConfig() {
  const mode = parseAuthMode(process.env.NEXT_PUBLIC_OPS_AUTH_MODE);
  const enabledProviders = parseProviders(process.env.NEXT_PUBLIC_OPS_SSO_PROVIDERS);

  return {
    mode,
    enabledProviders,
    emailSignInEnabled: mode !== 'sso',
    ssoEnabled: mode === 'hybrid' || mode === 'sso',
  };
}