import { NextRequest, NextResponse } from 'next/server';
import { getOpsAuthSharedSecret, verifyOpsAccessToken } from '@/lib/ops-access-token';

const OPS_AUTH_CONFIG_HINT =
  'Set OPS_INTERNAL_AUTH_SECRET to the same strong value in both the ops and api environments.';

export type OpsIdentity = {
  actor: string;
  role: string;
  staffId: string;
  email: string;
  lenderId: string;
  lenderName: string;
};

type OpsAuthorizationResult =
  | { ok: true; identity: OpsIdentity }
  | { ok: false; response: NextResponse };

export function authorizeOpsRequest(
  req: NextRequest,
  allowedRoles: string[],
): Promise<OpsAuthorizationResult> {
  return authorize(req, allowedRoles);
}

async function authorize(
  req: NextRequest,
  allowedRoles: string[],
): Promise<OpsAuthorizationResult> {
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  if (!getOpsAuthSharedSecret()) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `Ops API auth is not configured. ${OPS_AUTH_CONFIG_HINT}` },
        { status: 503 },
      ),
    };
  }

  const token = authHeader.slice('Bearer '.length).trim();
  const verified = await verifyOpsAccessToken(token);
  if (!verified) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const role = verified.role.trim().toUpperCase();
  if (!role || !allowedRoles.includes(role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return {
    ok: true,
    identity: {
      actor: verified.actor,
      role,
      staffId: verified.staffId,
      email: verified.email,
      lenderId: verified.lenderId,
      lenderName: verified.lenderName,
    },
  };
}