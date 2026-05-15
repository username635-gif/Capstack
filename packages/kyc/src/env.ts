export interface SmileIdEnv {
  partnerId: string;
  apiKey: string;
  sidServer: string;
  configured: boolean;
}

function readEnv(name: string): string {
  return process.env[name]?.trim() ?? '';
}

export function getSmileIdEnv(): SmileIdEnv {
  const partnerId = readEnv('SMILE_ID_PARTNER_ID');
  const apiKey = readEnv('SMILE_ID_API_KEY');
  const sidServer = readEnv('SMILE_ID_SID_SERVER');

  return {
    partnerId,
    apiKey,
    sidServer,
    configured: Boolean(partnerId && apiKey && sidServer),
  };
}

export function isSmileIdConfigured(): boolean {
  return getSmileIdEnv().configured;
}

export function requireSmileIdEnv(context = 'Smile ID live verification'): Omit<SmileIdEnv, 'configured'> {
  const env = getSmileIdEnv();

  if (!env.configured) {
    throw new Error(
      `[env] ${context} requires SMILE_ID_PARTNER_ID, SMILE_ID_API_KEY, and SMILE_ID_SID_SERVER`,
    );
  }

  return {
    partnerId: env.partnerId,
    apiKey: env.apiKey,
    sidServer: env.sidServer,
  };
}