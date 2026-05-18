import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@capstack/db';
import type { Prisma } from '@capstack/db';
import { performSoftPull } from '@capstack/kyc';
import { authorizeOpsRequest } from '@/lib/ops-auth';

const APPLICATION_WRITE_ROLES = ['ADMIN', 'UNDERWRITER', 'CREDIT_OFFICER', 'COMPLIANCE'];

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try {
    return [null, await p];
  } catch (err) {
    return [err instanceof Error ? err : new Error(String(err)), null];
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeOpsRequest(req, APPLICATION_WRITE_ROLES);
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await params;
  const actor = auth.identity.actor;

  const [loadErr, application] = await to(
    prisma.application.findFirst({
      where: {
        id,
        product: { is: { lenderId: auth.identity.lenderId } },
      },
      select: {
        id: true,
        borrower: {
          select: {
            id: true,
            type: true,
            individual: {
              select: {
                fullName: true,
                idNumber: true,
              },
            },
            consents: {
              where: { scope: 'BUREAU' },
              select: {
                grantedAt: true,
                revokedAt: true,
              },
            },
          },
        },
      },
    }),
  );

  if (loadErr) return NextResponse.json({ error: 'DB error' }, { status: 500 });
  if (!application) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

  const hasConsent = application.borrower.consents.some((consent) => consent.revokedAt == null);
  const individual = application.borrower.individual;

  if (application.borrower.type !== 'INDIVIDUAL' || !individual?.idNumber || !individual.fullName) {
    await logBureauFailure(id, actor, 'Bureau pull is only available for individual borrowers with an ID number.');
    return NextResponse.json({ error: 'Bureau pull is only available for individual borrowers with an ID number.' }, { status: 409 });
  }

  if (!hasConsent) {
    await logBureauFailure(id, actor, 'Borrower consent is required before bureau enquiry (NCA s.68).');
    return NextResponse.json({ error: 'Borrower consent is required before bureau enquiry (NCA s.68).' }, { status: 409 });
  }

  const [firstName, ...rest] = individual.fullName.trim().split(/\s+/);
  const lastName = rest.join(' ') || firstName;
  const [bureauErr, bureauResult] = await to(
    performSoftPull({
      borrowerId: application.borrower.id,
      idNumber: individual.idNumber,
      firstName,
      lastName,
      consentGranted: true,
    }),
  );

  if (bureauErr || !bureauResult) {
    const message = bureauErr?.message ?? 'Bureau pull failed.';
    await logBureauFailure(id, actor, message);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const bureauPayload = JSON.parse(JSON.stringify(bureauResult)) as Prisma.InputJsonValue;

  const [, logged] = await to(
    prisma.$transaction(async (tx) => {
      const event = await tx.applicationEvent.create({
        data: {
          applicationId: id,
          type: 'BUREAU_PULL_COMPLETED',
          actor,
          payload: bureauPayload,
        },
      });

      await tx.auditLog.create({
        data: {
          actor,
          actorType: 'USER',
          action: 'APPLICATION_BUREAU_PULL_COMPLETED',
          resource: 'APPLICATION',
          resourceId: id,
          after: {
            provider: bureauResult.provider,
            bureauScore: bureauResult.bureauScore,
            defaultCount: bureauResult.defaultCount,
            judgementCount: bureauResult.judgementCount,
            enquiryCount: bureauResult.enquiryCount,
          },
        },
      });

      return event;
    }),
  );

  return NextResponse.json({
    ...bureauResult,
    eventId: logged?.id ?? null,
  });
}

async function logBureauFailure(applicationId: string, actor: string, error: string) {
  await prisma.$transaction(async (tx) => {
    await tx.applicationEvent.create({
      data: {
        applicationId,
        type: 'BUREAU_PULL_FAILED',
        actor,
        payload: { error },
      },
    });

    await tx.auditLog.create({
      data: {
        actor,
        actorType: 'USER',
        action: 'APPLICATION_BUREAU_PULL_FAILED',
        resource: 'APPLICATION',
        resourceId: applicationId,
        after: { error },
      },
    });
  }).catch(() => {
    // Best effort; original failure is still returned to the caller.
  });
}