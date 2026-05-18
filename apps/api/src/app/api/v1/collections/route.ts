import { NextRequest, NextResponse } from 'next/server';
import { Prisma, prisma } from '@capstack/db';
import { sendNotification, type NotificationChannel, type NotificationType } from '@/lib/notifications';
import { authorizeOpsRequest } from '@/lib/ops-auth';
import { buildCollectionsInsight, buildCollectionsSummary } from '@/lib/collections-review';

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try { return [null, await p]; }
  catch (err) { return [err instanceof Error ? err : new Error(String(err)), null]; }
}

const READ_ROLES = ['ADMIN', 'COLLECTIONS', 'COMPLIANCE', 'FINANCE', 'READONLY'];
const WRITE_ROLES = ['ADMIN', 'COLLECTIONS', 'COMPLIANCE'];

type CollectionAction =
  | 'SMS_REMINDER'
  | 'EMAIL_REMINDER'
  | 'WHATSAPP_REMINDER'
  | 'CALL'
  | 'PROMISE_TO_PAY'
  | 'BROKEN_PTP'
  | 'RESTRUCTURE_OFFER'
  | 'LEGAL'
  | 'NOTE_ADDED';

const ACTION_TO_EVENT: Record<CollectionAction, string> = {
  SMS_REMINDER: 'REMINDER_SENT',
  EMAIL_REMINDER: 'REMINDER_SENT',
  WHATSAPP_REMINDER: 'REMINDER_SENT',
  CALL: 'CALL_MADE',
  PROMISE_TO_PAY: 'PROMISE_TO_PAY',
  BROKEN_PTP: 'BROKEN_PTP',
  RESTRUCTURE_OFFER: 'RESTRUCTURE_OFFERED',
  LEGAL: 'LEGAL_ESCALATED',
  NOTE_ADDED: 'NOTE_ADDED',
};

function getChannel(action: CollectionAction, requestedChannel?: string | null): string | null {
  if (requestedChannel) {
    return requestedChannel.toUpperCase();
  }

  if (action === 'SMS_REMINDER') return 'SMS';
  if (action === 'EMAIL_REMINDER') return 'EMAIL';
  if (action === 'WHATSAPP_REMINDER') return 'WHATSAPP';
  if (action === 'CALL' || action === 'RESTRUCTURE_OFFER') return 'CALL';
  if (action === 'LEGAL') return 'LEGAL';
  return null;
}

function buildNotificationBody(
  borrowerName: string,
  loanNumber: string,
  daysPastDue: number,
  action: CollectionAction,
  message?: string | null,
): string {
  if (message?.trim()) {
    return message.trim();
  }

  if (action === 'PROMISE_TO_PAY') {
    return `Hi ${borrowerName}, thank you for discussing your Capstack account ${loanNumber}. We have recorded your promise to pay. Please keep to the agreed date to avoid escalation.`;
  }

  if (action === 'RESTRUCTURE_OFFER') {
    return `Hi ${borrowerName}, your Capstack account ${loanNumber} is ${daysPastDue} days overdue. Our team has flagged you for a restructuring review. Reply or call us to discuss a revised repayment plan.`;
  }

  if (action === 'LEGAL') {
    return `Hi ${borrowerName}, your Capstack account ${loanNumber} remains overdue. Your account has been escalated for legal collections review. Please contact us immediately to avoid further action.`;
  }

  return `Hi ${borrowerName}, your Capstack account ${loanNumber} is ${daysPastDue} days overdue. Please make payment or contact us today to avoid further escalation.`;
}

function getNotificationType(action: CollectionAction): NotificationType {
  return action === 'BROKEN_PTP' ? 'PAYMENT_FAILED' : 'PAYMENT_OVERDUE';
}

function splitBorrowerName(fullName: string | null | undefined): { firstName: string; lastName: string } {
  const normalized = fullName?.trim() ?? '';
  if (!normalized) {
    return { firstName: 'Borrower', lastName: '' };
  }

  const [firstName, ...rest] = normalized.split(/\s+/);
  return {
    firstName,
    lastName: rest.join(' '),
  };
}

export async function GET(req: NextRequest) {
  const auth = await authorizeOpsRequest(req, READ_ROLES);
  if (!auth.ok) {
    return auth.response;
  }

  const { searchParams } = new URL(req.url);
  const minDpd = Number(searchParams.get('minDpd') ?? 1);
  const take = Math.min(Number(searchParams.get('limit') ?? 50), 200);
  const skip = Number(searchParams.get('offset') ?? 0);

  const [err, loans] = await to(
    prisma.loan.findMany({
      where: {
        daysPastDue: { gte: minDpd },
        status: { in: ['ACTIVE', 'DEFAULTED', 'RESTRUCTURED'] },
      },
      include: {
        borrower: { include: { individual: true, business: true } },
        product: true,
        application: {
          include: {
            decisions: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { pdScore: true },
            },
          },
        },
        collections: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
      orderBy: [
        { daysPastDue: 'desc' },
        { updatedAt: 'desc' },
      ],
      take,
      skip,
    }),
  );
  if (err) return NextResponse.json({ error: err.message }, { status: 500 });

  const data = loans!.map((loan) => {
    const individualName = loan.borrower.individual?.fullName ?? null;
    const businessName = loan.borrower.business?.legalName ?? null;
    const name = individualName ?? businessName ?? 'Unknown borrower';
    const splitName = splitBorrowerName(individualName ?? businessName);
    const insight = buildCollectionsInsight({
      loanId: loan.id,
      daysPastDue: loan.daysPastDue,
      delinquencyState: loan.delinquencyState,
      outstandingPrincipalCents: Number(loan.outstandingPrincipal),
      outstandingInterestCents: Number(loan.outstandingInterest),
      outstandingFeesCents: Number(loan.outstandingFees),
      latestDecision: loan.application?.decisions[0] ?? null,
      events: loan.collections,
    });

    return {
      id: loan.id,
      loanNumber: loan.loanNumber,
      status: loan.status,
      daysPastDue: loan.daysPastDue,
      delinquencyState: loan.delinquencyState,
      principal: Number(loan.principal),
      outstandingPrincipal: Number(loan.outstandingPrincipal),
      outstandingInterest: Number(loan.outstandingInterest),
      outstandingFees: Number(loan.outstandingFees),
      outstandingTotalCents: insight.outstandingTotalCents,
      borrower: {
        id: loan.borrowerId,
        name,
        firstName: splitName.firstName,
        lastName: splitName.lastName,
        email: loan.borrower.email,
        phone: loan.borrower.phone,
        riskRating: loan.borrower.riskRating,
        blacklistFlag: loan.borrower.blacklistFlag,
      },
      product: {
        id: loan.product.id,
        name: loan.product.name,
      },
      latestCollectionEvent: insight.latestCollectionEvent,
      ai: insight.ai,
      workflow: insight.workflow,
      events: loan.collections.map((event) => ({
        id: event.id,
        type: event.type,
        channel: event.channel,
        outcome: event.outcome,
        payload: event.payload,
        createdAt: event.createdAt.toISOString(),
      })),
    };
  });

  const summary = buildCollectionsSummary(data.map((item) => ({
    stage: item.daysPastDue >= 60 ? 'LEGAL' : item.daysPastDue >= 30 ? 'LATE' : item.daysPastDue >= 8 ? 'MID' : 'EARLY',
    outstandingTotalCents: item.outstandingTotalCents,
    latestCollectionEvent: item.latestCollectionEvent,
    ai: item.ai,
    workflow: item.workflow,
  })));

  return NextResponse.json({ data, summary, count: data.length });
}

export async function POST(req: NextRequest) {
  const auth = await authorizeOpsRequest(req, WRITE_ROLES);
  if (!auth.ok) {
    return auth.response;
  }

  const body = await req.json() as {
    loanId?: string;
    action?: CollectionAction;
    channel?: string | null;
    notes?: string | null;
    message?: string | null;
    promiseDate?: string | null;
    promiseAmountCents?: number | null;
    followUpDate?: string | null;
    sendBorrowerNotification?: boolean;
  };

  if (!body.loanId || !body.action || !(body.action in ACTION_TO_EVENT)) {
    return NextResponse.json({ error: 'loanId and a valid action are required' }, { status: 400 });
  }

  const action = body.action;

  const [loanErr, loan] = await to(
    prisma.loan.findUnique({
      where: { id: body.loanId },
      include: {
        borrower: { include: { individual: true, business: true } },
      },
    }),
  );
  if (loanErr) return NextResponse.json({ error: loanErr.message }, { status: 500 });
  if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

  const channel = getChannel(body.action, body.channel);
  const payload = {
    action,
    notes: body.notes?.trim() || null,
    message: body.message?.trim() || null,
    promiseDate: body.promiseDate ?? null,
    promiseAmountCents: body.promiseAmountCents ?? null,
    followUpDate: body.followUpDate ?? null,
    actorRole: auth.identity.role,
  } satisfies Prisma.InputJsonValue;

  const [eventErr, event] = await to(
    prisma.$transaction(async (tx) => {
      const createdEvent = await tx.collectionEvent.create({
        data: {
          loanId: loan.id,
          type: ACTION_TO_EVENT[action],
          channel,
          outcome: body.notes?.trim() || body.message?.trim() || null,
          payload,
        },
      });

      await tx.auditLog.create({
        data: {
          actor: auth.identity.actor,
          actorType: 'USER',
          action: `COLLECTION_${body.action}`,
          resource: 'LOAN',
          resourceId: loan.id,
          after: {
            action,
            channel,
            notes: body.notes?.trim() || null,
            promiseDate: body.promiseDate ?? null,
            promiseAmountCents: body.promiseAmountCents ?? null,
            followUpDate: body.followUpDate ?? null,
          } satisfies Prisma.InputJsonValue,
        },
      });

      return createdEvent;
    }),
  );
  if (eventErr) return NextResponse.json({ error: eventErr.message }, { status: 500 });

  let notification: {
    success: boolean;
    externalRef?: string;
    channel: string;
    to: string;
    sentAt: string;
    error?: string;
  } | null = null;

  const shouldSendNotification = body.sendBorrowerNotification !== false
    && channel !== null
    && ['SMS', 'EMAIL', 'WHATSAPP'].includes(channel)
    && (loan.borrower.phone || loan.borrower.email);

  if (shouldSendNotification) {
    const borrowerName = splitBorrowerName(
      loan.borrower.individual?.fullName ?? loan.borrower.business?.legalName,
    ).firstName;
    const toAddress = channel === 'EMAIL'
      ? loan.borrower.email
      : loan.borrower.phone;

    if (toAddress) {
      notification = await sendNotification({
        borrowerId: loan.borrowerId,
        channel: channel as NotificationChannel,
        type: getNotificationType(action),
        to: toAddress,
        subject: channel === 'EMAIL' ? `Capstack collections update for ${loan.loanNumber}` : undefined,
        body: buildNotificationBody(borrowerName, loan.loanNumber, loan.daysPastDue, action, body.message),
        metadata: {
          loanId: loan.id,
          action,
        },
      });

      await prisma.notification.create({
        data: {
          borrowerId: loan.borrowerId,
          type: getNotificationType(action),
          channel,
          subject: channel === 'EMAIL' ? `Capstack collections update for ${loan.loanNumber}` : null,
          body: buildNotificationBody(borrowerName, loan.loanNumber, loan.daysPastDue, action, body.message),
          status: notification.success ? 'SENT' : 'FAILED',
          externalRef: notification.externalRef ?? null,
          sentAt: notification.success ? new Date(notification.sentAt) : null,
        },
      });
    }
  }

  return NextResponse.json({
    ok: true,
    event: {
      id: event!.id,
      type: event!.type,
      channel: event!.channel,
      outcome: event!.outcome,
      createdAt: event!.createdAt.toISOString(),
    },
    notification,
  });
}
