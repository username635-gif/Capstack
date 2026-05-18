import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@capstack/db';
import { authorizeOpsRequest } from '@/lib/ops-auth';

const APPLICATION_WRITE_ROLES = ['ADMIN', 'UNDERWRITER', 'CREDIT_OFFICER', 'COMPLIANCE'];

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try {
    return [null, await p];
  } catch (err) {
    return [err instanceof Error ? err : new Error(String(err)), null];
  }
}

const EVENT_ACTIONS = {
  ASSIGNED: 'APPLICATION_ASSIGNED',
  FLAGGED: 'APPLICATION_FLAGGED',
  NOTE_ADDED: 'APPLICATION_NOTE_ADDED',
  DOCUMENT_REQUESTED: 'APPLICATION_DOCUMENT_REQUESTED',
} as const;

type AllowedEventType = keyof typeof EVENT_ACTIONS;

type EventBody = {
  actor?: string;
  type?: AllowedEventType;
  payload?: Record<string, unknown>;
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeOpsRequest(req, APPLICATION_WRITE_ROLES);
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await params;
  const [parseErr, body] = await to<EventBody>(req.json());
  if (parseErr) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const type = body?.type;
  if (!type || !(type in EVENT_ACTIONS)) {
    return NextResponse.json({ error: 'Unsupported application event type.' }, { status: 422 });
  }

  const actor = auth.identity.actor;
  const payload = sanitizePayload(type, body?.payload ?? {});
  if (!payload) {
    return NextResponse.json({ error: 'Missing required application event payload.' }, { status: 422 });
  }

  const [applicationErr, application] = await to(
    prisma.application.findFirst({
      where: {
        id,
        product: { is: { lenderId: auth.identity.lenderId } },
      },
      select: { borrowerId: true },
    }),
  );
  if (applicationErr) return NextResponse.json({ error: 'Unable to load application.' }, { status: 500 });
  if (!application) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

  const [txErr, event] = await to(
    prisma.$transaction(async (tx) => {
      const created = await tx.applicationEvent.create({
        data: {
          applicationId: id,
          type,
          actor,
          payload,
        },
      });

      await tx.auditLog.create({
        data: {
          actor,
          actorType: 'USER',
          action: EVENT_ACTIONS[type],
          resource: 'APPLICATION',
          resourceId: id,
          after: payload,
        },
      });

      if (type === 'DOCUMENT_REQUESTED' && application.borrowerId) {
        await tx.notification.create({
          data: {
            borrowerId: application.borrowerId,
            type: 'DOCUMENT_REQUEST',
            channel: typeof payload.channel === 'string' ? payload.channel : 'EMAIL',
            subject: 'Additional documents requested',
            body: typeof payload.message === 'string' ? payload.message : 'Please provide the requested documents.',
            status: 'PENDING',
          },
        });
      }

      return created;
    }),
  );

  if (txErr) return NextResponse.json({ error: 'Unable to create application event.' }, { status: 500 });

  return NextResponse.json({
    id: event!.id,
    type: event!.type,
    actor: event!.actor,
    payload: event!.payload,
    createdAt: event!.createdAt,
  }, { status: 201 });
}

function sanitizePayload(type: AllowedEventType, payload: Record<string, unknown>) {
  if (type === 'ASSIGNED') {
    const assignee = typeof payload.assignee === 'string' ? payload.assignee.trim() : '';
    if (!assignee) return null;
    return { assignee, queue: typeof payload.queue === 'string' ? payload.queue : 'underwriting' };
  }

  if (type === 'NOTE_ADDED') {
    const note = typeof payload.note === 'string' ? payload.note.trim() : '';
    if (!note) return null;
    return { note };
  }

  if (type === 'FLAGGED') {
    const reason = typeof payload.reason === 'string'
      ? payload.reason.trim()
      : typeof payload.note === 'string'
        ? payload.note.trim()
        : '';
    if (!reason) return null;
    return {
      reason,
      severity: typeof payload.severity === 'string' ? payload.severity : 'MEDIUM',
    };
  }

  if (type === 'DOCUMENT_REQUESTED') {
    const message = typeof payload.message === 'string' ? payload.message.trim() : '';
    if (!message) return null;
    return {
      message,
      channel: typeof payload.channel === 'string' ? payload.channel : 'EMAIL',
    };
  }

  return null;
}