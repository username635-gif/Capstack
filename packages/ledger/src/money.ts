/**
 * Money — stores values as integer cents to avoid floating-point errors.
 */
export class Money {
  private readonly cents: bigint;

  private constructor(cents: bigint) {
    this.cents = cents;
  }

  static fromCents(cents: number | bigint): Money {
    return new Money(BigInt(cents));
  }

  static fromAmount(amount: number): Money {
    return new Money(BigInt(Math.round(amount * 100)));
  }

  add(other: Money): Money {
    return new Money(this.cents + other.cents);
  }

  subtract(other: Money): Money {
    return new Money(this.cents - other.cents);
  }

  multiply(factor: number): Money {
    return new Money(BigInt(Math.round(Number(this.cents) * factor)));
  }

  getCents(): number {
    return Number(this.cents);
  }

  getCentsBigInt(): bigint {
    return this.cents;
  }

  toAmount(): number {
    return Number(this.cents) / 100;
  }

  toString(): string {
    return this.toAmount().toFixed(2);
  }

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
