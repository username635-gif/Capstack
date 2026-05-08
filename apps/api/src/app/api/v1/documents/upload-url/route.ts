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

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY     ?? '',
    secretAccessKey: process.env.R2_SECRET_KEY     ?? '',
  },
});

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

  const key    = `borrowers/${borrowerId}/${Date.now()}-${fileName}`;
  const Bucket = process.env.R2_BUCKET ?? 'capstack-documents';

  const command = new PutObjectCommand({ Bucket, Key: key, ContentType: fileType });

  const [signErr, url] = await to(getSignedUrl(r2, command, { expiresIn: 3600 }));

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
