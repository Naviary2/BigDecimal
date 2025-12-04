// src/bigdecimal.ts

import bimath from './bimath.js';

// Types ========================================================

/**
 * The main Big Decimal type. Capable of storing arbitrarily large numbers,
 * with arbitrary levels of decimal precision!
 */
interface BigDecimal {
	/**
	 * The bigint storing the bits of the BigDecimal, or the mantissa. Multiply this
	 * by 2^(-divex) to get the true number being stored by the Big Decimal!
	 */
	bigint: bigint;
	/**
	 * The inverse (or negative) exponent. Directly represents how many bits of the
	 * bigint are utilized to store the decimal portion of the Big Decimal,
	 * or tells you what position the decimal point is at from the right.
	 * A negative divex represents a positive exponent (a large number).
	 */
	divex: number;
}

// Config ===========================================================

/**
 * The default number of bits dedicated to the decimal portion of the BigDecimal.
 *
 * Without working precision, small numbers parsed into BigDecimals would lose some precision.
 * For example, 3.1 divex 4 ==> 3.125. Now even though 3.125 DOES round to 3.1,
 * it means we'll very quickly lose a lot of accuracy when performing arithmetic!
 * The user expects that, when they pass in 3.1, the resulting BigDecimal should be AS CLOSE to 3.1 as possible!!
 * With a DEFAULT_WORKING_PRECISION of 50 bits, 3.1 divex 50 ==> 3.10000000000000142, which is A LOT closer to 3.1!
 *
 * 23 bits approximately matches float32 precision, giving us about 7 decimal places.
 * 53 bits approximately matches float64 precision, giving us about 16 decimal places.
 */
let DEFAULT_WORKING_PRECISION = 23;

/** The target number of bits for the mantissa in floating-point operations. Higher is more precise but slower. */
const DEFAULT_MANTISSA_PRECISION_BITS = DEFAULT_WORKING_PRECISION; // Gives us about 7, or 16 digits of precision, depending whether we have 32 bit or 64 bit precision (javascript doubles are 64 bit).

/** A list of powers of 2, 1024 in length, starting at 1 and stopping before Number.MAX_VALUE. This goes up to 2^1023. */
const powersOfTwoList: number[] = (() => {
	const powersOfTwo: number[] = [];
	let currentPower = 1;
	while (currentPower < Number.MAX_VALUE) {
		powersOfTwo.push(currentPower);
		currentPower *= 2;
	}
	return powersOfTwo;
})();

/**
 * Any divex greater than 1023 can lead to Number casts (of the decimal portion)
 * greater than Number.MAX_VALUE or equal to Infinity, because 1 * 2^1024 === Infinity,
 * but 1 * 2^1023 does NOT. And 1.0 encompasses all possible fractional values!
 * BigDecimals with divexs THAT big need special care!
 */
const MAX_DIVEX_BEFORE_INFINITY: number = powersOfTwoList.length - 1; // 1023

// Constants ========================================================

const LOG10_OF_2: number = Math.log10(2); // ≈ 0.30103

const ZERO: bigint = 0n;
const ONE: bigint = 1n;
const FIVE: bigint = 5n;
const TEN: bigint = 10n;

// Config ===================================================================

/**
 * Sets the default number of bits of precision to use in all BigDecimal calculations where a specific precision is not requested. DEFAULT: 23 bits (~7 decimal digits).
 * @param precision - The number of bits of precision dedicated to the decimal portion.
 */
function SetGlobalPrecision(precision: number): void {
	if (precision < 0)
		throw new Error(`Precision must be greater than zero. Received: ${precision}`);

	DEFAULT_WORKING_PRECISION = precision;
}

// Constructors =============================================================

/**
 * Creates a Big Decimal from a javascript number (double) by directly
 * interpreting its IEEE 754 binary representation extremely fast.
 * The result will have a fixed divex (scale) as specified.
 * WARNING: If the input number is too small for the target precision,
 * the resulting BigDecimal will underflow to 0.
 * @param num - The number to convert.
 * @param [precision=DEFAULT_WORKING_PRECISION] The target divex for the result.
 * @returns A new BigDecimal with the value from the number.
 */
export function FromNumber(num: number, precision: number = DEFAULT_WORKING_PRECISION): BigDecimal {
	if (precision < 0)
		throw new Error(`Precision must be greater than zero. Received: ${precision}`);
	if (!isFinite(num))
		throw new Error(`Cannot create a BigDecimal from a non-finite number. Received: ${num}`);

	// Handle the zero case.
	if (num === 0) return { bigint: ZERO, divex: precision };

	// Get the raw, unadjusted BigDecimal representation.
	// We know rawBD is not null here because we've handled the zero case.
	const rawBD = _fromNumberBits(num)!;

	// Adjust to the target precision.
	setExponent(rawBD, precision);

	return rawBD;
}

/**
 * Internal helper to parse the raw IEEE 754 bits of a JavaScript number
 * into the core components of a BigDecimal (bigint and divex) without
 * any final precision adjustments.
 * @param num The number to parse.
 * @returns An object containing the raw, un-normalized BigDecimal
 *          representation of the number. Returns null if the number is zero.
 */
function _fromNumberBits(num: number): BigDecimal | null {
	// 1. Handle the zero case. The callers will handle this special value.
	if (num === 0) return null;

	// 2. Extract the raw 64 bits of the float into a BigInt.
	// This is a standard and fast technique to get the binary components.
	const buffer = new ArrayBuffer(8);
	const floatView = new Float64Array(buffer);
	const intView = new BigInt64Array(buffer);
	floatView[0] = num;
	const bits = intView[0]!;

	// 3. Parse the sign, exponent, and mantissa from the bits.
	const sign = bits < ZERO ? -ONE : ONE;
	const exponent = Number((bits >> 52n) & 0x7ffn);
	const mantissa = bits & 0xfffffffffffffn;

	if (exponent === 0) {
		// Subnormal number. The implicit leading bit is 0.
		// The effective exponent is -1022, and we scale by the mantissa bits (52).
		return {
			bigint: sign * mantissa,
			divex: 1022 + 52, // 1074
		};
	} else {
		// Normal number. The implicit leading bit is 1.
		// Add the implicit leading bit to the mantissa to get the full significand.
		const significand = (ONE << 52n) | mantissa;
		return {
			bigint: sign * significand,
			// The exponent is biased by 1023. We also account for the 52 fractional
			// bits in the significand to get the final scaling factor.
			divex: 1023 - exponent + 52,
		};
	}
}

/**
 * Creates a Big Decimal from a bigint and a desired precision level.
 * @param num
 * @param [precision=DEFAULT_WORKING_PRECISION] The amount of extra precision to add.
 * @returns A new BigDecimal with the value from the bigint.
 */
export function FromBigInt(num: bigint, precision: number = DEFAULT_WORKING_PRECISION): BigDecimal {
	if (precision < 0)
		throw new Error(`Precision must be greater than zero. Received: ${precision}`);
	return {
		bigint: num << BigInt(precision),
		divex: precision,
	};
}

// Arithmetic ==================================================================

/**
 * Adds two BigDecimal numbers.
 * The resulting BigDecimal will have a divex equal to the first argument.
 * If the second argument has a higher divex, it will be rounded before addition.
 * @param bd1 - The first addend, which also determines the result's precision.
 * @param bd2 - The second addend.
 * @returns The sum of bd1 and bd2.
 */
export function add(bd1: BigDecimal, bd2: BigDecimal): BigDecimal {
	// To add, both BigDecimals must have the same divex (common denominator).
	// We'll scale the one with the lower divex up to match the higher one.

	if (bd1.divex === bd2.divex) {
		// Exponents are the same, a simple bigint addition is sufficient.
		return {
			bigint: bd1.bigint + bd2.bigint,
			divex: bd1.divex,
		};
	} else if (bd1.divex > bd2.divex) {
		// Scale up bd2 to match bd1's divex
		const bd2DivexAdjusted = bd2.bigint << BigInt(bd1.divex - bd2.divex);
		return {
			bigint: bd1.bigint + bd2DivexAdjusted,
			divex: bd1.divex,
		};
	} else {
		// divex2 > divex1
		// bd2 has more precision. We must scale it DOWN to match bd1, which requires rounding.
		const difference = BigInt(bd2.divex - bd1.divex);

		// To "round half up", we add 0.5 before truncating (right-shifting).
		// "0.5" at the correct scale is 1 bit shifted by (difference - 1).
		const half = ONE << (difference - ONE);

		// Round bd2's bigint to the precision of bd1
		const roundedBd2BigInt = (bd2.bigint + half) >> difference;

		return {
			bigint: bd1.bigint + roundedBd2BigInt,
			divex: bd1.divex,
		};
	}
}

/**
 * Subtracts the second BigDecimal from the first.
 * The resulting BigDecimal will have a divex equal to the first argument (the minuend).
 * If the second argument has a higher divex, it will be rounded before subtraction.
 * @param bd1 - The minuend, which also determines the result's precision.
 * @param bd2 - The subtrahend.
 * @returns The difference of bd1 and bd2 (bd1 - bd2).
 */
export function subtract(bd1: BigDecimal, bd2: BigDecimal): BigDecimal {
	// To subtract, both BigDecimals must have the same divex (common denominator).
	// We scale the one with the lower divex up to match the higher one.

	if (bd1.divex === bd2.divex) {
		// Exponents are the same, a simple bigint subtraction is sufficient.
		return {
			bigint: bd1.bigint - bd2.bigint,
			divex: bd1.divex,
		};
	} else if (bd1.divex > bd2.divex) {
		// Scale up bd2's bigint to match bd1's divex
		const bd2BigIntAdjusted = bd2.bigint << BigInt(bd1.divex - bd2.divex);
		return {
			bigint: bd1.bigint - bd2BigIntAdjusted,
			divex: bd1.divex,
		};
	} else {
		// bd2.divex > bd1.divex
		// bd2 has more precision. We must scale it DOWN to match bd1, which requires rounding.
		const difference = BigInt(bd2.divex - bd1.divex);

		// Use the same "round half up towards positive infinity" logic as in add().
		const half = ONE << (difference - 1n);

		// Round bd2's bigint to the precision of bd1.
		const roundedBd2BigInt = (bd2.bigint + half) >> difference;

		return {
			bigint: bd1.bigint - roundedBd2BigInt,
			divex: bd1.divex,
		};
	}
}

/**
 * [Fixed-Point Model] Multiplies two BigDecimal numbers.
 * The resulting BigDecimal will have a divex equal to the first factor.
 * This provides a balance of precision and predictable behavior.
 * @param bd1 The first factor.
 * @param bd2 The second factor.
 * @returns The product of bd1 and bd2, with the same precision as the first factor.
 */
export function multiply_fixed(bd1: BigDecimal, bd2: BigDecimal): BigDecimal {
	// The true divex of the raw product is (bd1.divex + bd2.divex).
	// We must shift the raw product to scale it to the targetDivex (bd1.divex).
	// The total shift is therefore equal to bd2.divex.
	const shiftAmount = BigInt(bd2.divex);

	// First, get the raw product of the internal bigints.
	const rawProduct = bd1.bigint * bd2.bigint;
	let product: bigint;

	if (shiftAmount > ZERO) {
		// Case 1: shiftAmount is positive.
		// We are decreasing precision (e.g., multiplying by 0.5), so we must right-shift and round.
		const half = ONE << (shiftAmount - ONE);
		product = (rawProduct + half) >> shiftAmount;
	} else if (shiftAmount < ZERO) {
		// Case 2: shiftAmount is negative.
		// We are increasing precision (e.g., multiplying by a large number), so we must left-shift.
		// The shift amount must be positive, so we use -shiftAmount.
		// No rounding is needed as we are not losing bits.
		product = rawProduct << -shiftAmount;
	} else {
		// Case 3: shiftAmount is zero.
		// No scaling is needed.
		product = rawProduct;
	}

	return {
		bigint: product,
		divex: bd1.divex,
	};
}

/**
 * [Floating-Point Model] Multiplies two BigDecimals, preserving significant digits.
 * The divex may grow, but it shouldn't grow uncontrollably.
 * @param bd1 The first factor.
 * @param bd2 The second factor.
 * @param mantissaBits - How many bits of mantissa to use for the result, while still guaranteeing arbitrary integer precision. This only affects really small decimals. If not provided, the default will be used.
 * @returns The product of bd1 and bd2.
 */
export function multiply_floating(
	bd1: BigDecimal,
	bd2: BigDecimal,
	mantissaBits?: number,
): BigDecimal {
	// 1. Calculate the raw product of the internal bigints.
	const newBigInt = bd1.bigint * bd2.bigint;

	// 2. The new scale is the sum of the original scales.
	const newDivex = bd1.divex + bd2.divex;

	// 3. Immediately hand off to normalize to enforce the floating-point model.
	return normalize({ bigint: newBigInt, divex: newDivex }, mantissaBits);
}

/**
 * [Fixed-Point Model] Divides the first BigDecimal by the second, producing a result with a predictable divex.
 * The result divex will be equal to the dividend's divex.
 * This prevents the divex from growing uncontrollably with repeated divisions.
 * @param bd1 - The dividend.
 * @param bd2 - The divisor.
 * @param [workingPrecision=DEFAULT_WORKING_PRECISION] - Extra bits for internal calculation to prevent rounding errors.
 * @returns The quotient of bd1 and bd2 (bd1 / bd2), with the same precision as the dividend.
 */
export function divide_fixed(
	bd1: BigDecimal,
	bd2: BigDecimal,
	workingPrecision: number = DEFAULT_WORKING_PRECISION,
): BigDecimal {
	if (bd2.bigint === ZERO) throw new Error('Division by zero is not allowed.');

	// 1. Calculate the total shift needed for the dividend. This includes:
	//    - The extra "workingPrecision" to ensure accuracy during division.
	const shift = BigInt(bd2.divex + workingPrecision);

	// 2. Scale the dividend up.
	const scaledDividend = bd1.bigint << shift;

	// 3. Perform the integer division. The result has `workingPrecision` extra bits.
	const quotient = scaledDividend / bd2.bigint;

	// 4. Round the result by shifting it back down by `workingPrecision`.
	//    We add "0.5" before truncating to round half towards positive infinity.
	const workingPrecisionBigInt = BigInt(workingPrecision);
	if (workingPrecisionBigInt <= ZERO)
		return {
			bigint: quotient,
			divex: bd1.divex,
		};
	const half = ONE << (workingPrecisionBigInt - ONE);
	const finalQuotient = (quotient + half) >> workingPrecisionBigInt;

	return {
		bigint: finalQuotient,
		divex: bd1.divex,
	};
}

/**
 * [Floating-Point Model] Divides two BigDecimals, preserving significant digits.
 * This method dynamically calculates the required internal precision to ensure the result
 * never truncates to zero unless the dividend is zero.
 * @param bd1 - The dividend.
 * @param bd2 - The divisor.
 * @param [mantissaBits=DEFAULT_MANTISSA_PRECISION_BITS] - How many bits of mantissa to preserve in the result.
 * @returns The quotient of bd1 and bd2 (bd1 / bd2).
 */
export function divide_floating(
	bd1: BigDecimal,
	bd2: BigDecimal,
	mantissaBits: number = DEFAULT_MANTISSA_PRECISION_BITS,
): BigDecimal {
	if (bd2.bigint === ZERO) throw new Error('Division by zero is not allowed.');
	if (bd1.bigint === ZERO) return { bigint: ZERO, divex: mantissaBits }; // Or any divex, normalize will handle it.

	// 1. Calculate bit length of the absolute values for a magnitude comparison.
	const len1 = bimath.bitLength_bisection(bimath.abs(bd1.bigint));
	const len2 = bimath.bitLength_bisection(bimath.abs(bd2.bigint));

	// 2. Determine the necessary left shift.
	// We need to shift bd1.bigint left enough so that the resulting quotient has 'mantissaBits' of precision.
	const bitDifference = len2 - len1;

	// We need to shift by the difference in bit lengths (if bd2 is larger) PLUS the desired final mantissa bits.
	// We add 1 for extra safety against off-by-one truncation errors in the integer division.
	const requiredShift = BigInt(Math.max(bitDifference, 0) + mantissaBits + 1);

	// 3. Scale the dividend up by the required shift amount.
	const scaledDividend = bd1.bigint << requiredShift;

	// 4. Perform the single, precise integer division.
	const quotient = scaledDividend / bd2.bigint;

	// 5. Calculate the new divex for the result.
	// The total scaling factor is 2^requiredShift from our scaling,
	// and we must also account for the original exponents.
	const newDivex = bd1.divex - bd2.divex + Number(requiredShift);

	// 6. Normalize the result to the target mantissa size. This will trim any excess bits
	// if the dividend was much larger than the divisor.
	return normalize({ bigint: quotient, divex: newDivex }, mantissaBits);
}

/**
 * Calculates the modulo between two BigDecimals.
 * @param bd1 The dividend.
 * a@param bd2 The divisor.
 * @returns The remainder as a new BigDecimal, with the same precision as the dividend.
 */
export function mod(bd1: BigDecimal, bd2: BigDecimal): BigDecimal {
	if (bd2.bigint === ZERO)
		throw new Error('Cannot perform modulo operation with a zero divisor.');

	const bigint1 = bd1.bigint;
	let bigint2 = bd2.bigint;

	// The result's scale is determined by the dividend.
	const targetDivex = bd1.divex;

	// We must bring bd2 to the same scale as bd1.
	const divexDifference = targetDivex - bd2.divex;

	if (divexDifference > 0) {
		// bd2 has less precision, scale it up (left shift).
		bigint2 <<= BigInt(divexDifference);
	} else if (divexDifference < 0) {
		// bd2 has more precision, scale it down (right shift).
		// This involves truncation, which is standard for modulo operations.
		bigint2 >>= BigInt(-divexDifference);
	}

	// Now that both bigints are at the same scale as the dividend,
	// we can use the native remainder operator.
	const remainderBigInt = bigint1 % bigint2;

	return {
		bigint: remainderBigInt,
		divex: targetDivex, // The result's divex matches the dividend's.
	};
}

/**
 * Calculates the integer power of a BigDecimal (base^exp).
 * This uses the "exponentiation by squaring" algorithm for efficiency.
 */
export function powerInt(base: BigDecimal, exp: number): BigDecimal {
	if (!Number.isInteger(exp)) throw new Error('Exponent must be an integer. Received: ' + exp);

	// Handle negative exponents by inverting the base: base^-n = (1/base)^n
	if (exp < 0) {
		const ONE = FromBigInt(1n);
		// Use floating-point division for a precise reciprocal
		const invertedBase = divide_floating(ONE, base);
		return powerInt(invertedBase, -exp);
	}

	let res = FromBigInt(1n); // Start with the identity element for multiplication
	let currentPower = base; // Start with base^1

	while (exp > 0) {
		// If the last bit of exp is 1, we need to multiply by the current power of the base.
		if (exp % 2 === 1) res = multiply_floating(res, currentPower);
		// Square the current power of the base for the next iteration (e.g., x -> x^2 -> x^4 -> x^8).
		currentPower = multiply_floating(currentPower, currentPower);
		// Integer division by 2 is equivalent to a right bit shift.
		exp = Math.floor(exp / 2);
	}

	return res;
}

/**
 * Calculates the power of a BigDecimal to any exponent (base^exp).
 * This works for integer and fractional exponents by using the identity:
 * base^exp = e^(exp * ln(base)).
 * If the exponent is an integer, it automatically uses the more efficient integer power function.
 * @param base The base BigDecimal.
 * @param exponent The exponent BigDecimal. Potential precision loss if the exponent came from a BigDecimal with extremely high precision.
 * @param mantissaBits The precision of the result in bits.
 * @returns A new BigDecimal representing base^exp.
 */
export function pow(
	base: BigDecimal,
	exponent: number,
	mantissaBits: number = DEFAULT_MANTISSA_PRECISION_BITS,
): BigDecimal {
	// 1. Handle edge cases
	if (base.bigint < ZERO && !Number.isInteger(exponent)) {
		throw new Error(
			'Power of a negative base to a non-integer exponent results in a complex number, which is not supported.',
		);
	}
	if (base.bigint === ZERO) {
		if (exponent > 0) return { bigint: ZERO, divex: mantissaBits }; // 0^positive = 0
		if (exponent < 0)
			throw new Error('0 raised to a negative power is undefined (division by zero).');
		return FromBigInt(ONE, mantissaBits); // 0^0 is conventionally 1
	}
	// If the exponent is an integer, use the more efficient integer power function.
	if (Number.isInteger(exponent)) return powerInt(base, exponent);

	// 2. Calculate ln(base) as a standard JavaScript number.
	const logOfBase = ln(base);

	// 3. Multiply: exponent * ln(base)
	const product = exponent * logOfBase;

	// 4. Convert the resulting number back to a BigDecimal to be used in exp().
	const productBD = FromNumber(product, mantissaBits);

	// 5. Calculate the final result: e^(product)
	return exp(productBD, mantissaBits);
}

/**
 * [Floating-Point Model] Calculates the square root of a BigDecimal using Newton's method.
 * The precision of the result is determined by the `mantissaBits` parameter.
 */
export function sqrt(
	bd: BigDecimal,
	mantissaBits: number = DEFAULT_MANTISSA_PRECISION_BITS,
): BigDecimal {
	// 1. Validate input
	if (bd.bigint < ZERO) throw new Error('Cannot calculate the square root of a negative number.');
	if (bd.bigint === ZERO) return { bigint: ZERO, divex: bd.divex };

	// 2. Make an initial guess (x_0)
	// A good initial guess is crucial for fast convergence.
	// A common technique is to use a value related to 2^(bitLength/2).
	// But that's the bitlength of the INTEGER portion, none of the decimal bits.
	const bitLength = bimath.bitLength_bisection(bd.bigint) - bd.divex; // Subtract the decimal bits
	let x_k = {
		bigint: ONE,
		divex: Math.round(-bitLength / 2),
	};
	// Align the guess to same precision as subsequent calculations.
	x_k = normalize(x_k, mantissaBits); // Normalize the guess to the desired mantissa bits.

	// 3. Iterate using Newton's method: x_{k+1} = (x_k + n / x_k) / 2
	// We continue until the guess stabilizes.
	let last_x_k = clone(x_k); // A copy to check for convergence

	// console.log("Beginning square root iteration for value:", toString(bd));

	const MAX_ITERATIONS = 100; // Limit iterations to prevent infinite loops in case of non-convergence.
	// console.log(`Starting sqrt iterations with mantissaBits = ${mantissaBits}`);
	for (let i = 0; i < MAX_ITERATIONS; i++) {
		// Calculate `n / x_k` using high-precision floating division
		const n_div_xk = divide_floating(bd, x_k, mantissaBits * 2);
		// Calculate `x_k + (n / x_k)`
		const sum = add(n_div_xk, x_k); // n_div_xk is FIRST since it has more precision, so the sum will match that precision!
		// Divide by 2: `(sum) / 2`. A right shift is equivalent to division by 2.
		x_k = { bigint: sum.bigint >> ONE, divex: sum.divex };

		// console.log(`Iteration ${i}: Value = ${toExactString(x_k)}`);

		// Check for convergence: if the guess is no longer changing, we've found our answer.
		// console.log(`Iteration ${i}: x_k = ${toExactString(x_k)}`);
		if (areEqual(x_k, last_x_k)) {
			// console.log(`Reached convergence in sqrt after ${i} iterations: ${toString(x_k)}`);
			return normalize(x_k, mantissaBits); // x_k has precision of n_div_xk before this
		}

		// Prepare for the next iteration.
		last_x_k = clone(x_k);
	}

	// If the loop completes without converging, something is wrong.
	throw new Error(`sqrt failed to converge after ${MAX_ITERATIONS} iterations.`);
}

/**
 * [Floating-Point Model] Calculates the hypotenuse of a right triangle, given the lengths of the two other sides.
 * @param bd1 - The length of one side.
 * @param bd2 - The length of the other side.
 * @param mantissaBits - The precision of the result in bits.
 */
export function hypot(
	bd1: BigDecimal,
	bd2: BigDecimal,
	mantissaBits: number = DEFAULT_MANTISSA_PRECISION_BITS,
): BigDecimal {
	// 1. Square the inputs
	const bd1_squared = multiply_fixed(bd1, bd1);
	const bd2_squared = multiply_fixed(bd2, bd2);

	// 2. Add the squares together.
	const sum_of_squares: BigDecimal = add(bd1_squared, bd2_squared);

	// 3. Calculate the square root of the sum to get the final result.
	const result = sqrt(sum_of_squares, mantissaBits);

	return result;
}

/** Calculates the base-10 logarithm of a BigDecimal. */
export function log10(bd: BigDecimal): number {
	// Use the change of base formula: log10(x) = ln(x) / ln(10).
	return ln(bd) / Math.LN10;
}

/** Calculates the natural logarithm (base e) of a BigDecimal. */
export function ln(bd: BigDecimal): number {
	if (bd.bigint < ZERO) return NaN;
	if (bd.bigint === ZERO) return -Infinity;

	// Use the formula: ln(bigint / 2^divex) = ln(bigint) - (divex * ln(2))
	const logOfMantissa = bimath.ln(bd.bigint);
	const logOfScale = bd.divex * Math.LN2;

	return logOfMantissa - logOfScale;
}

/**
 * [Floating-Point Model] Calculates the exponential function e^bd (the inverse of the natural logarithm).
 * This is computed using argument reduction and a Taylor Series expansion for arbitrary precision.
 * @param bd The BigDecimal exponent.
 * @param mantissaBits The precision of the result in bits.
 * @returns A new BigDecimal representing e^bd.
 */
export function exp(
	bd: BigDecimal,
	mantissaBits: number = DEFAULT_MANTISSA_PRECISION_BITS,
): BigDecimal {
	// --- 1. Argument Reduction ---
	// We use the identity: e^x = e^(y + k*ln(2)) = (e^y) * 2^k
	// First, find k = round(bd / ln(2))
	const LN2 = FromNumber(Math.LN2);
	const bd_div_ln2 = divide_floating(bd, LN2, mantissaBits);
	const k = toBigInt(bd_div_ln2);

	// Now, find y = bd - k * ln(2). This `y` will be small.
	const k_bd = FromBigInt(k, mantissaBits);
	const k_ln2 = multiply_floating(k_bd, LN2, mantissaBits);
	const y = subtract(bd, k_ln2);

	// --- 2. Taylor Series for e^y ---
	// The Taylor series for e^y is Σ (y^n / n!) from n=0 to infinity.
	// Since `y` is small, this series converges very quickly.
	// We can compute this iteratively: term_n = term_{n-1} * (y / n)

	// Initialize sum and the first term (y^0 / 0! = 1)
	let sum = FromBigInt(1n, mantissaBits);
	let term = clone(sum);
	let lastSum = FromBigInt(0n, mantissaBits);

	const MAX_ITERATIONS = 100n; // Safety break

	for (let n = 1n; n <= MAX_ITERATIONS; n++) {
		// console.log(`Iteration ${n}:`);
		const n_bd = FromBigInt(n, mantissaBits);

		// Calculate the next term: term = term * (y / n)
		const y_div_n = divide_floating(y, n_bd, mantissaBits);
		term = multiply_floating(term, y_div_n, mantissaBits);

		// Add the new term to the sum.
		sum = add(sum, term);
		// console.log("New Sum:", toString(sum));

		// Check for convergence.
		if (areEqual(sum, lastSum)) {
			// console.log(`exp() converged after ${i} iterations.`);

			// --- 3. Scale the Result ---
			// We now have e^y. The final result is (e^y) * 2^k.
			// A multiplication by 2^k is a simple divex adjustment.
			// value = (bigint / 2^divex) * 2^k = bigint / 2^(divex - k)
			const finalResult = {
				bigint: sum.bigint,
				divex: sum.divex - Number(k),
			};
			return finalResult;
		}

		// Prepare for the next iteration.
		lastSum = clone(sum);
	}

	// If the loop completes without converging, something is wrong.
	throw new Error(`exp failed to converge after ${MAX_ITERATIONS} iterations.`);
}

/**
 * Returns a new BigDecimal that is the absolute value of the provided BigDecimal.
 * @param bd - The BigDecimal.
 * @returns A new BigDecimal representing the absolute value.
 */
export function abs(bd: BigDecimal): BigDecimal {
	return {
		bigint: bimath.abs(bd.bigint),
		divex: bd.divex,
	};
}

/**
 * Negates a BigDecimal.
 *
 * Non-mutating; returns a new BigDecimal.
 */
export function negate(bd: BigDecimal): BigDecimal {
	return { bigint: -bd.bigint, divex: bd.divex };
}

/** Returns the smaller of two BigDecimals. */
export function min(bd1: BigDecimal, bd2: BigDecimal): BigDecimal {
	return compare(bd1, bd2) === 1 ? bd2 : bd1;
}

/** Returns the larger of two BigDecimals. */
export function max(bd1: BigDecimal, bd2: BigDecimal): BigDecimal {
	return compare(bd1, bd2) === -1 ? bd2 : bd1;
}

/** Returns a BigDecimal that is clamped between the specified minimum and maximum values. */
export function clamp(bd: BigDecimal, min: BigDecimal, max: BigDecimal): BigDecimal {
	return compare(bd, min) < 0 ? min : compare(bd, max) > 0 ? max : bd;
}

/** Rounds a BigDecimal to the nearest integer, rounding half up. */
export function round(bd: BigDecimal): BigDecimal {
	const bigintRounded = toBigInt(bd);
	// Create a new BigDecimal with the rounded bigint and the same divex as the input.
	return FromBigInt(bigintRounded, bd.divex);
}

/**
 * Calculates the floor of a BigDecimal (the largest integer less than or equal to it).
 * The resulting BigDecimal will have the same divex as the input.
 * e.g., floor(2.7) -> 2.0, floor(-2.7) -> -3.0
 * @param bd The BigDecimal to process.
 * @returns A new BigDecimal representing the floored value, at the same precision.
 */
export function floor(bd: BigDecimal): BigDecimal {
	// If divex is non-positive, the number is already an integer value.
	if (bd.divex <= 0) return { bigint: bd.bigint, divex: bd.divex };

	const divexBigInt = BigInt(bd.divex);
	const scale = ONE << divexBigInt;

	// The remainder when dividing by the scale factor.
	// This tells us if there is a fractional part.
	const remainder = bd.bigint % scale;

	// If there's no remainder, it's already a whole number.
	if (remainder === ZERO) return { bigint: bd.bigint, divex: bd.divex };

	let flooredBigInt: bigint;
	if (bd.bigint >= ZERO) {
		// For positive numbers, floor is simple truncation.
		// We subtract the remainder to get to the nearest multiple of the scale below.
		flooredBigInt = bd.bigint - remainder;
	} else {
		// For negative numbers, floor means going more negative.
		// e.g., floor of -2.5 is -3.
		// We subtract the scale factor and then add back the negative remainder.
		flooredBigInt = bd.bigint - remainder - scale;
	}

	return {
		bigint: flooredBigInt,
		divex: bd.divex,
	};
}

/**
 * Calculates the ceiling of a BigDecimal (the smallest integer greater than or equal to it).
 * The resulting BigDecimal will have the same divex as the input.
 * e.g., ceil(2.1) -> 3.0, ceil(-2.1) -> -2.0
 * @param bd The BigDecimal to process.
 * @returns A new BigDecimal representing the ceiled value, at the same precision.
 */
export function ceil(bd: BigDecimal): BigDecimal {
	// If divex is non-positive, the number is already an integer value.
	if (bd.divex <= 0) return { bigint: bd.bigint, divex: bd.divex };

	const divexBigInt = BigInt(bd.divex);
	const scale = ONE << divexBigInt;
	const remainder = bd.bigint % scale;

	// If there's no remainder, it's already a whole number.
	if (remainder === ZERO) return { bigint: bd.bigint, divex: bd.divex };

	let ceiledBigInt: bigint;
	if (bd.bigint >= ZERO) {
		// For positive numbers, ceil means going more positive.
		// e.g., ceil of 2.1 is 3.
		// We subtract the remainder and then add the scale factor.
		ceiledBigInt = bd.bigint - remainder + scale;
	} else {
		// For negative numbers, ceil is simple truncation (towards zero).
		ceiledBigInt = bd.bigint - remainder;
	}

	return {
		bigint: ceiledBigInt,
		divex: bd.divex,
	};
}

// Floating-Point Model Helpers ====================================================

/**
 * Normalizes a BigDecimal to enforce a true floating-point precision model.
 * For any number, it trims the mantissa to `precisionBits` to standardize precision,
 * adjusting the `divex` accordingly. This allows `divex` to become negative to
 * represent large numbers.
 * @param bd The BigDecimal to normalize.
 * @param [precisionBits=DEFAULT_MANTISSA_PRECISION_BITS] The target mantissa bits.
 * @returns A new, normalized BigDecimal.
 */
function normalize(
	bd: BigDecimal,
	precisionBits: number = DEFAULT_MANTISSA_PRECISION_BITS,
): BigDecimal {
	// We work with the absolute value for bit length calculation.
	const mantissa = bimath.abs(bd.bigint);

	// Use the fast, mathematical bitLength function.
	const currentBitLength = bimath.bitLength_bisection(mantissa);

	const shiftAmount = BigInt(currentBitLength - precisionBits);

	// Calculate the new divex. It can now be negative.
	const newDivex = bd.divex - Number(shiftAmount);

	// Round using the consistent "half towards positive infinity" method.
	const half = ONE << (shiftAmount - ONE);
	const finalBigInt = (bd.bigint + half) >> shiftAmount;

	return { bigint: finalBigInt, divex: newDivex };
}

// Comparison =====================================================

/**
 * Compares two BigDecimals.
 * @param bd1 The first BigDecimal.
 * @param bd2 The second BigDecimal.
 * @returns -1 if bd1 < bd2, 0 if bd1 === bd2, and 1 if bd1 > bd2.
 */
export function compare(bd1: BigDecimal, bd2: BigDecimal): -1 | 0 | 1 {
	// To compare, we must bring them to a common divex, just like in add/subtract.
	// However, we don't need to create new objects.

	let bigint1 = bd1.bigint;
	let bigint2 = bd2.bigint;

	if (bd1.divex > bd2.divex) {
		// Scale up bd2 to match bd1's divex.
		bigint2 <<= BigInt(bd1.divex - bd2.divex);
	} else if (bd2.divex > bd1.divex) {
		// Scale up bd1 to match bd2's divex.
		bigint1 <<= BigInt(bd2.divex - bd1.divex);
	}
	// If divex are equal, no scaling is needed.

	// Now that they are at the same scale, we can directly compare the bigints.
	return bigint1 < bigint2 ? -1 : bigint1 > bigint2 ? 1 : 0;
}

/** Tests if two BigDecimals are equal in value. */
export function areEqual(bd1: BigDecimal, bd2: BigDecimal): boolean {
	return compare(bd1, bd2) === 0;
}
/**
 * Checks if a BigDecimal represents a perfect integer (a whole number). */
export function isInteger(bd: BigDecimal): boolean {
	// If divex is non-positive, the number is already an integer value.
	// The value is bigint * 2^(-divex), which is guaranteed to be an integer.
	if (bd.divex <= 0) return true;

	// If divex is positive, the value is an integer only if the `bigint`
	// is a multiple of 2^divex. This means the fractional part is zero.
	const scale = ONE << BigInt(bd.divex);

	// If the remainder of the bigint when divided by the scale is zero,
	// it means all fractional bits are 0, so it's a perfect integer.
	// It is almost CERTAIN this is highly optimized by the JS engine,
	// since the divisor is a power of two. This should be on par with bitwise operations.
	return bd.bigint % scale === ZERO;
}

/** Tests whether a BigDecimal is equivalent to zero. */
export function isZero(bd: BigDecimal): boolean {
	return bd.bigint === ZERO;
}

// Utility =============================================================

/** Returns a deep copy of the original big decimal. */
export function clone(bd: BigDecimal): BigDecimal {
	return {
		bigint: bd.bigint,
		divex: bd.divex,
	};
}

/**
 * Modifies the BigDecimal to have the specified decimal precision, always rounding half up.
 * Mutating, modifies the original BigDecimal.
 * @param bd The BigDecimal to modify.
 * @param divex The target precision in bits.
 */
export function setExponent(bd: BigDecimal, divex: number): void {
	const difference = bd.divex - divex;

	// If there's no change, do nothing.
	if (difference === 0) return;

	// If the difference is negative, we are increasing precision (shifting left).
	// This is a pure scaling operation and never requires rounding.
	if (difference < 0) {
		bd.bigint <<= BigInt(-difference);
		bd.divex = divex;
		return;
	}

	// We are now decreasing precision (shifting right), so we must round.

	// To "round half up", we add 0.5 before truncating.
	// "0.5" relative to the part being discarded is 1 bit shifted by (difference - 1).
	const half = ONE << BigInt(difference - 1);

	bd.bigint += half;
	bd.bigint >>= BigInt(difference);
	bd.divex = divex;
}

/**
 * Sets the BigDecimal to have the default working precision for all fixed point operations.
 * Mutating, modifies the original BigDecimal.
 */
export function fixPrecision(bd: BigDecimal): void {
	setExponent(bd, DEFAULT_WORKING_PRECISION);
}

/**
 * Returns whether a bigdecimal has the default [FIXED] amount of precision.
 * This is to help you catch when you accidentally use operations that change
 * the precision model from the default fixed-point, when your variable in
 * question should always remain with fixed precision.
 * @param bd The BigDecimal to check.
 * @returns True if the BigDecimal has the default working precision.
 */
export function hasDefaultPrecision(bd: BigDecimal): boolean {
	return bd.divex === DEFAULT_WORKING_PRECISION;
}

// Conversion ====================================================================

/**
 * Convert a BigDecimal to a javascript number.
 * Will overflow to Infinity if the mantissa of the BigDecimal is too large,
 * or underflow to 0 if the precision is too high.
 * @param bd - The BigDecimal to convert.
 * @returns The value as a standard javascript number.
 */
export function toNumber(bd: BigDecimal): number {
	if (bd.divex >= 0) {
		if (bd.divex > MAX_DIVEX_BEFORE_INFINITY) return 0; // Exponent is so high that the resulting number cast to that power of two will be close to zero.
		const mantissaAsNumber = Number(bd.bigint);
		if (!isFinite(mantissaAsNumber)) return mantissaAsNumber; // Already Infinity or -Infinity
		return mantissaAsNumber / powersOfTwoList[bd.divex]!;
	} else {
		// divex is negative
		const exp = -bd.divex;
		const mantissaAsNumber = Number(bd.bigint);
		if (!isFinite(mantissaAsNumber)) return mantissaAsNumber; // Already Infinity or -Infinity
		if (exp > MAX_DIVEX_BEFORE_INFINITY) return mantissaAsNumber >= 0 ? Infinity : -Infinity; // Exponent is so high that the resulting number cast to that power of two will be infinite.
		return mantissaAsNumber * powersOfTwoList[exp]!;
	}
}

/**
 * Converts a BigDecimal to a BigInt.
 * If the BigDecimal represents a fractional number, it is rounded to the nearest integer
 * using "round half up" (towards positive infinity). E.g., 2.5 becomes 3, and -2.5 becomes -2.
 * If the BigDecimal represents a large integer (with a negative divex), it is scaled appropriately.
 * @param bd The BigDecimal to convert.
 * @returns The rounded BigInt value.
 */
export function toBigInt(bd: BigDecimal): bigint {
	// Negative divex means it's a large integer. Scale up.
	if (bd.divex < 0) return bd.bigint << BigInt(-bd.divex);

	// If divex is 0, the number is already a correctly scaled integer.
	if (bd.divex === 0) return bd.bigint;

	const divexBigInt = BigInt(bd.divex);

	// To "round half up", we add 0.5 before truncating.
	// In our fixed-point system, "0.5" is represented by 2^(divex - 1).
	const half = ONE << (divexBigInt - ONE);

	// Add half and then truncate. The arithmetic right shift `>>` handles truncation
	// correctly for both positive and negative numbers.
	const adjustedBigInt = bd.bigint + half;

	return adjustedBigInt >> divexBigInt;
}

/**
 * Converts a BigDecimal to a string. This returns its EXACT value!
 *
 * Note: Due to the nature of all binary fractions having power-of-2 denominators,
 * this string can make it appear as if they have more decimal digit precision than they actually do.
 * For example, 1/1024 = 0.0009765625, which at first glance *looks* like it has
 * 9 digits of decimal precision, but in all effectiveness it only has 3 digits of precision,
 * because a single increment to 2/1024 now yields 0.001953125, which changed **every single** digit!
 * The effective decimal digits can be calculated using {@link getEffectiveDecimalPlaces}.
 */
export function toExactString(bd: BigDecimal): string {
	if (bd.bigint === ZERO) return '0';
	if (bd.divex < 0) return toBigInt(bd).toString(); // Negative divex: It's a large integer.
	if (bd.divex === 0) return bd.bigint.toString();

	const isNegative = bd.bigint < ZERO;
	// Use the absolute value for all calculations and add the sign back at the end.
	const absBigInt = isNegative ? -bd.bigint : bd.bigint;
	const divexBigInt = BigInt(bd.divex);

	// 1. Separate the integer and fractional parts.
	const integerPart = absBigInt >> divexBigInt;
	const fractionalPart = absBigInt - (integerPart << divexBigInt);

	// If there's no fraction, we are done. This is a crucial optimization.
	if (fractionalPart === ZERO) return (isNegative ? '-' : '') + integerPart.toString();

	// 2. Convert the fractional part to a decimal string using the 5**N shortcut.
	// The math is: (fractional / 2^d) * 10^d = fractional * 5^d
	const powerOfFive = FIVE ** divexBigInt;
	const decimalDigits = fractionalPart * powerOfFive;

	// 3. Pad the decimal string with leading zeros to match the divex.
	let decimalString = decimalDigits.toString().padStart(bd.divex, '0');

	// And trim any trailing zeros.
	let i = decimalString.length - 1;
	while (i >= 0 && decimalString[i] === '0') {
		i--;
	}
	decimalString = decimalString.slice(0, i + 1);

	// 4. Combine the parts and the sign into the final string.
	const sign = isNegative ? '-' : '';
	const integerString = integerPart.toString();

	// This check is for robustness in case the entire fraction was zeros.
	if (decimalString.length === 0) return sign + integerString;
	else return sign + integerString + '.' + decimalString;
}

/**
 * Converts a BigDecimal to a string, rounded to its "effective" number of decimal places.
 * This trims extraneous digits that give a false sense of precision.
 */
export function toApproximateString(bd: BigDecimal): string {
	// 1. Handle the zero case simply.
	if (bd.bigint === ZERO) return '0';

	// 2. Determine the effective number of decimal places to round to.
	const decimalPlaces = getEffectiveDecimalPlaces(bd);

	// If there's no fractional part to consider (or it's a large integer), just round to a BigInt and return.
	if (decimalPlaces <= 0) return toBigInt(bd).toString();

	// 3. Round to the target decimal places.
	// The logic is: multiply by 10^P, round, then format back to a string.
	const powerOfTen = TEN ** BigInt(decimalPlaces);
	// Use the logic from `multiply_floating` to get an exact scaled value
	// before rounding, avoiding the precision loss of `multiply_fixed`.
	const scaledBigInt = bd.bigint * powerOfTen;
	const scaledDivex = bd.divex;
	const scaledBd = { bigint: scaledBigInt, divex: scaledDivex };
	const roundedScaledInt = toBigInt(scaledBd);

	// 4. Format the resulting integer back into a decimal string.
	const absStr = bimath.abs(roundedScaledInt).toString();

	let integerPart: string;
	let fractionalPart: string;

	if (absStr.length > decimalPlaces) {
		// The number is >= 1.0
		const splitPoint = absStr.length - decimalPlaces;
		integerPart = absStr.substring(0, splitPoint);
		fractionalPart = absStr.substring(splitPoint);
	} else {
		// The number is < 1.0, requires left-padding with zeros.
		integerPart = '0';
		fractionalPart = absStr.padStart(decimalPlaces, '0');
	}

	// 5. Trim meaningless trailing zeros from the fractional part.
	const trimmedFractionalPart = fractionalPart.replace(/0+$/, '');

	const sign = roundedScaledInt < ZERO ? '-' : '';

	// 6. Combine and return the final string.
	// If the entire fractional part was zeros, don't show the decimal point.
	if (trimmedFractionalPart.length === 0) return sign + integerPart;
	else return sign + integerPart + '.' + trimmedFractionalPart;
}

/**
 * Estimates the number of effective decimal place precision of a BigDecimal.
 * This is based on the formula `floor(divex * log10(2))`. A negative result
 * indicates the approximate number of trailing zeros in a large integer.
 * @param bd - The BigDecimal
 * @returns The number of estimated effective decimal places.
 */
function getEffectiveDecimalPlaces(bd: BigDecimal): number {
	return Math.floor(bd.divex * LOG10_OF_2);
}

// Exports ====================================================================

export default {
	// Config
	SetGlobalPrecision,
	// Constructors
	FromNumber,
	FromBigInt,
	// Arithmetic
	add,
	subtract,
	multiply_fixed,
	multiply_floating,
	divide_fixed,
	divide_floating,
	mod,
	powerInt,
	pow,
	sqrt,
	hypot,
	log10,
	ln,
	exp,
	abs,
	negate,
	min,
	max,
	clamp,
	round,
	floor,
	ceil,
	// Comparison
	compare,
	areEqual,
	isInteger,
	isZero,
	// Utility
	clone,
	setExponent,
	fixPrecision,
	hasDefaultPrecision,
	// Conversion
	toNumber,
	toBigInt,
	toExactString,
	toApproximateString,
};

export type { BigDecimal };
