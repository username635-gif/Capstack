// Browser calls stay same-origin and are forwarded by the ops proxy route.
export const API_BASE_URL = '/api/proxy';

type OpsAccessTokenResponse = {
  accessToken: string;
  expiresAt: string;
};

// In demo mode the proxy bypasses auth and pages fall back to demo data on
// any API failure, so there is no point POSTing /api/session/token — it would
// just 401 and amplify into a retry storm via React Query and page effects.
let tokenAuthDisabled = false;

export async function buildOpsApiHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  if (process.env.NEXT_PUBLIC_OPS_AUTH_MODE === 'demo' || tokenAuthDisabled) {
    return { ...extra };
  }

  const response = await fetch('/api/session/token', {
    method: 'POST',
    cache: 'no-store',
    credentials: 'same-origin',
  });

  if (!response.ok) {
    // Cache the failure so subsequent calls in the same tab don't re-hit a
    // token endpoint that is consistently returning 401.
    tokenAuthDisabled = true;
    const payload = await response.json().catch(() => ({ error: 'Unable to authenticate ops API request.' })) as { error?: string };
    throw new Error(payload.error ?? 'Unable to authenticate ops API request.');
  }

  const payload = await response.json() as OpsAccessTokenResponse;

  return {
    Authorization: `Bearer ${payload.accessToken}`,
    ...extra,
  };
}