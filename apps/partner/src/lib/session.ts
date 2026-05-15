/**
 * Partner session helpers. Same pattern as ops/lib/session.ts.
 * PRODUCTION: Replace with Clerk Organizations or OAuth.
 */

export type PartnerSession = {
  id:       string;
  name:     string;
  slug:     string;
  lenderId: string;
  type:     'partner';
};

const KEY = 'capstack_partner_session';

export function getSession(): PartnerSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const s = localStorage.getItem(KEY);
    return s ? (JSON.parse(s) as PartnerSession) : null;
  } catch {
    return null;
  }
}

export function setSession(s: PartnerSession): void {
  localStorage.setItem(KEY, JSON.stringify(s));
  document.cookie = `capstack_auth=1; path=/; max-age=86400; SameSite=Lax`;
}

export function clearSession(): void {
  localStorage.removeItem(KEY);
  document.cookie = 'capstack_auth=; path=/; max-age=0; SameSite=Lax';
}
