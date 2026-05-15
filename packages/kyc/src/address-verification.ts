/**
 * Address verification stub.
 *
 * WHY THIS EXISTS:
 *   FICA (Financial Intelligence Centre Act) and the NCA require lenders to
 *   verify a borrower's residential address before extending credit. This is
 *   part of the Customer Due Diligence (CDD) obligation under FICA s.21.
 *
 * VERIFICATION METHODS (in order of preference):
 *   1. Open-banking address (from Stitch bank account — most reliable for SA)
 *   2. Document OCR   — extract address from uploaded utility bill / lease
 *   3. Postal database lookup — match against SAPO / Lightstone address database
 *   4. Manual review   — agent visually checks uploaded proof-of-address doc
 *
 * PRODUCTION INTEGRATION OPTIONS:
 *   - Lightstone Property:   https://www.lightstone.co.za — SA address/property data
 *   - AfriGIS:               https://www.afrigis.co.za — geocoding + address validation
 *   - Google Maps Geocoding: quick globally, but not authoritative for compliance
 *   - Onfido Document OCR:   extract and verify address from a utility bill upload;
 *     use existing Onfido applicant (see onfido.ts) with document type 'UTILITY_BILL'
 *
 * INTEGRATION STEPS (AfriGIS example):
 *   1. Set env vars: AFRIGIS_API_KEY, AFRIGIS_BASE_URL
 *   2. Replace stub body in verifyAddress() with REST call to AfriGIS Address API
 *   3. Store result in KycCheck table (type = 'ADDRESS_VERIFICATION')
 *
 * Patterns applied:
 *   1. Early return — validate required fields
 *   3. Nullish coalescing — env var access
 *   6. to() helper
 *   7. Property shorthand
 *   8. Composition — verifyAddress feeds into KYC pipeline
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AddressInput {
  borrowerId:    string;
  streetAddress: string;  // e.g. "12 Long Street"
  suburb:        string;  // e.g. "Gardens"
  city:          string;  // e.g. "Cape Town"
  postalCode:    string;  // SA 4-digit postal code
  province:      string;  // e.g. "Western Cape"
  countryCode:   string;  // ISO 2-letter, e.g. "ZA"
}

export type AddressVerificationStatus =
  | 'VERIFIED'          // address confirmed as deliverable and geocoded
  | 'PARTIAL_MATCH'     // some components match, manual review recommended
  | 'NOT_FOUND'         // address not found in postal database
  | 'INVALID_FORMAT';   // malformed input (missing suburb, wrong postal code format, etc.)

export interface AddressVerificationResult {
  borrowerId:    string;
  status:        AddressVerificationStatus;
  normalised:    AddressInput;     // cleaned/standardised version of the address
  confidence:    number;           // 0–100 match confidence
  geocoded?: {
    latitude:  number;
    longitude: number;
  };
  provider:      string;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try {
    return [null, await p];
  } catch (err) {
    return [err instanceof Error ? err : new Error(String(err)), null];
  }
}

// ─── Implementation (stub) ────────────────────────────────────────────────────

/**
 * Verify a South African residential address against a postal database.
 *
 * Pattern 8 — pipeline: validate → normalise → geocode → return
 */
export async function verifyAddress(input: AddressInput): Promise<AddressVerificationResult> {
  // Pattern 1 — early return on missing required fields
  if (!input.borrowerId || !input.streetAddress || !input.postalCode) {
    throw new Error('verifyAddress: borrowerId, streetAddress, and postalCode are required');
  }

  // SA postal codes are exactly 4 digits
  if (!/^\d{4}$/.test(input.postalCode)) {
    return {
      borrowerId: input.borrowerId,
      status:     'INVALID_FORMAT',
      normalised: input,
      confidence: 0,
      provider:   'stub',
    };
  }

  // Production: call AfriGIS or Lightstone address validation API
  //
  //   const baseUrl = process.env.AFRIGIS_BASE_URL ?? 'https://afrigis.co.za/api';
  //   const [err, res] = await to(
  //     fetch(`${baseUrl}/v2/address/validate`, {
  //       method: 'POST',
  //       headers: {
  //         'X-Api-Key': process.env.AFRIGIS_API_KEY ?? '',
  //         'Content-Type': 'application/json',
  //       },
  //       body: JSON.stringify({
  //         addressLine1: input.streetAddress,
  //         addressLine2: input.suburb,
  //         city:         input.city,
  //         postalCode:   input.postalCode,
  //         country:      input.countryCode,
  //       }),
  //     }).then(r => r.json()),
  //   );
  //   if (err) throw err;
  //   return _mapAfriGISResponse(input.borrowerId, res);

  // Stub: normalise the address and return a high-confidence match
  const normalised: AddressInput = {
    borrowerId:    input.borrowerId,
    streetAddress: input.streetAddress.trim(),
    suburb:        input.suburb.trim(),
    city:          input.city.trim(),
    postalCode:    input.postalCode.trim(),
    province:      input.province.trim(),
    countryCode:   input.countryCode.toUpperCase(),
  };

  const status: AddressVerificationStatus = 'VERIFIED';
  const confidence = 95;

  // Pattern 7 — shorthand
  return {
    borrowerId: input.borrowerId,
    status,
    normalised,
    confidence,
    geocoded: { latitude: -33.9249, longitude: 18.4241 }, // stub: Cape Town CBD
    provider: 'stub',
  };
}

/**
 * Extract and verify an address directly from a scanned document
 * (utility bill, lease agreement, bank statement header).
 *
 * In production: send the document to Onfido with documentType = 'UTILITY_BILL'
 * and read back the extracted address fields from the check result.
 */
export async function verifyAddressFromDocument(
  borrowerId: string,
  documentUrl: string,
): Promise<AddressVerificationResult> {
  // Pattern 1 — early return on missing params
  if (!borrowerId || !documentUrl) {
    throw new Error('verifyAddressFromDocument: borrowerId and documentUrl are required');
  }

  // Stub: pretend the document OCR returned a Cape Town address
  const stubAddress: AddressInput = {
    borrowerId,
    streetAddress: '1 Stub Street',
    suburb:        'Gardens',
    city:          'Cape Town',
    postalCode:    '8001',
    province:      'Western Cape',
    countryCode:   'ZA',
  };

  return verifyAddress(stubAddress);
}
