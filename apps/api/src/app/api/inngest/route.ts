import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest';

/**
 * GET  /api/inngest  — Inngest introspection (dev server handshake)
 * POST /api/inngest  — Inngest delivers events to registered functions
 * PUT  /api/inngest  — Inngest syncs function definitions
 *
 * The functions array is empty here because the heavy processing runs in the
 * workers service. This endpoint is used by the API to SEND events via
 * inngest.send(), which the workers service then picks up.
 */
const handler = serve({
  client: inngest,
  functions: [], // workers service owns the function registrations
});

export const { GET, POST, PUT } = handler;
