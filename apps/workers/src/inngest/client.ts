/**
 * Inngest client for the Capstack workers service.
 *
 * SETUP:
 *   1. pnpm add inngest --filter @capstack/workers  (already done)
 *   2. Set INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY in the environment
 *   3. For local dev: run `npx inngest-cli@latest dev`
 */

import { Inngest } from 'inngest';

export const inngest = new Inngest({
  id: 'capstack-workers',
});
