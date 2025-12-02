// src/client/scripts/esm/util/bigdecimal/bimath.ts

/**
 * This module contains complex math functions
 * for working with bigints.
 */

// Constants =========================================================

const NEGONE: bigint = -1n;
const ZERO: bigint = 0n;
const ONE: bigint = 1n;

// Mathematical Operations ===========================================

/**
 * Calculates the absolute value of a bigint
 * @param bigint - The BigInt
 * @returns The absolute value
 */
function abs(bigint: bigint): bigint {
	return bigint < ZERO ? -bigint : bigint;
}

/** [INTEGER] Calculates the integer logarithm base 2 of a BigInt. */
function log2(bigint: bigint): number {
	if (bigint === ZERO) return -Infinity; // Matches Math.log2(0)
	if (bigint < ZERO) return NaN;

	// The log base 2 is just the bit length - 1.
	// return bigint.toString(2).length - 1;
	// Our fastest bitLength algorithm.
	return bitLength_bisection(bigint) - 1;
}

/** [CONTINUOUS] Calculates the natural logarithm (base e) of a BigInt. */
function ln(bigint: bigint): number {
	if (bigint < ZERO) return NaN;
	if (bigint === ZERO) return -Infinity;

	const bitLen = bitLength_bisection(bigint);

	// The maximum exponent for a standard IEEE 754 double is 1023.
	// Therefore, any BigInt with a bit length of 1024 or more will overflow to Infinity.
	// For anything smaller, direct conversion is the fastest and simplest path.
	if (bitLen < 1024) return Math.log(Number(bigint));

	// Manual method based on base-2 logarithms.
	// N = m * 2^e  =>  ln(N) = ln(m) + e*ln(2)

	// 1. The base-2 exponent 'e' is the bit length minus one.
	const exponent = bitLen - 1;

	// 2. To get the mantissa 'm', we extract the 53 most significant bits.
	const precisionBits = 53; // JS number (double) has 53 bits of mantissa precision.
	const shift = BigInt(bitLen - precisionBits);
	const mantissaInt = Number(bigint >> shift);

	// 3. Normalize the integer mantissa to the range [1.0, 2.0).
	const mantissa = mantissaInt / 2 ** (precisionBits - 1);

	// 4. Apply the logarithm formula.
	return Math.log(mantissa) + exponent * Math.LN2;
}

/**
 * Returns a bigint's binary representation in an easy-to-read string format,
 * displaying all bits in the underlying 64‑bit chunks.
 * Example output: "0b_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000 (1-chunk, 8 bytes, 64 bits)"
 */
function toDebugBinaryString(bigint: bigint): string {
	// 1. Handle the zero case cleanly.
	if (bigint === ZERO)
		return '0b_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000 (1-chunk, 8 bytes, 64 bits)';

	// 2. Calculate the minimum number of bits required for two's complement.
	let minBits: number;
	if (bigint > ZERO) {
		minBits = bitLength_bisection(bigint);
	} else {
		// bigint < ZERO
		// For a negative number -N, the bits required are one more than the bits
		// for N-1. e.g. -8 (1000) needs 4 bits, same as 7 (0111).
		// A simple, reliable way is to find the bit length of its positive counterpart and add 1 for the sign.
		// For -8, this becomes (-(-8n)) - 1n = 7n. The bit length of 7 (111) is 3. Add 1 for the sign bit = 4.
		// For -10, this is 9n. Bit length of 9 (1001) is 4. Add 1 for sign bit = 5.
		minBits = (bigint * NEGONE - ONE).toString(2).length + 1;
	}

	// Each chunk is 64 bits (8 bytes) on a 64-bit engine.
	const CHUNK_BITS = 64;
	const CHUNK_BYTES = CHUNK_BITS / 8;

	// 3. Determine how many 64-bit chunks we need, then total display bits
	const effectiveBits =
		bigint >= 0n
			? minBits + 1 // reserve sign-bit = 0
			: minBits; // negatives still need exactly minBits
	const chunkCount = Math.ceil(effectiveBits / CHUNK_BITS);
	const displayBits = chunkCount * CHUNK_BITS;

	// 4. Calculate the two's complement value for this specific display width.
	const displayMask = (ONE << BigInt(displayBits)) - ONE;
	const displayValue = bigint & displayMask;

	// 5. Convert to a binary string and pad with leading zeros.
	const binaryString = displayValue.toString(2).padStart(displayBits, '0');

	// 6. Add separators for readability (e.g., "1111_0110").
	let formattedString = '0b';
	for (let i = 0; i < binaryString.length; i++) {
		if (i > 0 && i % 4 === 0) formattedString += '_';
		formattedString += binaryString[i];
	}

	// 7. Add a helpful annotation with chunk count, bytes, and bits.
	const annotation = `(${chunkCount}-chunk, ${
		chunkCount * CHUNK_BYTES
	} bytes, ${displayBits} bits)`;

	return `${formattedString} ${annotation}`;
}

// Global state for the bisection algorithm so it's not re-computed every call
const testersCoeff: number[] = [];
const testersBigCoeff: bigint[] = [];
const testers: bigint[] = [];
let testersN = 0;

/**
 * Calculates the bit length of a bigint using a highly optimized dynamic bisection algorithm.
 * Complexity O(log n), where n is the number of bits.
 * Algorithm pulled from https://stackoverflow.com/a/76616288
 */
function bitLength_bisection(x: bigint): number {
	if (x === ZERO) return 0;
	if (x < ZERO) x = -x;

	let k = 0;
	while (true) {
		if (testersN === k) {
			testersCoeff.push(32 << testersN);
			testersBigCoeff.push(BigInt(testersCoeff[testersN]!));
			testers.push(1n << testersBigCoeff[testersN]!);
			testersN++;
		}
		if (x < testers[k]!) break;
		k++;
	}

	if (!k) return 32 - Math.clz32(Number(x));

	// Determine length by bisection
	k--;
	let i = testersCoeff[k]!;
	let a = x >> testersBigCoeff[k]!;
	while (k--) {
		const b = a >> testersBigCoeff[k]!;
		if (b) {
			i += testersCoeff[k]!;
			a = b;
		}
	}

	return i + 32 - Math.clz32(Number(a));
}

// Exports ============================================================

export default {
	abs,
	log2,
	ln,
	toDebugBinaryString,
	bitLength_bisection,
};
