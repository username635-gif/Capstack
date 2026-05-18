// Browser calls stay same-origin and are forwarded by the ops proxy route.
export const API_BASE_URL = '/api/proxy';

type OpsAccessTokenResponse = {
  accessToken: string;
  expiresAt: string;
};

export async function buildOpsApiHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const response = await fetch('/api/session/token', {
    method: 'POST',
    cache: 'no-store',
    credentials: 'same-origin',
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: 'Unable to authenticate ops API request.' })) as { error?: string };
    throw new Error(payload.error ?? 'Unable to authenticate ops API request.');
  }

  const payload = await response.json() as OpsAccessTokenResponse;

  return {
    Authorization: `Bearer ${payload.accessToken}`,
    ...extra,
  };
}