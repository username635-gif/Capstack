import { Inngest } from 'inngest';

/**
 * Inngest client for the API app.
 * Events emitted here are picked up by the workers service.
 */
export const inngest = new Inngest({ id: 'capstack-api' });
