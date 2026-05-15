/**
 * Ops staff session helpers.
 *
 * PRODUCTION: Replace with Clerk's useUser() / getAuth(). The OpsSession type
 * mirrors Clerk's session claims shape so the swap is mechanical.
 */

export type OpsSession = {
  id:     string;
  email:  string;
  name:   string;
  role:   string;
  lender: { id: string; name: string };
  type:   'staff';
};

const KEY = 'capstack_ops_session';

export function getSession(): OpsSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const s = localStorage.getItem(KEY);
    return s ? (JSON.parse(s) as OpsSession) : null;
  } catch {
    return null;
  }
}

export function setSession(s: OpsSession): void {
  localStorage.setItem(KEY, JSON.stringify(s));
  document.cookie = `capstack_auth=1; path=/; max-age=86400; SameSite=Lax`;
}

export function clearSession(): void {
  localStorage.removeItem(KEY);
  document.cookie = 'capstack_auth=; path=/; max-age=0; SameSite=Lax';
}
