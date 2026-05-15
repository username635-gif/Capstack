/**
 * POST /api/v1/documents/upload-url
 *
 * Returns a pre-signed PUT URL for the client to upload a document
 * directly to Cloudflare R2 without routing the binary through our server.
 * Also creates a BorrowerDocument record in the database.
 *
 * Patterns applied:
 *   1. Early return — validate required fields immediately
 *   3. Nullish coalescing — env var defaults
 *   4. Destructuring — request body
 *   6. to() helper — wrap S3 / DB calls
 *   7. Property shorthand
 */

import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { prisma } from '@capstack/db';
import { getR2Env } from '@/lib/env';

function createR2Client() {
  const r2Env = getR2Env();

  return {
    client: new S3Client({
      region: 'auto',
      endpoint: r2Env.endpoint,
      credentials: {
        accessKeyId: r2Env.accessKeyId,
        secretAccessKey: r2Env.secretAccessKey,
      },
    }),
    bucket: r2Env.bucket,
  };
}

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try {
    return [null, await p];
  } catch (err) {
    return [err instanceof Error ? err : new Error(String(err)), null];
  }
}

export async function POST(req: NextRequest) {
  const [parseErr, body] = await to<{ borrowerId: string; fileName: string; fileType: string }>(req.json());

  // Pattern 1 — early return on bad JSON
  if (parseErr) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  // Pattern 4 — destructure
  const { borrowerId, fileName, fileType } = body!;

  // Pattern 1 — early return on missing params
  if (!borrowerId || !fileName || !fileType) {
    return NextResponse.json({ error: 'Missing borrowerId, fileName or fileType' }, { status: 400 });
  }

  const key = `borrowers/${borrowerId}/${Date.now()}-${fileName}`;

  let r2: ReturnType<typeof createR2Client>;
  try {
    r2 = createR2Client();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Document storage is not configured';
    console.error('[upload-url] configuration failed:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const command = new PutObjectCommand({ Bucket: r2.bucket, Key: key, ContentType: fileType });

  const [signErr, url] = await to(getSignedUrl(r2.client, command, { expiresIn: 3600 }));

  // Pattern 1 — early return on signing failure
  if (signErr) {
    console.error('[upload-url] pre-sign failed:', signErr);
    return NextResponse.json({ error: 'Could not generate upload URL' }, { status: 500 });
  }

  const [dbErr] = await to(
    prisma.borrowerDocument.create({
      data: {
        borrowerId,
        fileName,
        storageKey: key,
        type: 'BANK_STATEMENT_PDF',
      },
    }),
  );

  if (dbErr) {
    console.error('[upload-url] DB create failed:', dbErr);
    return NextResponse.json({ error: 'Failed to register document' }, { status: 500 });
  }

  // Pattern 7 — property shorthand
  return NextResponse.json({ url, key });
}
