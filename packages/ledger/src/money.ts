/**
 * Money — Immutable value object that stores monetary amounts as integer cents
 * (bigint) to completely avoid floating-point rounding errors.
 *
 * WHY BIGINT?
 *   JavaScript's number type uses IEEE 754 doubles, which cannot represent all
 *   decimal fractions exactly. For example: 0.1 + 0.2 === 0.30000000000000004.
 *   Storing cents as bigint eliminates this class of bug entirely.
 *
 * USAGE:
 *   const price  = Money.fromAmount(99.99);  // from a decimal amount
 *   const fee    = Money.fromCents(500);      // from integer cents
 *   const total  = price.add(fee);           // arithmetic returns new Money
 *   console.log(total.toString());           // '104.99'
 *   console.log(total.getCents());           // 10499
 *
 * IMPORTANT:
 *   - Never use Money.fromAmount() with a number calculated via floating-point
 *     arithmetic (e.g. price * 1.15). Always do integer arithmetic on cents first.
 *   - The constructor is private — always use the static factory methods.
 *   - All operations return a NEW Money instance (immutable).
 */
export class Money {
  private readonly cents: bigint;

  private constructor(cents: bigint) {
    this.cents = cents;
  }

  /** Create from an integer cents value (safe, no rounding). */
  static fromCents(cents: number | bigint): Money {
    return new Money(BigInt(cents));
  }

  /**
   * Create from a decimal amount string/number (e.g. 99.99).
   * Uses Math.round to convert to cents — safe for values with at most 2 decimal places.
   * Do NOT pass a float that was computed via arithmetic (floating-point error can occur).
   */
  static fromAmount(amount: number): Money {
    return new Money(BigInt(Math.round(amount * 100)));
  }

  /** Returns a new Money equal to this + other. */
  add(other: Money): Money {
    return new Money(this.cents + other.cents);
  }

  /** Returns a new Money equal to this - other. Does NOT guard against negatives. */
  subtract(other: Money): Money {
    return new Money(this.cents - other.cents);
  }

  /**
   * Multiply by a decimal factor (e.g. 1.15 for 15% markup).
   * Uses Math.round to stay on integer cents — introduces at most 0.5 cent rounding.
   * For APR/fee calculations always use basis-points (integer) arithmetic where possible.
   */
  multiply(factor: number): Money {
    return new Money(BigInt(Math.round(Number(this.cents) * factor)));
  }

  /** Return cents as a plain number (safe as long as value < Number.MAX_SAFE_INTEGER). */
  getCents(): number {
    return Number(this.cents);
  }

  /** Return cents as bigint for use in Prisma queries (schema stores amounts as BigInt). */
  getCentsBigInt(): bigint {
    return this.cents;
  }

  /** Return the decimal amount (cents / 100). */
  toAmount(): number {
    return Number(this.cents) / 100;
  }

  /** Return a 2-decimal-place string (e.g. '1234.50'). Suitable for display / JSON. */
  toString(): string {
    return this.toAmount().toFixed(2);
  }

  /** Strict equality — both values must be the same currency amount. */
  equals(other: Money): boolean {
    return this.cents === other.cents;
  }

  isGreaterThan(other: Money): boolean {
    return this.cents > other.cents;
  }

  isLessThan(other: Money): boolean {
    return this.cents < other.cents;
  }
}
