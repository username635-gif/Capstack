/**
 * Notification dispatcher — SMS, push, and email delivery.
 *
 * WHY THIS EXISTS:
 *   Borrowers must receive timely notifications for:
 *   - Payment reminders (7 days before, 1 day before, on due date)
 *   - Payment confirmation (within seconds of processing)
 *   - Payment overdue notices (daily after missed payment)
 *   - Loan approval / rejection decisions
 *   - OTP for MFA sign-in and sensitive actions
 *
 *   This is both a legal requirement (NCA Section 129 requires notice before
 *   acceleration) and good CX practice to reduce delinquency.
 *
 * CHANNELS:
 *   SMS    — highest open rate for SA market (use Clickatell or Infobip)
 *   PUSH   — mobile app via Firebase Cloud Messaging (FCM) or APNs
 *   EMAIL  — Resend (resend.com) or AWS SES for transactional emails
 *   WHATSAPP — Twilio API for WhatsApp (high engagement for collections)
 *
 * PRODUCTION INTEGRATION STEPS:
 *   SMS via Clickatell:
 *     1. pnpm add @clickatell/clickatell-js --filter api
 *     2. Set env: CLICKATELL_API_KEY
 *     3. Replace _sendSms() body with real API call
 *
 *   Push via FCM:
 *     1. pnpm add firebase-admin --filter api
 *     2. Set env: FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL
 *     3. Replace _sendPush() body with firebase.messaging().send()
 *
 *   Email via Resend:
 *     1. pnpm add resend --filter api
 *     2. Set env: RESEND_API_KEY
 *     3. Replace _sendEmail() body with resend.emails.send()
 *
 * Patterns applied:
 *   1. Early return — missing recipient blocks send
 *   2. Ternary — channel routing
 *   6. to() helper — surface errors as values
 *   7. Property shorthand
 *   8. Composition — sendNotification dispatches to channel-specific senders
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationChannel = 'SMS' | 'PUSH' | 'EMAIL' | 'WHATSAPP';
export type NotificationType    =
  | 'PAYMENT_REMINDER'
  | 'PAYMENT_OVERDUE'
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_FAILED'
  | 'LOAN_APPROVED'
  | 'LOAN_REJECTED'
  | 'OTP'
  | 'DOCUMENT_REQUIRED'
  | 'KYC_APPROVED'
  | 'KYC_REJECTED'
  | 'CUSTOM';

export interface NotificationPayload {
  borrowerId?:     string;
  staffId?:        string;
  channel:         NotificationChannel;
  type:            NotificationType;
  to:              string;      // phone (E.164) | push token | email address
  subject?:        string;      // required for EMAIL channel
  body:            string;
  metadata?:       Record<string, unknown>;
}

export interface NotificationResult {
  success:     boolean;
  externalRef?: string;   // provider's message ID
  channel:     NotificationChannel;
  to:          string;
  sentAt:      string;    // ISO 8601
  error?:      string;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try {
    return [null, await p];
  } catch (err) {
    return [err instanceof Error ? err : new Error(String(err)), null];
  }
}

// ─── Channel implementations (stubs) ─────────────────────────────────────────

async function _sendSms(to: string, body: string): Promise<string> {
  // Production: POST to Clickatell or Infobip
  //
  //   const res = await fetch('https://platform.clickatell.com/messages/http/send', {
  //     method: 'POST',
  //     headers: {
  //       'Content-Type': 'application/json',
  //       'Authorization': `Bearer ${process.env.CLICKATELL_API_KEY}`,
  //     },
  //     body: JSON.stringify({
  //       text:    body,
  //       to:      [to],
  //       from:    process.env.CLICKATELL_SENDER_ID ?? 'Capstack',
  //     }),
  //   });
  //   const data = await res.json() as { messages: Array<{ apiMessageId: string }> };
  //   return data.messages[0]?.apiMessageId ?? 'unknown';

  console.log(`[SMS stub] to=${to} body="${body.slice(0, 60)}..."`);
  return `sms_stub_${Date.now()}`;
}

async function _sendPush(to: string, subject: string, body: string): Promise<string> {
  // Production: use Firebase Admin SDK
  //
  //   const message = {
  //     token:        to,
  //     notification: { title: subject, body },
  //     android: { priority: 'high' as const },
  //     apns:    { payload: { aps: { sound: 'default' } } },
  //   };
  //   const response = await firebaseAdmin.messaging().send(message);
  //   return response; // FCM message ID

  console.log(`[PUSH stub] token=${to.slice(0, 20)}... subject="${subject}"`);
  return `push_stub_${Date.now()}`;
}

async function _sendEmail(to: string, subject: string, body: string): Promise<string> {
  // Production: use Resend
  //
  //   const resend = new Resend(process.env.RESEND_API_KEY);
  //   const { data } = await resend.emails.send({
  //     from: 'Capstack <noreply@capstack.co.za>',
  //     to:   [to],
  //     subject,
  //     html: `<p>${body}</p>`,
  //   });
  //   return data?.id ?? 'unknown';

  console.log(`[EMAIL stub] to=${to} subject="${subject}"`);
  return `email_stub_${Date.now()}`;
}

async function _sendWhatsApp(to: string, body: string): Promise<string> {
  // Production: use Twilio WhatsApp API
  //
  //   const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  //   const message = await client.messages.create({
  //     from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
  //     to:   `whatsapp:${to}`,
  //     body,
  //   });
  //   return message.sid;

  console.log(`[WHATSAPP stub] to=${to} body="${body.slice(0, 60)}..."`);
  return `wa_stub_${Date.now()}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Dispatch a notification via the specified channel.
 * Returns result without throwing — caller logs errors and continues.
 *
 * Pattern 8 — pipeline: validate → route to channel → return result
 */
export async function sendNotification(
  payload: NotificationPayload,
): Promise<NotificationResult> {
  // Pattern 1 — early return on missing recipient
  if (!payload.to) {
    return {
      success:  false,
      channel:  payload.channel,
      to:       payload.to,
      sentAt:   new Date().toISOString(),
      error:    'Missing recipient (to field)',
    };
  }

  // Pattern 2 — ternary chain for channel routing
  const [sendErr, externalRef] = await to(
    payload.channel === 'SMS'
      ? _sendSms(payload.to, payload.body)
      : payload.channel === 'PUSH'
        ? _sendPush(payload.to, payload.subject ?? 'Capstack', payload.body)
        : payload.channel === 'EMAIL'
          ? _sendEmail(payload.to, payload.subject ?? 'Capstack Notification', payload.body)
          : _sendWhatsApp(payload.to, payload.body),
  );

  const sentAt = new Date().toISOString();

  if (sendErr) {
    console.error(`[notifications] ${payload.channel} send failed:`, sendErr.message);
    return {
      success: false,
      channel: payload.channel,
      to:      payload.to,
      sentAt,
      error:   sendErr.message,
    };
  }

  // Pattern 7 — shorthand
  return { success: true, externalRef, channel: payload.channel, to: payload.to, sentAt };
}

// ─── Convenience senders ─────────────────────────────────────────────────────

/** Send a payment reminder N days before due date. */
export async function sendPaymentReminder(
  phone:          string,
  borrowerName:   string,
  amountRand:     number,
  dueDateStr:     string,
  daysUntilDue:   number,
): Promise<NotificationResult> {
  const body = daysUntilDue === 0
    ? `Hi ${borrowerName}, your Capstack repayment of R${amountRand.toFixed(2)} is DUE TODAY. Please ensure funds are available. Reply HELP for assistance.`
    : `Hi ${borrowerName}, your Capstack repayment of R${amountRand.toFixed(2)} is due in ${daysUntilDue} day${daysUntilDue > 1 ? 's' : ''} on ${dueDateStr}. Please ensure funds are available.`;

  return sendNotification({
    channel: 'SMS',
    type:    'PAYMENT_REMINDER',
    to:      phone,
    body,
  });
}

/** Confirm a successful payment to the borrower. */
export async function sendPaymentConfirmation(
  phone:        string,
  borrowerName: string,
  amountRand:   number,
  loanRef:      string,
): Promise<NotificationResult> {
  return sendNotification({
    channel: 'SMS',
    type:    'PAYMENT_CONFIRMED',
    to:      phone,
    body:    `Hi ${borrowerName}, we have received your payment of R${amountRand.toFixed(2)} for loan ${loanRef}. Thank you! Your updated balance is available in your Capstack account.`,
  });
}

/** Notify borrower that their payment was declined (for retry awareness). */
export async function sendPaymentFailedNotification(
  phone:        string,
  borrowerName: string,
  amountRand:   number,
): Promise<NotificationResult> {
  return sendNotification({
    channel: 'SMS',
    type:    'PAYMENT_FAILED',
    to:      phone,
    body:    `Hi ${borrowerName}, your payment of R${amountRand.toFixed(2)} could not be processed. Please log in to Capstack or call us to arrange payment and avoid additional charges.`,
  });
}

/** Send an OTP code for MFA. */
export async function sendOtp(
  phone: string,
  otp:   string,
): Promise<NotificationResult> {
  return sendNotification({
    channel: 'SMS',
    type:    'OTP',
    to:      phone,
    body:    `Your Capstack verification code is ${otp}. This code expires in 10 minutes. Do not share it with anyone.`,
  });
}
