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
  document.cookie = 'capstack_auth=; path=/; max-age=0; SameSite=Lax';
}

export async function loadServerSession(): Promise<OpsSession | null> {
  try {
    const res = await fetch('/api/session', { cache: 'no-store' });
    if (!res.ok) return null;

    const session = await res.json() as OpsSession;
    setSession(session);
    return session;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  localStorage.removeItem(KEY);
  document.cookie = 'capstack_auth=; path=/; max-age=0; SameSite=Lax';

  try {
    await fetch('/api/session', { method: 'DELETE' });
  } catch {
    // Best-effort cleanup; route middleware still blocks invalid sessions.
  }
}
