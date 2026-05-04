/**
 * Capstack Workers
 * Background job runner for async loan processing tasks:
 *  - Credit decision callbacks
 *  - Disbursement triggers
 *  - Collection reminders
 *  - KYC webhook handlers
 */

console.log('[workers] Starting Capstack worker process...');

// Future: import and register queue handlers here
// import { startCreditDecisionWorker } from './workers/creditDecision';
// import { startDisbursementWorker } from './workers/disbursement';
// import { startCollectionWorker } from './workers/collection';

process.on('SIGTERM', () => {
  console.log('[workers] Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[workers] Received SIGINT, shutting down gracefully...');
  process.exit(0);
});
