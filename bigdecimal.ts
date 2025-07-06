
/**
 * bigdecimal.js v0.2.0 Beta
 * High performance arbitrary-precision decimal type of Javascript.
 * https://github.com/Naviary2/BigDecimal
 * Copyright (c) 2024 Naviary (www.InfiniteChess.org) <infinitechess.org@gmail.com>
 * MIT License
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */


/**
 * TODO:
 * 
 * - Javascript numbers DO have a bitshift operation (not sure what lead me to believe they don't),
 * so use that intead of multiplying by powers of 2.
 *
 * - If the priority is speed, then I should probably revert back to storing the 
 * BigDecimals as objects, instead of classes, because using the class 
 * constructor is about 20% slower.
 * I will just have to accept calling BigDecMath.multiply() and other operations
 * for performing arithmetic on BigDecimals.
 * 
 * - Decide how we want to handle the precision when you pass in a string for the BigDecimal.
 * For example, if 1.111222333444555666777888999 is passed in, should the precision be a set
 * 50 bits, or should the precision be 50 bits *more* than the minimum amount of bits to round
 * to that value? And if the precision is always constant, how would we handle repeated division
 * when the number gets smaller and smaller? It would eventually truncate to zero. Do we need a
 * way to dynamically increase the precision when the number gets smaller and smaller?
 * 
 * - toNumber() could be re-written to handle both the integer and decimal
 * parts together instead of separate.
 * 
 * - Finish writing all remaining arithmetic methods of MathBigDec!
 * 
 */




import bigintmath from './bigintmath';



// Useful Number constants
const LOG_TWO: number = Math.log(2);

// Usefule BigInt constants
const NEGONE: bigint = -1n;
const ZERO: bigint = 0n;
const ONE: bigint = 1n;
// const TWO: bigint = 2n;
const TEN: bigint = 10n;

// The minimum number of bits used to store decimal bits in BigDecimals.
// Without a minimum precision, small numbers parsed into BigDecimals would lose some precision.
// For example, 3.1 divex 4 ==> 3.125. Now even though 3.125 DOES round to 3.1,
// it means we'll very quickly lose a lot of accuracy when performing arithmetic!
// The user expects that, when they pass in 3.1, the resulting BigDecimal should be AS CLOSE to 3.1 as possible!!
// With a DEFAULT_PRECISION of 50 bits, 3.1 divex 50 ==> 3.10000000000000142, which is A LOT closer to 3.1!
// I arbitrarily chose 50 bits for the minimum, because that gives us about 15 digits of precision,
// which is about how much javascript's doubles give us.
const DEFAULT_PRECISION: number = 50; // Default: 50

/**
 * The maximum divex a BigDecimal is allowed to have.
 * Beyond this, the divex is assumed to be running away towards Infinity, so an error is thrown.
 */
const MAX_DIVEX: number = 1e5; // Default: 1e5 (100,000)

/** A list of powers of 2, 1024 in length, starting at 1 and stopping before Number.MAX_VALUE. This goes up to 2^1023. */
const powersOfTwoList: number[] = (() => {
    const powersOfTwo: number[] = [];
    let currentPower = 1
    while (currentPower < Number.MAX_VALUE) {
        powersOfTwo.push(currentPower)
        currentPower *= 2;
    }
    return powersOfTwo;
})();

// Any divex greater than 1023 can lead to Number casts greater
// than MAX_VALUE or equal to Infinity, because 1 * 2^1024 === Infinity,
// but 1 * 2^1023 does NOT. And 1.0 encompasses all possible fractional values!
// BigDecimals with divexs THAT big need special care!
const MAX_DIVEX_BEFORE_INFINITY: number = powersOfTwoList.length - 1; // 1023

/**
 * Returns the specified bigint power of 2 when called.
 * This has a dynamic internal list that, when a power of 2 is requested that is does not have,
 * it will calculate more powers of 2 up to the requested power!
 * @param power - The power of 2 to retrieve
 * @returns The bigint power of 2 requested
 */
const getBigintPowerOfTwo: (power: number) => bigint = (function() {

    // Initiate the list
    const powersOfTwo: bigint[] = []
    let currentPower: bigint = ONE
    const MAX_VALUE: bigint = BigInt(Number.MAX_VALUE)
    while (currentPower < MAX_VALUE) {
        powersOfTwo.push(currentPower)
        currentPower <<= ONE;
    }

    // Adds more powers of 2 until we reach the provided power
    function addMorePowers(powerCap: number): void {
        console.log(`Adding more bigint powers of 2, up to 2^${powerCap}!`)
        for (let i = powersOfTwo.length - 1; i <= powerCap - 1; i++) {
            const thisPower = powersOfTwo[i];
            powersOfTwo[i+1] = thisPower << ONE;
        }
    }

    // Return a function that, when called, returns the specified power of 2
    return (power: number): bigint => {
        // Do we have enough powers of two in store?
        if (power > powersOfTwo.length - 1) addMorePowers(power);
        return powersOfTwo[power];
    }
})()

// /**
//  * DEPRICATED. Old constructor method.
//  * 
//  * Creates a BigDecimal that is equal to the provided number and has the specified divex level.
//  * If the divex is not provided, DEFAULT_PRECISION is used, providing about 15 decimal places of precision.
//  * 
//  * @param {bigint | string | number} number - The true value of the BigDecimal
//  * @param {number | undefined} [divex] - Optional. The desired divex, or precision for the BigDecimal. 0+, where 0 is integer-level precision. If left undefined, DEFAULT_PRECISION will be used.
//  * @returns {BigDecimal} - The BigDecimal
//  */
// function BigDecimal(number, divex) {
//     if (typeof number !== 'number' || Number.isInteger(number)) { // An integer was passed in...

//         if (typeof number !== 'bigint') number = BigInt(number)
//         if (divex == null) divex = 0; // Integer precision
    
//         number <<= BigInt(divex);

//         return newBigDecimalFromProperties(number, divex);
//     }

//     // A number primitive with decimals was passed in...

//     // Auto-sets the divex level if not specified
//     divex = validateExponent(number, divex);

//     // Separate the integer and decimal parts of the number
//     const { integer, decimal } = getIntegerAndDecimalParts_FromNumber(number);

//     // The number has to be bit-shifted according to the desired divex level
//     number = BigInt(integer)
//     number <<= BigInt(divex);

//     // What is the decimal part bit shifted?...

//     let powerOf2ToUse = powersOfTwoList[divex];

//     // Is the divex SO LARGE that bit shifting the Number before casting
//     // to a BigInt would make it Infinity? Accomodate for this scenario.
//     let extraToShiftLeft = 0;
//     if (divex > MAX_DIVEX_BEFORE_INFINITY) {
//         powerOf2ToUse = powersOfTwoList[MAX_DIVEX_BEFORE_INFINITY];
//         extraToShiftLeft = divex - MAX_DIVEX_BEFORE_INFINITY;
//     }

//     // Javascript doubles don't have a native bit shift operation
//     // Because of this, we multiply by powers of 2 to simulate bit shifting!
//     const shiftedDecimal = decimal * powerOf2ToUse; // Same as decimal * 2**divex
    
//     const roundedDecimal = Math.round(shiftedDecimal)
//     let decimalPart = BigInt(roundedDecimal);

//     if (extraToShiftLeft > 0) decimalPart <<= BigInt(extraToShiftLeft);

//     // Finally, add the decimal part to the number
//     number += decimalPart;

//     return newBigDecimalFromProperties(number, divex);
// }

// /**
//  * DEPRICATED. Used by old BigDecimal constructor.
//  * 
//  * Use this BigDecimal constructor when you already know the `number` and `divex` properties of the BigDecimal.
//  * @param {bigint} number - The `number` property
//  * @param {number} divex - The `divex` property
//  */
// function newBigDecimalFromProperties(number, divex) {
//     watchExponent(divex); // Protects the divex from running away to Infinity.
//     return { number, divex }
// }

// /**
//  * DEPRICATED. Used by the old BigDecimal constructor.
//  * 
//  * Separates the number into its integer and decimal components.
//  * This can be used during the process of converting it to a BigInt or BigDecimal
//  * @param {number} number - The number
//  * @returns {object} An object with 2 properties, `integer` and `decimal`.
//  */
// function getIntegerAndDecimalParts_FromNumber(number) {
//     let integerPart = Math.trunc(number);
//     let decimalPart = number - integerPart;
//     return { integer: integerPart, decimal: decimalPart }
// }

interface BigDecimal {
    bigint: bigint,
    divex: number,
}


/**
 * Creates a Big Decimal from a javascript number (double)
 * @param num 
 * @param [precision]
 */
function NewBigDecimal_FromNumber(num: number, precision: number = DEFAULT_PRECISION): BigDecimal {
    if (!isFinite(num)) throw new Error(`Cannot create a BigDecimal from a non-finite number. Received: ${num}`);
    if (precision < 0 || precision > MAX_DIVEX) throw new Error(`Precision must be between 0 and ${MAX_DIVEX}. Received: ${precision}`);

    const fullDecimalString = toFullDecimalString(num);
    return NewBigDecimal_FromString(fullDecimalString, precision);
}

/**
 * Creates a Big Decimal from a string (arbitrarily long)
 * "1905000302050000000000000000000000000000000000.567"
 * @param num
 * @param [precision]
 */
function NewBigDecimal_FromString(num: string, precision: number = DEFAULT_PRECISION): BigDecimal {
    if (precision < 0 || precision > MAX_DIVEX) throw new Error(`Precision must be between 0 and ${MAX_DIVEX}. Received: ${precision}`);

    const dotIndex: number = num.lastIndexOf('.');
    const decimalDigitCount: number = dotIndex !== -1 ? num.length - dotIndex - 1 : 0;

    // Set the divex property to the specified precision.
    // If the number can be represented perfectly will a lower divex,
    // this will be modified soon!
    let divex: number = precision;

    // Make the number an integer by multiplying by 10^n where n is the decimal digit count.
    const powerOfTen: bigint = TEN**BigInt(decimalDigitCount);
    // We can accomplish the same thing by just removing the dot instead.
    if (dotIndex !== -1) num = num.slice(0, dotIndex) + num.slice(dotIndex + 1);

    let numberAsBigInt: bigint = BigInt(num); // Cast to a bigint now

    numberAsBigInt <<= BigInt(divex);

    // Now we undo the multiplication by 10^n we did earlier.
    let bigint: bigint = numberAsBigInt / powerOfTen

    // If this is zero, we can represent this number perfectly with a lower divex!
    // const difference: bigint = numberAsBigInt - (bigint * powerOfTen)
    // if (difference === ZERO) {
    //     // The different in number of digits is the number of
    //     // bits we need to represent this number exactly!!
    //     const newExponent: number = `${numberAsBigInt}`.length - `${bigint}`.length;
    //     const divexDifference: number = divex - newExponent
    //     bigint >> BigInt(divexDifference);
    //     divex = newExponent;
    // }

    return {
        bigint,
        divex,
    }
}

/**
 * Creates a Big Decimal from a bigint and a desired precision level.
 * @param num
 * @param [precision]
 */
function NewBigDecimal_FromBigInt(num: bigint, precision: number = DEFAULT_PRECISION): BigDecimal {
    if (precision < 0 || precision > MAX_DIVEX) throw new Error(`Precision must be between 0 and ${MAX_DIVEX}. Received: ${precision}`);
    return {
        bigint: num << BigInt(precision),
        divex: precision,
    }
}



/**
 * Throws an error if the provided divex is beyond `MAX_DIVEX`.
 * It is assumed it's running away to Infinity.
 * @param divex - The `divex` property of the BigDecimal
 */
function watchExponent(divex: number): void  {
    if (divex > MAX_DIVEX)
        throw new Error(`Cannot create a BigDecimal with divex ${divex}! Out of range. Max allowed: ${MAX_DIVEX}. If you need more range, please increase the MAX_DIVEX variable.`)
}

/**
 * Converts a finite number to a string in full decimal notation, avoiding scientific notation.
 * This method is reliable for all finite numbers, correctly handling all edge cases.
 *
 * @param num The number to convert.
 * @returns The number in decimal format as a string.
 * @throws {Error} If the input is not a finite number (e.g., Infinity, -Infinity, or NaN).
 */
function toFullDecimalString(num: number): string {
    // 1. Input Validation: Fail fast for non-finite numbers.
    if (!Number.isFinite(num)) throw new Error(`Cannot decimal-stringify a non-finite number. Received: ${num}`);

	// 2. Optimization: Handle numbers that don't need conversion.
	const numStr: string = String(num);
	if (!numStr.includes('e')) return numStr;

	// 3. Deconstruct the scientific notation string.
	const [base, exponentStr] = numStr.split('e');
	const exponent: number = Number(exponentStr);
	const sign: string = base[0] === '-' ? '-' : '';
	const absBase: string = base.replace('-', '');
	const [intPart, fracPart = ''] = absBase.split('.');

	// 4. Reconstruct the string based on the exponent.
	if (exponent > 0) { // For large numbers
		if (exponent >= fracPart.length) {
			// Case A: The decimal point moves past all fractional digits.
			// e.g., 1.23e5 -> 123000
			const allDigits = intPart + fracPart;
			const zerosToPad = exponent - fracPart.length;
			return sign + allDigits + '0'.repeat(zerosToPad);
		} else {
			// Case B: The decimal point lands within the fractional digits.
			// e.g., 1.2345e2 -> 123.45
			const decimalIndex = intPart.length + exponent;
			const allDigits = intPart + fracPart;
			const left = allDigits.slice(0, decimalIndex);
			const right = allDigits.slice(decimalIndex);
			return sign + left + '.' + right;
		}
	} else { // For small numbers (exponent < 0)
		const numLeadingZeros = -exponent - 1;
		const allDigits = intPart + fracPart;
		return sign + '0.' + '0'.repeat(numLeadingZeros) + allDigits;
	}
}



/** Math and arithmetic methods performed on BigDecimals */
const MathBigDec = {

    /**
     * Adds two BigDecimal numbers.
     * The resulting BigDecimal will have a divex equal to the maximum divex of the two operands to prevent precision loss.
     * @param bd1 - The first addend.
     * @param bd2 - The second addend.
     * @returns The sum of bd1 and bd2.
     */
    add(bd1: BigDecimal, bd2: BigDecimal): BigDecimal {
        // To add, both BigDecimals must have the same divex (common denominator).
        // We'll scale the one with the lower divex up to match the higher one.

        let resultDivex: number;
        let sum: bigint;

        if (bd1.divex === bd2.divex) {
            // Exponents are the same, a simple bigint addition is sufficient.
            return {
                bigint: bd1.bigint + bd2.bigint,
                divex: bd1.divex
            }
        } else if (bd1.divex > bd2.divex) {
            // Scale up bd2 to match bd1's divex
            const bd2DivexAdjusted = bd2.bigint << BigInt(bd1.divex - bd2.divex);
            return {
                bigint: bd1.bigint + bd2DivexAdjusted,
                divex: bd1.divex
            }
        } else { // divex2 > divex1
            // Scale up bd1 to match bd2's divex
            const bd1DivexAdjusted = bd1.bigint << BigInt(bd2.divex - bd1.divex);
            return {
                bigint: bd1DivexAdjusted + bd2.bigint,
                divex: bd2.divex
            }
        }
    },

    /**
     * Subtracts the second BigDecimal from the first.
     * The resulting BigDecimal will have a divex equal to the maximum divex of the two operands to prevent precision loss.
     * @param bd1 - The minuend.
     * @param bd2 - The subtrahend.
     * @returns The difference of bd1 and bd2 (bd1 - bd2).
     */
    subtract(bd1: BigDecimal, bd2: BigDecimal): BigDecimal {
        // To subtract, both BigDecimals must have the same divex (common denominator).
        // We scale the one with the lower divex up to match the higher one.

        if (bd1.divex === bd2.divex) {
            // Exponents are the same, a simple bigint subtraction is sufficient.
            return {
                bigint: bd1.bigint - bd2.bigint,
                divex: bd1.divex
            };
        } else if (bd1.divex > bd2.divex) {
            // Scale up bd2's bigint to match bd1's divex
            const bd2BigIntAdjusted = bd2.bigint << BigInt(bd1.divex - bd2.divex);
            return {
                bigint: bd1.bigint - bd2BigIntAdjusted,
                divex: bd1.divex
            };
        } else { // bd2.divex > bd1.divex
            // Scale up bd1's bigint to match bd2's divex
            const bd1BigIntAdjusted = bd1.bigint << BigInt(bd2.divex - bd1.divex);
            return {
                bigint: bd1BigIntAdjusted - bd2.bigint,
                divex: bd2.divex
            };
        }
    },

    // Multiplication...

    /**
     * Multiplies two BigDecimal numbers.
     * @param bd1 - Factor1
     * @param bd2 - Factor2
     * @param mode - The mode for determining the new divex.
     * - `0` (default): Uses the maximum divex of the two factors.
     * - `1`: Uses the sum of the factors' divexs for full precision.
     * - `2`: Uses the minimum divex of the two factors.
     * @returns The product of BigDecimal1 and BigDecimal2.
     */
    multiply(bd1: BigDecimal, bd2: BigDecimal, mode: 0 | 1 | 2 = 0): BigDecimal {
        const targetDivex: number = 
            mode === 0 ? Math.max(bd1.divex, bd2.divex)  // Max
          : mode === 1 ? bd1.divex + bd2.divex           // Add
          :              Math.min(bd1.divex, bd2.divex); // Min

        // The true divex of the raw product is (bd1.divex + bd2.divex).
        // We shift the raw product to scale it to the targetDivex.
        const shiftAmount = BigInt((bd1.divex + bd2.divex) - targetDivex);

        return {
            bigint: (bd1.bigint * bd2.bigint) >> shiftAmount,
            divex: targetDivex,
        };
    },

    /**
     * Divides the first BigDecimal by the second, producing a result with a predictable divex.
     * The final divex is determined by the maximum of the inputs' divex and DEFAULT_PRECISION.
     * This prevents the divex from growing uncontrollably with repeated divisions.
     * @param bd1 - The dividend.
     * @param bd2 - The divisor.
     * @param [workingPrecision=DEFAULT_PRECISION] - Extra bits for internal calculation to prevent rounding errors.
     * @returns The quotient of bd1 and bd2 (bd1 / bd2).
     * @throws {Error} If attempting to divide by zero.
     */
    divide(bd1: BigDecimal, bd2: BigDecimal, workingPrecision: number = DEFAULT_PRECISION): BigDecimal {
        if (bd2.bigint === ZERO) {
            throw new Error("Division by zero is not allowed.");
        }

        // 1. Determine the predictable, final divex for the result.
        const targetDivex = Math.max(bd1.divex, bd2.divex, DEFAULT_PRECISION);

        // 2. Calculate the total shift needed for the dividend. This includes:
        //    - The shift to get to the target precision.
        //    - The extra "workingPrecision" to ensure accuracy during division.
        const shift = BigInt(targetDivex - bd1.divex + bd2.divex + workingPrecision);

        // 3. Scale the dividend up.
        const scaledDividend = bd1.bigint << shift;

        // 4. Perform the integer division. The result has `workingPrecision` extra bits.
        const quotient = scaledDividend / bd2.bigint;
        
        // 5. Round the result by shifting it back down by `workingPrecision`.
        //    We check the most significant bit of the part being discarded to round correctly.
        const roundingBit = (quotient >> BigInt(workingPrecision - 1)) & ONE;
        let finalQuotient = quotient >> BigInt(workingPrecision);
        if (roundingBit === ONE) finalQuotient++;
        
        // The watchExponent check is still useful as a final sanity check.
        watchExponent(targetDivex);

        return {
            bigint: finalQuotient,
            divex: targetDivex
        };
    },

    // Other...

    /**
     * Returns a new BigDecimal that is the absolute value of the provided BigDecimal.
     * @param bd - The BigDecimal.
     * @returns A new BigDecimal representing the absolute value.
     */
    abs(bd: BigDecimal): BigDecimal {
        // The sign is determined solely by the bigint.
        // The divex (scale) remains the same.
        // We return a new object and do not modify the original.
        return {
            bigint: bd.bigint < ZERO ? -bd.bigint : bd.bigint,
            divex: bd.divex
        };
    },

    // Castings...

    /**
     * Converts a BigDecimal to a BigInt, always rounding to the nearest integer.
     * This uses "round half up" (towards positive infinity).
     * For example, 2.5 becomes 3, and -2.5 becomes -2.
     * @param bd The BigDecimal to convert.
     * @returns The rounded BigInt value.
     */
    toBigInt(bd: BigDecimal): bigint {
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
    },

    /**
     * Converts a BigDecimal to a number (javascript double).
     * This conversion is lossy if the BigDecimal's precision exceeds that of a 64-bit float.
     * If the value exceeds Number.MAX_VALUE, it will correctly return Infinity or -Infinity.
     * @param bd - The BigDecimal to convert.
     * @returns The value as a standard javascript number.
     */
    toNumber(bd: BigDecimal): number {
        const divexBigInt = BigInt(bd.divex);

        // 1. Separate the integer part without losing any precision yet.
        const integerPart = bd.bigint >> divexBigInt;

        // 2. Isolate the fractional bits. This also works correctly for negative numbers.
        const fractionalPartShifted = bd.bigint - (integerPart << divexBigInt);
        // Alternative line, around 10-20% slower:
        // const fractionalPartShifted = bigintmath.getLeastSignificantBits(bd.bigint, divex_bigint)

        // 3. Convert the integer part to a number. This can become Infinity if it's too large.
        const numberResult = Number(integerPart);

        // If the integer part is already +/- Infinity, the fractional part is irrelevant.
        if (!Number.isFinite(numberResult)) return numberResult;
        
        // 4. Convert the fractional part to a number.
        // We use a MAXIMUM precision (1023 bits) to avoid overflow during this cast.
        const MAX_BITS_FOR_FRACTIONAL_CAST = MAX_DIVEX_BEFORE_INFINITY; // 1023
        let decimalPartAsNumber: number;
        let finalExponent: number = -bd.divex;

        if (bd.divex <= MAX_BITS_FOR_FRACTIONAL_CAST) {
            // The divex is small enough. A direct cast is safe, and won't become Infinite.
            decimalPartAsNumber = Number(fractionalPartShifted);
        } else {
            // The divex is too large, casting the fractional part would result in Infinity.
            // Truncate the LEAST significant bits of the
            // fractional part before casting to avoid an overflow.
            const shiftAmount = bd.divex - MAX_BITS_FOR_FRACTIONAL_CAST;
            decimalPartAsNumber = Number(fractionalPartShifted >> BigInt(shiftAmount));
            finalExponent += shiftAmount;
        }

        // 5. Scale the resulting number representation of the fractional part back down.
        const decimalResult = decimalPartAsNumber * (2 ** finalExponent);

        // 6. Return the final sum.
        return numberResult + decimalResult;
    },

    /**
     * Converts a BigDecimal to a string. This returns its EXACT value!
     * 
     * Note: Due to the nature of all binary fractions having power-of-2 denominators,
     * this string can make it appear as if they have more decimal digit precision than they actually do.
     * For example, 1/1024 = 0.0009765625, which at first glance *looks* like it has
     * 9 digits of decimal precision, but in all effectiveness it only has 3 digits of precision,
     * because a single increment to 2/1024 now yields 0.001953125, which changed **every single** digit!
     * The effective decimal digits can be calculated using MathBigDec.getEffectiveDecimalPlaces().
     * @param bd The BigDecimal to convert.
     * @returns The string with the exact value.
     */
    toString(bd: BigDecimal): string {
        if (bd.bigint === ZERO) return '0';
        if (bd.divex === 0) return bd.bigint.toString();

        const isNegative = bd.bigint < ZERO;
        // Use the absolute value for all calculations and add the sign back at the end.
        const absBigInt = isNegative ? -bd.bigint : bd.bigint;
        const divexBigInt = BigInt(bd.divex);

        // 1. Calculate all digits together by scaling with 10^divex.
        const allDigits = (absBigInt * (TEN ** divexBigInt)) >> divexBigInt;

        // 2. Pad the resulting string with leading zeros to ensure it's long enough
        // to place the decimal point correctly. Adding 1 handles numbers < 1.
        const fullString = allDigits.toString().padStart(bd.divex + 1, '0');

        // 3. Insert the decimal point.
        const dotIndex = fullString.length - bd.divex;
        let result = fullString.slice(0, dotIndex) + '.' + fullString.slice(dotIndex);

        // 4. Trim unnecessary trailing zeros from the fractional part.
        result = result.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '');

        // 5. Add the negative sign if needed and return.
        return isNegative ? '-' + result : result;
    },

    /**
     * Returns the BigDecimal's `bigint` property in binary form, **exactly** like how computers store them,
     * in two's complement notation. Negative values have all their bits flipped, and then added 1.
     * To multiply by -1, reverse all the bits, and add 1. This works both ways.
     * 
     * For readability, if the number is negative, a space will be added after the leading '1' sign.
     * @param bd - The BigDecimal
     * @returns The binary string. If it is negative, the leading `1` sign will have a space after it for readability.
     */
    toDebugBinaryString(bd: BigDecimal): string {
        return bigintmath.toDebugBinaryString(bd.bigint);
    },

    clone(bd: BigDecimal): void {

    },

    // Rounding & Truncating...

    /**
     * Rounds a given BigDecimal to the desired divex level.
     * If round is false, this truncates instead. But if the provided divex is higher than the existing divex, no truncating will occur.
     * @param bd - The BigDecimal
     * @param divex - The desired divex
     * @param round - Whether or not to round instead of truncating.
     */
    setExponent(bd: BigDecimal, divex: number, round: boolean = true): void {
        if (divex < 0) throw new Error(`Cannot set divex of BigDecimal below 0! Received: ${divex}`)
        watchExponent(divex); // Protects the divex from running away to Infinity.
        const difference: number = bd.divex - divex;

        let roundUp: boolean = false;
        if (round && difference > 0) { // Only round if we're shifting right.
            // What is the bit's positition we need to round up if it's a '1'?
            const bitPosition: number = difference;
            roundUp = bigintmath.getBitAtPositionFromRight(bd.bigint, bitPosition) === 1
        }
        
        bd.bigint >>= BigInt(difference);
        if (roundUp) bd.bigint++;
        bd.divex = divex;
    },

    /**
     * TO BE WRITTEN...
     * 
     * Rounds the BigDecimal towards positive Infinity.
     * @param bd - The BigDecimal
     */
    ceil(bd: BigDecimal): void {

    },

    /**
     * TO BE WRITTEN...
     * 
     * Rounds the BigDecimal towards negative Infinity.
     * @param bd - The BigDecimal
     */
    floor(bd: BigDecimal): void {

    },

    /**
     * TO BE WRITTEN...
     * 
     * Rounds the BigDecimal away from zero.
     * @param bd - The BigDecimal
     */
    roundUp(bd: BigDecimal): void {

    },

    /**
     * TO BE WRITTEN...
     * 
     * Rounds the BigDecimal towards zero.
     * @param bd - The BigDecimal
     */
    roundDown(bd: BigDecimal): void {

    },
    
    // Comparisons...

    /**
     * TO BE WRITTEN...
     * 
     * Detects if the provided BigDecimals are equal.
     * To do this, it first tries to convert them into the same divex level,
     * because BigDecimals of different divex levels may still be equal,
     * so it's not enough to compare their `bigint` properties.
     * @param bd1 - BigDecimal1
     * @param bd2 - BigDecimal2
     * @returns *true* if they are equal
     */
    areEqual(bd1: BigDecimal, bd2: BigDecimal): void {

    },

    isGreaterThan(bd1: BigDecimal, bd2: BigDecimal): void {

    },

    isGreaterThanOrEqualTo(bd1: BigDecimal, bd2: BigDecimal): void {

    },

    isLessThan(bd1: BigDecimal, bd2: BigDecimal): void {

    },

    isLessThanOrEqualTo(bd1: BigDecimal, bd2: BigDecimal): void {

    },

    isInteger(bd: BigDecimal): void {

    },

    isNegative(bd: BigDecimal): void {

    },

    isPositive(bd: BigDecimal): void {

    },

    isZero(bd: BigDecimal): void {

    },

    // Miscellanious...

    /**
     * Returns the mimimum number of bits you need to get the specified digits of precision, rounding up.
     * 
     * For example, to have 3 decimal places of precision in a BigDecimal, or precision to the nearest thousandth,
     * call this function with precision `3`, and it will return `10` to use for the divex value of your BigDecimal, because 2^10 ≈ 1000
     * 
     * HOWEVER, it is recommended to add some constant amount of extra precision to retain accuracy!
     * 3.1 divex 4 ==> 3.125. Now even though 3.125 DOES round to 3.1,
     * performing our arithmetic with 3.125 will quickly divexiate inaccuracies!
     * If we added 30 extra bits of precision, then our 4 bits of precision
     * becomes 34 bits. 3.1 divex 34 ==> 3.099999999976717... which is a LOT closer to 3.1!
     * @param precision - The number of decimal places of precision you would like
     * @returns The minimum number of bits needed to obtain that precision, rounded up.
     */
    howManyBitsForDigitsOfPrecision(precision: number): number {
        const powerOfTen: number = 10**precision; // 3 ==> 1000
        // 2^x = powerOfTen. Solve for x
        const x: number = Math.log(powerOfTen) / LOG_TWO;
        return Math.ceil(x)
    },

    /**
     * Estimates the number of effective decimal place precision of a BigDecimal.
     * This is a little less than one-third of the divex, or the decimal bit-count precision.
     * @param bd - The BigDecimal
     * @returns The number of estimated effective decimal places.
     */
    getEffectiveDecimalPlaces(bd: BigDecimal): number {
        if (bd.divex <= MAX_DIVEX_BEFORE_INFINITY) {
            const powerOfTwo: number = powersOfTwoList[bd.divex];
            const precision: number = Math.log10(powerOfTwo);
            return Math.floor(precision);
        } else {
            const powerOfTwo: bigint = getBigintPowerOfTwo(bd.divex)
            return bigintmath.log10(powerOfTwo);
        }
    },

    /**
     * Prints useful information about the BigDecimal, such as its properties,
     * binary string, exact value as a string, and converted back to a number.
     * @param bd - The BigDecimal
     */
    printInfo(bd: BigDecimal): void {
        console.log(bd)
        console.log(`Binary string: ${MathBigDec.toDebugBinaryString(bd)}`)
        // console.log(`Bit length: ${MathBigDec.getBitLength(bd)}`)
        console.log(`Converted to String: ${MathBigDec.toString(bd)}`); // This is also its EXACT value.
        console.log(`Converted to Number: ${MathBigDec.toNumber(bd)}`)
        console.log('----------------------------')
    },

    // /**
    //  * Calculates the number of bits used to store the `bigint` property of the BigDecimal.
    //  * @param bd - The BigDecimal
    //  * @returns The number of bits
    //  */
    // getBitLength(bd: BigDecimal): number {
    //     // Conveniently, converted to a string, two's complement notation
    //     // contains a - sign at the beginning for negatives,
    //     // subsequently in the computer, a '1' bit is used for the sign.
    //     // This means the bit length is still the same!
    //     return bd.bigint.toString(2).length;
    // }
};







////////////////////////////////////////////////////////////////////
// Testing
////////////////////////////////////////////////////////////////////


const n1: string = '1.11223344';
const bd1: BigDecimal = NewBigDecimal_FromString(n1);
console.log(`${n1} converted into a BigDecimal:`)
MathBigDec.printInfo(bd1)


// (function speedTest_Miscellanious() {

//     const repeat = 10**6;
//     let product;
    
//     console.time('No round');
//     for (let i = 0; i < repeat; i++) {
//         product = MathBigDec.multiply(bd1, bd2, 9);
//     }
//     console.timeEnd('No round');
//     MathBigDec.printInfo(product);
    
//     console.time('Round');
//     for (let i = 0; i < repeat; i++) {
//         product = MathBigDec.multiply(bd1, bd2, 7);
//     }
//     console.timeEnd('Round');
//     MathBigDec.printInfo(product);
// })();





// For testing with other libraries. You may need to install the types:
// npm install --save-dev @types/decimal.js @types/bignumber.js
// import Decimal from 'decimal.js';
// import BigNumber from 'bignumber.js';

// (function speedTest_Multiply() {

//     const factor1: number = 17.111222333444;
//     const factor2: number = 5.55;

//     const bitsOfPrecision: number = 50
//     const f1: BigDecimal = new BigDecimal(factor1, bitsOfPrecision);
//     const f2: BigDecimal = new BigDecimal(factor2, bitsOfPrecision);

//     console.log(`\nMultiplying factors ${factor1} and ${factor2} together...`)
//     console.log(`Expected results: ${factor1 * factor2}\n`)
    
//     const loopCount: number = 10**6;
//     let product: any;
    
//     // This BigDecimal library
//     console.time('BigDecimal')
//     for (let i = 0; i < loopCount; i++) {
//         product = MathBigDec.multiply(f1, f2);
//     }
//     console.timeEnd('BigDecimal')
//     console.log(`BigDecimal product: ${MathBigDec.toString(product)}`)
//     console.log(`Bits of precision used: ${product.divex}`)
//     console.log(`Approximate digits of precision used: ${MathBigDec.getEffectiveDecimalPlaces(product)}`)
//     console.log('')
    
    
//     // Decimal libarary
//     const d1: Decimal = new Decimal(factor1);
//     const d2: Decimal = new Decimal(factor2);
//     console.time('Decimal')
//     for (let i = 0; i < loopCount; i++) {
//         product = d1.times(d2);
//     }
//     console.timeEnd('Decimal')
//     console.log(`Decimal product: ${product.toString()}`)
//     console.log(`Decimal digits of precision used: ${product.precision()}`)
//     console.log('')
    
    
//     // BigNumber library
//     const b1: BigNumber = new BigNumber(factor1);
//     const b2: BigNumber = new BigNumber(factor2);
//     console.time('BigNumber')
//     for (let i = 0; i < loopCount; i++) {
//         product = b1.times(b2);
//     }
//     console.timeEnd('BigNumber')
//     console.log(`BigNumber product: ${product.toString()}`)
//     console.log(`BigNumber digits of precision used: ${product.precision()}`)
// })();
