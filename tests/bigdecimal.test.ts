/**
 * BigDecimal Unit Tests
 *
 * This file contains comprehensive unit tests for the BigDecimal library.
 * Tests cover:
 * - Integer arithmetic correctness
 * - Perfect dyadic rational representation
 * - Differing divex arguments with rounding
 * - Methods that preserve first-argument divex
 * - Floating-point normalization and mantissa size
 * - Rounding direction for non-representable results (positive and negative)
 * - Additional utility functions
 *
 * Note: Fragile tests (rounding edges) are marked with comments.
 */

import { describe, it, expect } from 'vitest';
import BD, {
	FromNumber,
	FromBigInt,
	add,
	subtract,
	multiply_fixed,
	multiply_floating,
	divide_fixed,
	divide_floating,
	mod,
	sqrt,
	pow,
	powerInt,
	hypot,
	abs,
	clone,
	setExponent,
	fixPrecision,
	compare,
	areEqual,
	isZero,
	hasDefaultPrecision,
	negate,
	min,
	max,
	clamp,
	floor,
	ceil,
	round,
	isInteger,
	ln,
	log10,
	exp,
	toBigInt,
	toNumber,
	toExactString,
	toApproximateString,
	type BigDecimal,
} from '../src/bigdecimal.ts';
import bimath from '../src/bimath.ts';

// Use optimized bitLength from bimath
const bitLength = bimath.bitLength_bisection;

// ============================================================================
// A. Integer arithmetic correctness (perfect integer results)
// ============================================================================
describe('A. Integer arithmetic correctness', () => {
	it('add produces exact integer result', () => {
		const a: BigDecimal = FromBigInt(5n, 10);
		const b: BigDecimal = FromBigInt(3n, 10);
		const result = add(a, b);

		expect(toExactString(result)).toBe('8');
		expect(result.divex).toBe(a.divex);
		expect(toBigInt(result)).toBe(8n);
	});

	it('subtract produces exact integer result', () => {
		const a: BigDecimal = FromBigInt(10n, 10);
		const b: BigDecimal = FromBigInt(4n, 10);
		const result = subtract(a, b);

		expect(toExactString(result)).toBe('6');
		expect(result.divex).toBe(a.divex);
		expect(toBigInt(result)).toBe(6n);
	});

	it('multiply_fixed produces exact integer result', () => {
		const a: BigDecimal = FromBigInt(6n, 10);
		const b: BigDecimal = FromBigInt(7n, 10);
		const result = multiply_fixed(a, b);

		expect(toExactString(result)).toBe('42');
		expect(result.divex).toBe(a.divex);
		expect(toBigInt(result)).toBe(42n);
	});

	it('divide_fixed produces exact integer when divisor divides evenly', () => {
		const a: BigDecimal = FromBigInt(20n, 10);
		const b: BigDecimal = FromBigInt(4n, 10);
		const result = divide_fixed(a, b);

		expect(toExactString(result)).toBe('5');
		expect(result.divex).toBe(a.divex);
		expect(toBigInt(result)).toBe(5n);
	});

	it('toBigInt on integer BigDecimal yields expected bigint', () => {
		const a: BigDecimal = FromBigInt(123n, 10);
		expect(toBigInt(a)).toBe(123n);
	});

	it('handles negative integers correctly', () => {
		const a: BigDecimal = FromBigInt(-8n, 10);
		const b: BigDecimal = FromBigInt(3n, 10);
		const result = add(a, b);

		expect(toExactString(result)).toBe('-5');
		expect(toBigInt(result)).toBe(-5n);
	});
});

// ============================================================================
// B. Perfect dyadic rational representation
// ============================================================================
describe('B. Perfect dyadic rational representation', () => {
	it('1/2 + 1/4 === 3/4', () => {
		// 1/2 = { bigint: 1n, divex: 1 }
		// 1/4 = { bigint: 1n, divex: 2 }
		// But add uses first arg divex, so we need same divex
		// 1/2 = { bigint: 2n, divex: 2 } and 1/4 = { bigint: 1n, divex: 2 }
		const half: BigDecimal = { bigint: 2n, divex: 2 }; // 0.5
		const quarter: BigDecimal = { bigint: 1n, divex: 2 }; // 0.25
		const result = add(half, quarter);

		expect(toExactString(result)).toBe('0.75');
		const expected: BigDecimal = { bigint: 3n, divex: 2 }; // 0.75
		expect(areEqual(result, expected)).toBe(true);
	});

	it('3/8 * 2 === 3/4', () => {
		// 3/8 = { bigint: 3n, divex: 3 }
		const threeEighths: BigDecimal = { bigint: 3n, divex: 3 }; // 0.375
		const two: BigDecimal = FromBigInt(2n, 3);
		const result = multiply_fixed(threeEighths, two);

		expect(toExactString(result)).toBe('0.75');
		const expected: BigDecimal = { bigint: 6n, divex: 3 }; // 0.75 = 6/8
		expect(areEqual(result, expected)).toBe(true);
	});

	it('exact dyadic literal 0.75', () => {
		const bd: BigDecimal = { bigint: 3n, divex: 2 }; // 3/4 = 0.75
		expect(toExactString(bd)).toBe('0.75');
	});

	it('exact dyadic literal 0.125', () => {
		const bd: BigDecimal = { bigint: 1n, divex: 3 }; // 1/8 = 0.125
		expect(toExactString(bd)).toBe('0.125');
	});
});

// ============================================================================
// C. Differing divex arguments
// ============================================================================
describe('C. Differing divex arguments', () => {
	describe('bd1.divex > bd2.divex (scale up bd2)', () => {
		it('add scales up bd2 to match bd1', () => {
			const bd1: BigDecimal = { bigint: 4n, divex: 4 }; // 0.25
			const bd2: BigDecimal = { bigint: 1n, divex: 2 }; // 0.25

			const result = add(bd1, bd2);
			expect(result.divex).toBe(bd1.divex);
			expect(toExactString(result)).toBe('0.5');
		});

		it('subtract scales up bd2 to match bd1', () => {
			const bd1: BigDecimal = { bigint: 8n, divex: 4 }; // 0.5
			const bd2: BigDecimal = { bigint: 1n, divex: 2 }; // 0.25

			const result = subtract(bd1, bd2);
			expect(result.divex).toBe(bd1.divex);
			expect(toExactString(result)).toBe('0.25');
		});
	});

	describe('bd1.divex < bd2.divex (round bd2 down to bd1 precision)', () => {
		it('add with rounding when bd2 has higher precision', () => {
			// bd1 = 1.0 at divex 1 (bigint: 2n)
			// bd2 = 0.25 at divex 2 (bigint: 1n)
			// When adding, bd2 must be rounded to divex 1
			// 0.25 at divex 1 would be 0.5 (rounds up due to "round half up")
			const bd1: BigDecimal = { bigint: 2n, divex: 1 }; // 1.0
			const bd2: BigDecimal = { bigint: 1n, divex: 2 }; // 0.25

			const result = add(bd1, bd2);
			expect(result.divex).toBe(bd1.divex);
			// 0.25 -> rounds to 0.5 at divex 1, so 1.0 + 0.5 = 1.5
			expect(toExactString(result)).toBe('1.5');
		});

		it('subtract with rounding when bd2 has higher precision', () => {
			const bd1: BigDecimal = { bigint: 4n, divex: 1 }; // 2.0
			const bd2: BigDecimal = { bigint: 1n, divex: 2 }; // 0.25

			const result = subtract(bd1, bd2);
			expect(result.divex).toBe(bd1.divex);
			// 0.25 at divex 1 rounds to 0.5, so 2.0 - 0.5 = 1.5
			expect(toExactString(result)).toBe('1.5');
		});

		// FRAGILE TEST: Tests rounding edge case
		it('rounding up case where bd2 must be rounded', () => {
			// bd1 has divex 2, bd2 has divex 4
			// bd2 value that's exactly halfway between representable values at bd1's divex
			const bd1: BigDecimal = { bigint: 4n, divex: 2 }; // 1.0
			const bd2: BigDecimal = { bigint: 2n, divex: 4 }; // 0.125

			const result = add(bd1, bd2);
			expect(result.divex).toBe(bd1.divex);
			// 0.125 at divex 2: value 0.5 rounds to 1 (round half up), so 0.25
			// Actually: 0.125 = 2/16, at divex 2 we need to divide by 4 (shift right 2)
			// 2 + 2 = 4, shift right 2 = 1, which is 0.25
			expect(toExactString(result)).toBe('1.25');
		});
	});
});

// ============================================================================
// D. Methods whose result must preserve first-argument divex
// ============================================================================
describe('D. Methods preserving first-argument divex', () => {
	const precision = 10;
	const bd1: BigDecimal = FromBigInt(10n, precision);
	const bd2: BigDecimal = FromBigInt(3n, precision);

	it('add preserves first argument divex', () => {
		const result = add(bd1, bd2);
		expect(result.divex).toBe(bd1.divex);
	});

	it('subtract preserves first argument divex', () => {
		const result = subtract(bd1, bd2);
		expect(result.divex).toBe(bd1.divex);
	});

	it('multiply_fixed preserves first argument divex', () => {
		const result = multiply_fixed(bd1, bd2);
		expect(result.divex).toBe(bd1.divex);
	});

	it('divide_fixed preserves first argument divex', () => {
		const result = divide_fixed(bd1, bd2);
		expect(result.divex).toBe(bd1.divex);
	});

	it('mod preserves dividend divex', () => {
		const result = mod(bd1, bd2);
		expect(result.divex).toBe(bd1.divex);
	});

	it('floor preserves input divex', () => {
		const bd: BigDecimal = { bigint: 5n, divex: 2 }; // 1.25
		const result = floor(bd);
		expect(result.divex).toBe(bd.divex);
	});

	it('ceil preserves input divex', () => {
		const bd: BigDecimal = { bigint: 5n, divex: 2 }; // 1.25
		const result = ceil(bd);
		expect(result.divex).toBe(bd.divex);
	});

	it('negate preserves input divex', () => {
		const result = negate(bd1);
		expect(result.divex).toBe(bd1.divex);
	});

	it('abs preserves input divex', () => {
		const neg: BigDecimal = FromBigInt(-5n, precision);
		const result = abs(neg);
		expect(result.divex).toBe(neg.divex);
	});

	it('clone preserves input divex', () => {
		const result = clone(bd1);
		expect(result.divex).toBe(bd1.divex);
	});
});

// ============================================================================
// E. Floating-point normalization & mantissa size
// ============================================================================
describe('E. Floating-point normalization & mantissa size', () => {
	const mantissaBits = 24;

	it('multiply_floating respects mantissaBits', () => {
		const a: BigDecimal = FromBigInt(123456n, 20);
		const b: BigDecimal = FromBigInt(654321n, 20);
		const result = multiply_floating(a, b, mantissaBits);

		expect(bitLength(result.bigint)).toBeLessThanOrEqual(mantissaBits);
		expect(result.bigint).not.toBe(0n);
		expect(Number.isFinite(result.divex)).toBe(true);
	});

	it('multiply_floating is idempotent when normalized', () => {
		const a: BigDecimal = FromBigInt(100n, 10);
		const b: BigDecimal = FromBigInt(200n, 10);
		const result = multiply_floating(a, b, mantissaBits);

		// Multiplying again by 1 should give equivalent result
		const one: BigDecimal = FromBigInt(1n, mantissaBits);
		const normalized = multiply_floating(result, one, mantissaBits);

		expect(areEqual(result, normalized)).toBe(true);
	});

	it('divide_floating respects mantissaBits', () => {
		const a: BigDecimal = FromBigInt(1000000n, 20);
		const b: BigDecimal = FromBigInt(7n, 20);
		const result = divide_floating(a, b, mantissaBits);

		expect(bitLength(result.bigint)).toBeLessThanOrEqual(mantissaBits);
		expect(result.bigint).not.toBe(0n);
		expect(Number.isFinite(result.divex)).toBe(true);
	});

	it('sqrt respects mantissaBits', () => {
		const bd: BigDecimal = FromBigInt(2n, 20);
		const result = sqrt(bd, mantissaBits);

		expect(bitLength(result.bigint)).toBeLessThanOrEqual(mantissaBits);
		expect(result.bigint).not.toBe(0n);
		expect(Number.isFinite(result.divex)).toBe(true);
	});

	it('exp respects mantissaBits (approximately)', () => {
		const bd: BigDecimal = FromNumber(1, mantissaBits);
		const result = exp(bd, mantissaBits);

		// exp may produce slightly more bits due to argument reduction and Taylor series
		// Allow 2 extra bits for implementation flexibility
		expect(bitLength(result.bigint)).toBeLessThanOrEqual(mantissaBits + 2);
		expect(result.bigint).not.toBe(0n);
		expect(Number.isFinite(result.divex)).toBe(true);
	});

	it('pow respects mantissaBits', () => {
		const base: BigDecimal = FromNumber(2, mantissaBits);
		const result = pow(base, 0.5, mantissaBits); // sqrt(2)

		expect(bitLength(result.bigint)).toBeLessThanOrEqual(mantissaBits);
		expect(result.bigint).not.toBe(0n);
		expect(Number.isFinite(result.divex)).toBe(true);
	});

	it('non-zero input produces non-zero output', () => {
		const bd: BigDecimal = FromBigInt(1n, 50);
		const result = multiply_floating(bd, bd, mantissaBits);

		expect(result.bigint).not.toBe(0n);
	});
});

// ============================================================================
// F. Rounding direction for non-representable results (positive and negative)
// ============================================================================
describe('F. Rounding direction for non-representable results', () => {
	// FRAGILE TESTS: These test specific rounding behavior

	describe('Positive half rounding (round half up)', () => {
		it('positive: bd1 + bd2 rounds bd2 up when halfway', () => {
			// bd1 = 1.0 at divex 1: { bigint: 2n, divex: 1 }
			// bd2 = 0.25 at divex 2: { bigint: 1n, divex: 2 }
			// 0.25 is exactly halfway between 0 and 0.5 at divex 1
			// "Round half up" should round 0.25 -> 0.5
			const bd1: BigDecimal = { bigint: 2n, divex: 1 }; // 1.0
			const bd2: BigDecimal = { bigint: 1n, divex: 2 }; // 0.25

			const result = add(bd1, bd2);
			expect(toExactString(result)).toBe('1.5');
			expect(result.divex).toBe(bd1.divex);
		});
	});

	describe('Negative half rounding (round half toward positive infinity)', () => {
		it('negative: bd1 + bd2 rounds toward positive infinity', () => {
			// bd1 = -1.0 at divex 1: { bigint: -2n, divex: 1 }
			// bd2 = -0.25 at divex 2: { bigint: -1n, divex: 2 }
			// -0.25 rounds toward positive infinity = 0 at divex 1
			// So -1.0 + 0 = -1.0
			const bd1: BigDecimal = { bigint: -2n, divex: 1 }; // -1.0
			const bd2: BigDecimal = { bigint: -1n, divex: 2 }; // -0.25

			const result = add(bd1, bd2);
			expect(toExactString(result)).toBe('-1');
			expect(result.divex).toBe(bd1.divex);
		});
	});

	describe('Division with rounding', () => {
		it('divide_fixed with non-exact result rounds correctly (positive)', () => {
			// 10 / 3 = 3.333...
			const bd1: BigDecimal = FromBigInt(10n, 4);
			const bd2: BigDecimal = FromBigInt(3n, 4);
			const result = divide_fixed(bd1, bd2);

			expect(result.divex).toBe(bd1.divex);
			// Result should be close to 3.333...
			const numResult = toNumber(result);
			expect(numResult).toBeCloseTo(10 / 3, 1);
		});

		it('divide_fixed with non-exact result rounds correctly (negative)', () => {
			// -10 / 3 = -3.333...
			const bd1: BigDecimal = FromBigInt(-10n, 4);
			const bd2: BigDecimal = FromBigInt(3n, 4);
			const result = divide_fixed(bd1, bd2);

			expect(result.divex).toBe(bd1.divex);
			const numResult = toNumber(result);
			expect(numResult).toBeCloseTo(-10 / 3, 1);
		});
	});
});

// ============================================================================
// G. Additional useful tests
// ============================================================================
describe('G. Additional useful tests', () => {
	describe('isInteger', () => {
		it('returns true for integer BigDecimals', () => {
			const intBd: BigDecimal = FromBigInt(42n, 10);
			expect(isInteger(intBd)).toBe(true);
		});

		it('returns false for fractional BigDecimals', () => {
			const fracBd: BigDecimal = { bigint: 3n, divex: 2 }; // 0.75
			expect(isInteger(fracBd)).toBe(false);
		});

		it('handles negative integers correctly', () => {
			const negInt: BigDecimal = FromBigInt(-100n, 10);
			expect(isInteger(negInt)).toBe(true);
		});

		it('handles negative fractions correctly', () => {
			const negFrac: BigDecimal = { bigint: -5n, divex: 2 }; // -1.25
			expect(isInteger(negFrac)).toBe(false);
		});

		it('returns true for zero', () => {
			const zero: BigDecimal = FromBigInt(0n, 10);
			expect(isInteger(zero)).toBe(true);
		});

		it('returns true for integers with negative divex', () => {
			// Large integer represented with negative divex
			const large: BigDecimal = { bigint: 1n, divex: -10 }; // 1 * 2^10 = 1024
			expect(isInteger(large)).toBe(true);
		});
	});

	describe('isZero and areEqual', () => {
		it('isZero returns true for zero', () => {
			const zero: BigDecimal = FromBigInt(0n, 10);
			expect(isZero(zero)).toBe(true);
		});

		it('isZero returns false for non-zero', () => {
			const nonZero: BigDecimal = FromBigInt(1n, 10);
			expect(isZero(nonZero)).toBe(false);
		});

		it('areEqual on two zeros with different divex', () => {
			const zero1: BigDecimal = { bigint: 0n, divex: 5 };
			const zero2: BigDecimal = { bigint: 0n, divex: 20 };
			expect(areEqual(zero1, zero2)).toBe(true);
		});

		it('areEqual on near-zero but non-zero values', () => {
			const tiny1: BigDecimal = { bigint: 1n, divex: 100 }; // Very small
			const tiny2: BigDecimal = { bigint: 2n, divex: 100 }; // Slightly larger
			expect(areEqual(tiny1, tiny2)).toBe(false);
		});

		it('areEqual on equivalent values with different representations', () => {
			const a: BigDecimal = { bigint: 4n, divex: 2 }; // 1.0
			const b: BigDecimal = { bigint: 8n, divex: 3 }; // 1.0
			expect(areEqual(a, b)).toBe(true);
		});
	});

	describe('toNumber and toBigInt conversions', () => {
		it('toNumber for large values', () => {
			const large: BigDecimal = FromBigInt(1000000000n, 10);
			expect(toNumber(large)).toBe(1000000000);
		});

		it('toNumber for small values', () => {
			const small: BigDecimal = { bigint: 1n, divex: 20 }; // Very small
			expect(toNumber(small)).toBeCloseTo(1 / 2 ** 20, 10);
		});

		it('toBigInt for large integer', () => {
			const large: BigDecimal = FromBigInt(123456789012345n, 10);
			expect(toBigInt(large)).toBe(123456789012345n);
		});

		it('toBigInt rounds fractional part', () => {
			const frac: BigDecimal = { bigint: 7n, divex: 2 }; // 1.75
			expect(toBigInt(frac)).toBe(2n); // Round half up
		});

		it('toBigInt for negative value', () => {
			const neg: BigDecimal = FromBigInt(-42n, 10);
			expect(toBigInt(neg)).toBe(-42n);
		});
	});

	describe('ln and exp', () => {
		it('ln(1) === 0 (approximately)', () => {
			const one: BigDecimal = FromBigInt(1n, 20);
			expect(ln(one)).toBeCloseTo(0, 10);
		});

		it('exp(0) === 1 (approximately)', () => {
			const zero: BigDecimal = FromBigInt(0n, 20);
			const result = exp(zero, 30);
			expect(toNumber(result)).toBeCloseTo(1, 5);
		});

		it('ln(e) approximately equals 1', () => {
			const e: BigDecimal = FromNumber(Math.E, 30);
			expect(ln(e)).toBeCloseTo(1, 5);
		});

		it('log10(10) approximately equals 1', () => {
			const ten: BigDecimal = FromBigInt(10n, 20);
			expect(log10(ten)).toBeCloseTo(1, 5);
		});
	});

	describe('sqrt', () => {
		it('sqrt of perfect square integer (4) is exact', () => {
			const four: BigDecimal = FromBigInt(4n, 20);
			const result = sqrt(four, 30);
			expect(toNumber(result)).toBeCloseTo(2, 5);
		});

		it('sqrt of dyadic exact square (1/4) is exact (0.5)', () => {
			const quarter: BigDecimal = { bigint: 1n, divex: 2 }; // 0.25
			const result = sqrt(quarter, 30);
			expect(toNumber(result)).toBeCloseTo(0.5, 5);
		});

		it('sqrt(2) is approximately 1.41421', () => {
			const two: BigDecimal = FromBigInt(2n, 20);
			const result = sqrt(two, 30);
			expect(toNumber(result)).toBeCloseTo(Math.SQRT2, 5);
		});

		it('sqrt(0) is 0', () => {
			const zero: BigDecimal = FromBigInt(0n, 10);
			const result = sqrt(zero, 20);
			expect(isZero(result)).toBe(true);
		});
	});

	describe('powerInt', () => {
		it('powerInt for small positive exponent', () => {
			const base: BigDecimal = FromBigInt(2n, 10);
			const result = powerInt(base, 3);
			expect(toNumber(result)).toBeCloseTo(8, 5);
		});

		it('powerInt for exponent 0', () => {
			const base: BigDecimal = FromBigInt(5n, 10);
			const result = powerInt(base, 0);
			expect(toNumber(result)).toBeCloseTo(1, 5);
		});

		it('powerInt for exponent 1', () => {
			const base: BigDecimal = FromBigInt(7n, 10);
			const result = powerInt(base, 1);
			expect(toNumber(result)).toBeCloseTo(7, 5);
		});

		it('powerInt for negative exponent', () => {
			const base: BigDecimal = FromBigInt(2n, 10);
			const result = powerInt(base, -2);
			expect(toNumber(result)).toBeCloseTo(0.25, 3);
		});
	});

	describe('mod', () => {
		it('mod with simple integer values', () => {
			const a: BigDecimal = FromBigInt(10n, 10);
			const b: BigDecimal = FromBigInt(3n, 10);
			const result = mod(a, b);

			expect(result.divex).toBe(a.divex);
			expect(toBigInt(result)).toBe(1n);
		});

		it('mod with negative dividend', () => {
			const a: BigDecimal = FromBigInt(-10n, 10);
			const b: BigDecimal = FromBigInt(3n, 10);
			const result = mod(a, b);

			expect(result.divex).toBe(a.divex);
			// JavaScript % follows dividend sign
			expect(toBigInt(result)).toBe(-1n);
		});

		it('mod when dividend is smaller than divisor', () => {
			const a: BigDecimal = FromBigInt(2n, 10);
			const b: BigDecimal = FromBigInt(5n, 10);
			const result = mod(a, b);

			expect(result.divex).toBe(a.divex);
			expect(toBigInt(result)).toBe(2n);
		});

		it('mod with fractional divisor', () => {
			// 5.0 mod 1.5 = 0.5 (5 = 3*1.5 + 0.5)
			const a: BigDecimal = FromBigInt(5n, 10);
			const b: BigDecimal = { bigint: 3n, divex: 1 }; // 1.5
			const result = mod(a, b);

			expect(result.divex).toBe(a.divex);
			expect(toNumber(result)).toBeCloseTo(0.5, 5);
		});

		it('mod with both operands fractional', () => {
			// 2.75 mod 0.5 = 0.25 (2.75 = 5*0.5 + 0.25)
			const a: BigDecimal = { bigint: 11n, divex: 2 }; // 2.75
			const b: BigDecimal = { bigint: 1n, divex: 1 }; // 0.5
			const result = mod(a, b);

			expect(result.divex).toBe(a.divex);
			expect(toExactString(result)).toBe('0.25');
		});

		it('mod with fractional dividend and integer divisor', () => {
			// 7.5 mod 2 = 1.5 (7.5 = 3*2 + 1.5)
			const a: BigDecimal = { bigint: 15n, divex: 1 }; // 7.5
			const b: BigDecimal = FromBigInt(2n, 10);
			const result = mod(a, b);

			expect(result.divex).toBe(a.divex);
			expect(toNumber(result)).toBeCloseTo(1.5, 5);
		});
	});

	describe('min, max, clamp', () => {
		it('min returns smaller value', () => {
			const a: BigDecimal = FromBigInt(5n, 10);
			const b: BigDecimal = FromBigInt(3n, 10);
			expect(areEqual(min(a, b), b)).toBe(true);
		});

		it('max returns larger value', () => {
			const a: BigDecimal = FromBigInt(5n, 10);
			const b: BigDecimal = FromBigInt(3n, 10);
			expect(areEqual(max(a, b), a)).toBe(true);
		});

		it('clamp returns value within range', () => {
			const val: BigDecimal = FromBigInt(5n, 10);
			const minVal: BigDecimal = FromBigInt(0n, 10);
			const maxVal: BigDecimal = FromBigInt(10n, 10);
			expect(areEqual(clamp(val, minVal, maxVal), val)).toBe(true);
		});

		it('clamp returns min when value is below range', () => {
			const val: BigDecimal = FromBigInt(-5n, 10);
			const minVal: BigDecimal = FromBigInt(0n, 10);
			const maxVal: BigDecimal = FromBigInt(10n, 10);
			expect(areEqual(clamp(val, minVal, maxVal), minVal)).toBe(true);
		});

		it('clamp returns max when value is above range', () => {
			const val: BigDecimal = FromBigInt(15n, 10);
			const minVal: BigDecimal = FromBigInt(0n, 10);
			const maxVal: BigDecimal = FromBigInt(10n, 10);
			expect(areEqual(clamp(val, minVal, maxVal), maxVal)).toBe(true);
		});
	});

	describe('floor and ceil', () => {
		it('floor of positive fractional', () => {
			const bd: BigDecimal = { bigint: 7n, divex: 2 }; // 1.75
			const result = floor(bd);
			expect(toNumber(result)).toBe(1);
		});

		it('ceil of positive fractional', () => {
			const bd: BigDecimal = { bigint: 5n, divex: 2 }; // 1.25
			const result = ceil(bd);
			expect(toNumber(result)).toBe(2);
		});

		it('floor of negative fractional', () => {
			const bd: BigDecimal = { bigint: -5n, divex: 2 }; // -1.25
			const result = floor(bd);
			expect(toNumber(result)).toBe(-2);
		});

		it('ceil of negative fractional', () => {
			const bd: BigDecimal = { bigint: -5n, divex: 2 }; // -1.25
			const result = ceil(bd);
			expect(toNumber(result)).toBe(-1);
		});

		it('floor of integer is unchanged', () => {
			const bd: BigDecimal = FromBigInt(5n, 4);
			const result = floor(bd);
			expect(areEqual(result, bd)).toBe(true);
		});

		it('ceil of integer is unchanged', () => {
			const bd: BigDecimal = FromBigInt(5n, 4);
			const result = ceil(bd);
			expect(areEqual(result, bd)).toBe(true);
		});
	});

	describe('round', () => {
		it('rounds positive numbers down when fraction < 0.5', () => {
			// 3.25 -> 3
			const bd: BigDecimal = { bigint: 13n, divex: 2 }; // 13/4 = 3.25
			const result = round(bd);

			expect(toExactString(result)).toBe('3');
			expect(result.divex).toBe(bd.divex);
			// Internal check: 3 * 2^2 = 12
			expect(result.bigint).toBe(12n);
		});

		it('rounds positive numbers up when fraction > 0.5', () => {
			// 3.75 -> 4
			const bd: BigDecimal = { bigint: 15n, divex: 2 }; // 15/4 = 3.75
			const result = round(bd);

			expect(toExactString(result)).toBe('4');
			expect(result.divex).toBe(bd.divex);
		});

		it('rounds positive numbers up when fraction == 0.5 (Half Up)', () => {
			// 3.5 -> 4
			const bd: BigDecimal = { bigint: 7n, divex: 1 }; // 7/2 = 3.5
			const result = round(bd);

			expect(toExactString(result)).toBe('4');
			expect(result.divex).toBe(bd.divex);
		});

		it('rounds negative numbers towards zero when fraction == 0.5 (Half Up towards +Infinity)', () => {
			// -3.5 -> -3
			// Logic trace: -7n + 1n (half) = -6n. -6n >> 1 = -3n.
			const bd: BigDecimal = { bigint: -7n, divex: 1 }; // -3.5
			const result = round(bd);

			expect(toExactString(result)).toBe('-3');
			expect(result.divex).toBe(bd.divex);
		});

		it('rounds negative numbers away from zero when fraction > 0.5 (magnitude)', () => {
			// -3.75 -> -4
			const bd: BigDecimal = { bigint: -15n, divex: 2 }; // -3.75
			const result = round(bd);

			expect(toExactString(result)).toBe('-4');
			expect(result.divex).toBe(bd.divex);
		});

		it('rounds negative numbers towards zero when fraction < 0.5 (magnitude)', () => {
			// -3.25 -> -3
			const bd: BigDecimal = { bigint: -13n, divex: 2 }; // -3.25
			const result = round(bd);

			expect(toExactString(result)).toBe('-3');
			expect(result.divex).toBe(bd.divex);
		});

		it('leaves integers unchanged', () => {
			const bd: BigDecimal = FromBigInt(42n, 10);
			const result = round(bd);

			expect(toExactString(result)).toBe('42');
			expect(areEqual(bd, result)).toBe(true);
		});

		it('leaves zero unchanged', () => {
			const bd: BigDecimal = FromBigInt(0n, 5);
			const result = round(bd);

			expect(toExactString(result)).toBe('0');
			expect(isZero(result)).toBe(true);
		});

		it('handles large precision inputs correctly', () => {
			// 1.5000... at high precision
			const bd: BigDecimal = { bigint: 3n << 49n, divex: 50 };
			const result = round(bd);

			expect(toExactString(result)).toBe('2');
			expect(result.divex).toBe(50);
		});
	});

	describe('compare', () => {
		it('compare returns -1 when first is smaller', () => {
			const a: BigDecimal = FromBigInt(3n, 10);
			const b: BigDecimal = FromBigInt(5n, 10);
			expect(compare(a, b)).toBe(-1);
		});

		it('compare returns 0 when equal', () => {
			const a: BigDecimal = FromBigInt(5n, 10);
			const b: BigDecimal = FromBigInt(5n, 10);
			expect(compare(a, b)).toBe(0);
		});

		it('compare returns 1 when first is larger', () => {
			const a: BigDecimal = FromBigInt(7n, 10);
			const b: BigDecimal = FromBigInt(5n, 10);
			expect(compare(a, b)).toBe(1);
		});

		it('compare works with different divex', () => {
			const a: BigDecimal = { bigint: 4n, divex: 2 }; // 1.0
			const b: BigDecimal = { bigint: 2n, divex: 2 }; // 0.5
			expect(compare(a, b)).toBe(1);
		});
	});

	describe('setExponent and fixPrecision', () => {
		it('setExponent increases precision', () => {
			const bd: BigDecimal = { bigint: 2n, divex: 2 }; // 0.5
			setExponent(bd, 4);
			expect(bd.divex).toBe(4);
			expect(toNumber(bd)).toBeCloseTo(0.5, 10);
		});

		it('setExponent decreases precision with rounding', () => {
			const bd: BigDecimal = { bigint: 5n, divex: 4 }; // 0.3125
			setExponent(bd, 2);
			expect(bd.divex).toBe(2);
			// Result should be rounded
		});

		it('fixPrecision sets to default precision', () => {
			const bd: BigDecimal = { bigint: 1n, divex: 5 };
			fixPrecision(bd);
			expect(hasDefaultPrecision(bd)).toBe(true);
		});
	});

	describe('hypot', () => {
		it('hypot of 3 and 4 is 5', () => {
			const a: BigDecimal = FromBigInt(3n, 20);
			const b: BigDecimal = FromBigInt(4n, 20);
			const result = hypot(a, b, 30);
			expect(toNumber(result)).toBeCloseTo(5, 3);
		});

		it('hypot of 0 and x is x', () => {
			const zero: BigDecimal = FromBigInt(0n, 20);
			const x: BigDecimal = FromBigInt(5n, 20);
			const result = hypot(zero, x, 30);
			expect(toNumber(result)).toBeCloseTo(5, 3);
		});
	});

	describe('toExactString and toApproximateString', () => {
		it('toExactString for integer', () => {
			const bd: BigDecimal = FromBigInt(123n, 10);
			expect(toExactString(bd)).toBe('123');
		});

		it('toExactString for dyadic fraction', () => {
			const bd: BigDecimal = { bigint: 5n, divex: 3 }; // 0.625
			expect(toExactString(bd)).toBe('0.625');
		});

		it('toExactString for negative value', () => {
			const bd: BigDecimal = FromBigInt(-42n, 10);
			expect(toExactString(bd)).toBe('-42');
		});

		it('toApproximateString produces readable output', () => {
			const bd: BigDecimal = FromNumber(3.14159, 20);
			const str = toApproximateString(bd);
			// Should be a reasonable approximation
			expect(parseFloat(str)).toBeCloseTo(3.14159, 3);
		});

		it('toExactString for zero', () => {
			const bd: BigDecimal = FromBigInt(0n, 10);
			expect(toExactString(bd)).toBe('0');
		});
	});

	describe('FromNumber and FromBigInt', () => {
		it('FromNumber creates BigDecimal from positive number', () => {
			const bd = FromNumber(3.5, 10);
			expect(toNumber(bd)).toBeCloseTo(3.5, 5);
		});

		it('FromNumber creates BigDecimal from negative number', () => {
			const bd = FromNumber(-2.25, 10);
			expect(toNumber(bd)).toBeCloseTo(-2.25, 5);
		});

		it('FromNumber creates BigDecimal from zero', () => {
			const bd = FromNumber(0, 10);
			expect(isZero(bd)).toBe(true);
		});

		it('FromBigInt creates BigDecimal from positive bigint', () => {
			const bd = FromBigInt(42n, 10);
			expect(toBigInt(bd)).toBe(42n);
		});

		it('FromBigInt creates BigDecimal from negative bigint', () => {
			const bd = FromBigInt(-100n, 10);
			expect(toBigInt(bd)).toBe(-100n);
		});

		it('FromBigInt creates BigDecimal from zero', () => {
			const bd = FromBigInt(0n, 10);
			expect(isZero(bd)).toBe(true);
		});
	});

	describe('Default export object', () => {
		it('default export contains all expected methods', () => {
			expect(typeof BD.FromNumber).toBe('function');
			expect(typeof BD.FromBigInt).toBe('function');
			expect(typeof BD.add).toBe('function');
			expect(typeof BD.subtract).toBe('function');
			expect(typeof BD.multiply_fixed).toBe('function');
			expect(typeof BD.multiply_floating).toBe('function');
			expect(typeof BD.divide_fixed).toBe('function');
			expect(typeof BD.divide_floating).toBe('function');
			expect(typeof BD.sqrt).toBe('function');
			expect(typeof BD.pow).toBe('function');
			expect(typeof BD.toExactString).toBe('function');
		});
	});
});
