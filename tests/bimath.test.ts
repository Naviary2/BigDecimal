/**
 * bimath Unit Tests
 *
 * This file contains comprehensive unit tests for the bimath module
 * which provides low-level BigInt math helpers.
 *
 * Tests cover:
 * - bitLength_bisection: calculates bit length via optimized bisection algorithm
 * - toDebugBinaryString: debug-friendly binary string representation
 * - log2: integer log base 2
 * - ln: continuous natural logarithm
 * - abs: absolute value
 */

import { describe, it, expect } from 'vitest';
import bimath from '../src/bimath.ts';

// ============================================================================
// A. bitLength_bisection
// ============================================================================
describe('A. bitLength_bisection', () => {
	it('returns 0 for 0n', () => {
		expect(bimath.bitLength_bisection(0n)).toBe(0);
	});

	it('returns 1 for 1n', () => {
		expect(bimath.bitLength_bisection(1n)).toBe(1);
	});

	it('treats negative inputs as absolute value', () => {
		expect(bimath.bitLength_bisection(-1n)).toBe(1);
		expect(bimath.bitLength_bisection(-2n)).toBe(2);
		expect(bimath.bitLength_bisection(-8n)).toBe(4);
		expect(bimath.bitLength_bisection(-255n)).toBe(8);
	});

	it('returns correct bit length for small positive integers', () => {
		expect(bimath.bitLength_bisection(2n)).toBe(2); // binary: 10
		expect(bimath.bitLength_bisection(3n)).toBe(2); // binary: 11
		expect(bimath.bitLength_bisection(4n)).toBe(3); // binary: 100
		expect(bimath.bitLength_bisection(7n)).toBe(3); // binary: 111
		expect(bimath.bitLength_bisection(8n)).toBe(4); // binary: 1000
		expect(bimath.bitLength_bisection(255n)).toBe(8); // binary: 11111111
		expect(bimath.bitLength_bisection(256n)).toBe(9); // binary: 100000000
	});

	describe('powers of 2', () => {
		it('1n << 0n should be 1 bit', () => {
			expect(bimath.bitLength_bisection(1n << 0n)).toBe(1);
		});

		it('1n << 10n should be 11 bits', () => {
			expect(bimath.bitLength_bisection(1n << 10n)).toBe(11);
		});

		it('1n << 32n should be 33 bits', () => {
			expect(bimath.bitLength_bisection(1n << 32n)).toBe(33);
		});

		it('1n << 64n should be 65 bits', () => {
			expect(bimath.bitLength_bisection(1n << 64n)).toBe(65);
		});

		it('1n << 100n should be 101 bits', () => {
			expect(bimath.bitLength_bisection(1n << 100n)).toBe(101);
		});

		it('1n << 1000n should be 1001 bits', () => {
			expect(bimath.bitLength_bisection(1n << 1000n)).toBe(1001);
		});

		it('1n << 10000n should be 10001 bits', () => {
			expect(bimath.bitLength_bisection(1n << 10000n)).toBe(10001);
		});
	});

	describe('boundaries (power of 2 minus 1)', () => {
		it('(1n << 1n) - 1n = 1 should be 1 bit', () => {
			expect(bimath.bitLength_bisection((1n << 1n) - 1n)).toBe(1);
		});

		it('(1n << 10n) - 1n should be 10 bits', () => {
			expect(bimath.bitLength_bisection((1n << 10n) - 1n)).toBe(10);
		});

		it('(1n << 32n) - 1n should be 32 bits', () => {
			expect(bimath.bitLength_bisection((1n << 32n) - 1n)).toBe(32);
		});

		it('(1n << 64n) - 1n should be 64 bits', () => {
			expect(bimath.bitLength_bisection((1n << 64n) - 1n)).toBe(64);
		});

		it('(1n << 100n) - 1n should be 100 bits', () => {
			expect(bimath.bitLength_bisection((1n << 100n) - 1n)).toBe(100);
		});

		it('(1n << 1000n) - 1n should be 1000 bits', () => {
			expect(bimath.bitLength_bisection((1n << 1000n) - 1n)).toBe(1000);
		});
	});

	describe('correctness against naive implementation', () => {
		// Naive implementation: convert to binary string and get its length
		const naiveBitLength = (n: bigint): number => {
			if (n === 0n) return 0;
			if (n < 0n) n = -n;
			return n.toString(2).length;
		};

		it('matches naive implementation for small values (0-1000)', () => {
			for (let i = 0n; i <= 1000n; i++) {
				expect(bimath.bitLength_bisection(i)).toBe(naiveBitLength(i));
			}
		});

		it('matches naive implementation for various large values', () => {
			const testCases = [
				10000n,
				123456789n,
				9999999999n,
				1n << 50n,
				(1n << 50n) + 12345n,
				1n << 128n,
				(1n << 128n) - 1n,
				1n << 256n,
				(1n << 256n) - 1n,
			];
			for (const value of testCases) {
				expect(bimath.bitLength_bisection(value)).toBe(naiveBitLength(value));
			}
		});

		it('matches naive implementation for negative values', () => {
			const testCases = [-1n, -100n, -12345n, -999999n, -(1n << 100n)];
			for (const value of testCases) {
				expect(bimath.bitLength_bisection(value)).toBe(naiveBitLength(value));
			}
		});
	});
});

// ============================================================================
// B. toDebugBinaryString
// ============================================================================
describe('B. toDebugBinaryString', () => {
	it('returns correct format for 0n', () => {
		const result = bimath.toDebugBinaryString(0n);
		expect(result).toBe(
			'0b_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000 (1-chunk, 8 bytes, 64 bits)'
		);
	});

	describe('positive integers', () => {
		it('formats 1n correctly', () => {
			const result = bimath.toDebugBinaryString(1n);
			// 1n requires 1 bit, plus sign bit = 2 bits
			// Rounds up to 64 bits (1 chunk)
			expect(result).toContain('0b');
			expect(result).toContain('(1-chunk, 8 bytes, 64 bits)');
			// Check underscores are present for readability
			expect(result).toContain('_');
			// The last 4 bits should be "0001"
			expect(result).toMatch(/_0001 \(/);
		});

		it('formats small positive integer (42n = 0b101010) correctly', () => {
			const result = bimath.toDebugBinaryString(42n);
			expect(result).toContain('0b');
			expect(result).toContain('(1-chunk, 8 bytes, 64 bits)');
			// 42 in binary is 101010, last 8 bits should be 00101010
			expect(result).toContain('0010_1010');
		});

		it('formats larger positive integer correctly', () => {
			// 255n = 0b11111111
			const result = bimath.toDebugBinaryString(255n);
			expect(result).toContain('0b');
			expect(result).toContain('(1-chunk, 8 bytes, 64 bits)');
			expect(result).toContain('1111_1111');
		});

		it('has underscore separators every 4 bits', () => {
			const result = bimath.toDebugBinaryString(1n);
			// Count underscores - should be 15 separators for 64 bits (64/4 = 16 groups, 15 separators between them)
			const underscoreCount = (result.match(/_/g) || []).length;
			// Format is: 0b0000_0000_0000_... (15 underscores between 16 nibbles)
			expect(underscoreCount).toBe(15);
		});
	});

	describe("negative integers (two's complement)", () => {
		it("formats -1n correctly (all ones in two's complement)", () => {
			const result = bimath.toDebugBinaryString(-1n);
			expect(result).toContain('0b');
			// -1 in two's complement is all 1s
			expect(result).toContain('1111_1111_1111_1111');
			expect(result).toContain('(1-chunk, 8 bytes, 64 bits)');
		});

		it('formats -8n correctly', () => {
			// -8 in two's complement for 64 bits
			const result = bimath.toDebugBinaryString(-8n);
			expect(result).toContain('0b');
			expect(result).toContain('(1-chunk, 8 bytes, 64 bits)');
			// Last nibble should be 1000
			expect(result).toContain('_1000 ');
		});

		it('formats -128n correctly', () => {
			// -128 in two's complement
			const result = bimath.toDebugBinaryString(-128n);
			expect(result).toContain('0b');
			expect(result).toContain('(1-chunk, 8 bytes, 64 bits)');
			// Last 8 bits should be 10000000
			expect(result).toContain('1000_0000 ');
		});
	});

	describe('output string structure', () => {
		it('starts with 0b prefix', () => {
			expect(bimath.toDebugBinaryString(1n)).toMatch(/^0b/);
			expect(bimath.toDebugBinaryString(0n)).toMatch(/^0b/);
			expect(bimath.toDebugBinaryString(-1n)).toMatch(/^0b/);
		});

		it('contains underscore separators', () => {
			const result = bimath.toDebugBinaryString(12345n);
			expect(result).toContain('_');
		});

		it('ends with chunk/byte/bit annotation in parentheses', () => {
			const result = bimath.toDebugBinaryString(1n);
			expect(result).toMatch(/\(\d+-chunk, \d+ bytes, \d+ bits\)$/);
		});

		it('handles multi-chunk values', () => {
			// A value that requires more than 64 bits
			const bigValue = 1n << 100n;
			const result = bimath.toDebugBinaryString(bigValue);
			expect(result).toContain('0b');
			// 101 bits + 1 sign bit = 102 bits, needs 2 chunks (128 bits)
			expect(result).toContain('(2-chunk, 16 bytes, 128 bits)');
		});

		it('handles very large values', () => {
			// A value requiring 3 chunks (> 128 bits)
			const bigValue = 1n << 150n;
			const result = bimath.toDebugBinaryString(bigValue);
			expect(result).toContain('0b');
			// 151 bits + 1 sign bit = 152 bits, needs 3 chunks (192 bits)
			expect(result).toContain('(3-chunk, 24 bytes, 192 bits)');
		});
	});
});

// ============================================================================
// C. log2
// ============================================================================
describe('C. log2', () => {
	describe('exact powers of 2', () => {
		it('log2(1n) = 0', () => {
			expect(bimath.log2(1n)).toBe(0);
		});

		it('log2(2n) = 1', () => {
			expect(bimath.log2(2n)).toBe(1);
		});

		it('log2(4n) = 2', () => {
			expect(bimath.log2(4n)).toBe(2);
		});

		it('log2(8n) = 3', () => {
			expect(bimath.log2(8n)).toBe(3);
		});

		it('log2(16n) = 4', () => {
			expect(bimath.log2(16n)).toBe(4);
		});

		it('log2(1024n) = 10', () => {
			expect(bimath.log2(1024n)).toBe(10);
		});

		it('log2(1n << 50n) = 50', () => {
			expect(bimath.log2(1n << 50n)).toBe(50);
		});

		it('log2(1n << 100n) = 100', () => {
			expect(bimath.log2(1n << 100n)).toBe(100);
		});

		it('log2(1n << 1000n) = 1000', () => {
			expect(bimath.log2(1n << 1000n)).toBe(1000);
		});
	});

	describe('non-powers of 2 (integer part)', () => {
		it('log2(3n) = 1 (floor of 1.58...)', () => {
			expect(bimath.log2(3n)).toBe(1);
		});

		it('log2(5n) = 2 (floor of 2.32...)', () => {
			expect(bimath.log2(5n)).toBe(2);
		});

		it('log2(7n) = 2 (floor of 2.807...)', () => {
			expect(bimath.log2(7n)).toBe(2);
		});

		it('log2(10n) = 3 (floor of 3.32...)', () => {
			expect(bimath.log2(10n)).toBe(3);
		});

		it('log2(100n) = 6 (floor of 6.64...)', () => {
			expect(bimath.log2(100n)).toBe(6);
		});

		it('log2(1000n) = 9 (floor of 9.96...)', () => {
			expect(bimath.log2(1000n)).toBe(9);
		});

		it('log2((1n << 100n) - 1n) = 99', () => {
			// Just below 2^100, so floor(log2) is 99
			expect(bimath.log2((1n << 100n) - 1n)).toBe(99);
		});
	});

	describe('edge cases', () => {
		it('log2(0n) = -Infinity', () => {
			expect(bimath.log2(0n)).toBe(-Infinity);
		});

		it('log2(-1n) = NaN', () => {
			expect(bimath.log2(-1n)).toBeNaN();
		});

		it('log2(-100n) = NaN', () => {
			expect(bimath.log2(-100n)).toBeNaN();
		});

		it('log2(-(1n << 100n)) = NaN', () => {
			expect(bimath.log2(-(1n << 100n))).toBeNaN();
		});
	});
});

// ============================================================================
// D. ln (natural logarithm)
// ============================================================================
describe('D. ln (natural logarithm)', () => {
	describe('edge cases', () => {
		it('ln(0n) = -Infinity', () => {
			expect(bimath.ln(0n)).toBe(-Infinity);
		});

		it('ln(-1n) = NaN', () => {
			expect(bimath.ln(-1n)).toBeNaN();
		});

		it('ln(-100n) = NaN', () => {
			expect(bimath.ln(-100n)).toBeNaN();
		});
	});

	describe('values < 2^1024 (standard Math.log path)', () => {
		it('ln(1n) = 0', () => {
			expect(bimath.ln(1n)).toBe(0);
		});

		it('ln(2n) is close to Math.LN2', () => {
			expect(bimath.ln(2n)).toBeCloseTo(Math.LN2, 10);
		});

		it('ln(10n) is close to Math.log(10)', () => {
			expect(bimath.ln(10n)).toBeCloseTo(Math.log(10), 10);
		});

		it('ln(100n) is close to Math.log(100)', () => {
			expect(bimath.ln(100n)).toBeCloseTo(Math.log(100), 10);
		});

		it('ln(1000000n) is close to Math.log(1000000)', () => {
			expect(bimath.ln(1000000n)).toBeCloseTo(Math.log(1000000), 10);
		});

		// Test a value just below 2^1024 threshold (bit length < 1024)
		it('ln(1n << 500n) is approximately close to expected value', () => {
			const value = 1n << 500n;
			// ln(2^500) = 500 * ln(2)
			const expected = 500 * Math.LN2;
			expect(bimath.ln(value)).toBeCloseTo(expected, 5);
		});

		it('ln(1n << 1000n) is approximately close to expected value', () => {
			const value = 1n << 1000n;
			// ln(2^1000) = 1000 * ln(2)
			const expected = 1000 * Math.LN2;
			expect(bimath.ln(value)).toBeCloseTo(expected, 5);
		});
	});

	describe('values >= 2^1024 (manual bit manipulation path)', () => {
		it('ln(1n << 1024n) is approximately close to expected value', () => {
			const value = 1n << 1024n;
			// ln(2^1024) = 1024 * ln(2)
			const expected = 1024 * Math.LN2;
			const result = bimath.ln(value);
			expect(result).toBeCloseTo(expected, 5);
		});

		it('ln(1n << 2000n) is approximately close to expected value', () => {
			const value = 1n << 2000n;
			// ln(2^2000) = 2000 * ln(2)
			const expected = 2000 * Math.LN2;
			const result = bimath.ln(value);
			expect(result).toBeCloseTo(expected, 5);
		});

		it('ln(1n << 10000n) is approximately close to expected value', () => {
			const value = 1n << 10000n;
			// ln(2^10000) = 10000 * ln(2)
			const expected = 10000 * Math.LN2;
			const result = bimath.ln(value);
			expect(result).toBeCloseTo(expected, 3);
		});

		it('ln of large non-power-of-2 value is reasonably accurate', () => {
			// Test a value that is 3 * 2^1024 to verify mantissa extraction
			const value = 3n << 1024n;
			// ln(3 * 2^1024) = ln(3) + 1024 * ln(2)
			const expected = Math.log(3) + 1024 * Math.LN2;
			const result = bimath.ln(value);
			expect(result).toBeCloseTo(expected, 3);
		});

		it('ln of very large non-power-of-2 value is reasonably accurate', () => {
			// Test a value that is (2^53 - 1) * 2^2000 (max mantissa precision)
			const mantissa = (1n << 53n) - 1n;
			const value = mantissa << 2000n;
			// ln((2^53-1) * 2^2000) ≈ ln(2^53) + 2000 * ln(2) = 53*ln(2) + 2000*ln(2)
			const expected = Math.log(Number(mantissa)) + 2000 * Math.LN2;
			const result = bimath.ln(value);
			expect(result).toBeCloseTo(expected, 3);
		});
	});
});

// ============================================================================
// E. abs (absolute value)
// ============================================================================
describe('E. abs', () => {
	it('abs(0n) = 0n', () => {
		expect(bimath.abs(0n)).toBe(0n);
	});

	describe('positive numbers', () => {
		it('abs(1n) = 1n', () => {
			expect(bimath.abs(1n)).toBe(1n);
		});

		it('abs(42n) = 42n', () => {
			expect(bimath.abs(42n)).toBe(42n);
		});

		it('abs(1000000n) = 1000000n', () => {
			expect(bimath.abs(1000000n)).toBe(1000000n);
		});

		it('abs(1n << 100n) = 1n << 100n', () => {
			const value = 1n << 100n;
			expect(bimath.abs(value)).toBe(value);
		});
	});

	describe('negative numbers', () => {
		it('abs(-1n) = 1n', () => {
			expect(bimath.abs(-1n)).toBe(1n);
		});

		it('abs(-42n) = 42n', () => {
			expect(bimath.abs(-42n)).toBe(42n);
		});

		it('abs(-1000000n) = 1000000n', () => {
			expect(bimath.abs(-1000000n)).toBe(1000000n);
		});

		it('abs(-(1n << 100n)) = 1n << 100n', () => {
			const value = 1n << 100n;
			expect(bimath.abs(-value)).toBe(value);
		});
	});
});
