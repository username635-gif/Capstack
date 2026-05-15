/**
 * Borrower session helpers.
 *
 * Stores session in localStorage (client-readable) and sets a cookie flag
 * (server-readable by middleware for route protection).
 *
 * PRODUCTION: Replace getSession / setSession with Clerk's useUser() hook.
 * The BorrowerSession type matches what Clerk's user object would provide,
 * making the swap a two-line change in each component.
 */

export type BorrowerSession = {
  id:    string;
  email: string;
  name:  string;
  type:  'borrower';
};

const KEY = 'capstack_borrower_session';

export function getSession(): BorrowerSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const s = localStorage.getItem(KEY);
    return s ? (JSON.parse(s) as BorrowerSession) : null;
  } catch {
    return null;
  }
}

export function setSession(s: BorrowerSession): void {
  localStorage.setItem(KEY, JSON.stringify(s));
  // Cookie flag read by middleware to protect routes server-side
  document.cookie = `capstack_auth=1; path=/; max-age=86400; SameSite=Lax`;
}

export function clearSession(): void {
  localStorage.removeItem(KEY);
  document.cookie = 'capstack_auth=; path=/; max-age=0; SameSite=Lax';
}
