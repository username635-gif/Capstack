import type { OpsSession } from './session';
import { parseSignedSession, serializeSignedSession, type OpsTokenIdentity } from './ops-auth-crypto';

export const OPS_AUTH_COOKIE = 'capstack_ops_auth';
export const OPS_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

const STAFF_ROLES = new Set([
  'ADMIN',
  'CREDIT_OFFICER',
  'UNDERWRITER',
  'COLLECTIONS',
  'COMPLIANCE',
  'FINANCE',
  'READONLY',
]);

export function isAllowedOpsRole(role: string): boolean {
  return STAFF_ROLES.has(role);
}

export async function serializeOpsAuthCookie(session: OpsSession): Promise<string> {
  return serializeSignedSession(toIdentity(session), OPS_SESSION_MAX_AGE_SECONDS);
}

export async function parseOpsAuthCookie(value?: string | null): Promise<OpsSession | null> {
  const identity = await parseSignedSession(value);
  if (!identity || !isAllowedOpsRole(identity.role)) {
    return null;
  }

  return {
    id: identity.id,
    email: identity.email,
    name: identity.name,
    role: identity.role,
    lender: {
      id: identity.lenderId,
      name: identity.lenderName,
    },
    type: 'staff',
  };
}

function toIdentity(session: OpsSession): OpsTokenIdentity {
  return {
    id: session.id,
    email: session.email,
    name: session.name,
    role: session.role,
    lenderId: session.lender.id,
    lenderName: session.lender.name,
  };
}