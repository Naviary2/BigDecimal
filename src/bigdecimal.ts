
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




import bimath from './bimath';



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
// than MAX_VALUE or equal to Infinity, because 2^1024 === Infinity.
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

    numberAsBigInt *= getBigintPowerOfTwo(divex);

    // Now we undo the multiplication by 10^n we did earlier.
    let bigint: bigint = numberAsBigInt / powerOfTen

    // If this is zero, we can represent this number perfectly with a lower divex!
    const difference: bigint = numberAsBigInt - (bigint * powerOfTen)
    if (difference === ZERO) {
        // The different in number of digits is the number of
        // bits we need to represent this number exactly!!
        const newExponent: number = `${numberAsBigInt}`.length - `${bigint}`.length;
        const divexDifferent: number = divex - newExponent
        bigint /= getBigintPowerOfTwo(divexDifferent)
        divex = newExponent;
    }

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
        bigint: num *= getBigintPowerOfTwo(precision),
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
			// Case B (THE FIX): The decimal point lands within the fractional digits.
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



/** 
 * Math and arithmetic methods performed on BigDecimals 
 * 
 * TODO: Move many of these into the BigDecimal class.
 * */
const MathBigDec = {

    // Addition...

    add(bd1: BigDecimal, bd2: BigDecimal): void {

    },

    // Subtraction...

    subtract(bd1: BigDecimal, bd2: BigDecimal): void {

    },

    // Multiplication...

    /**
     * Multiplies two BigDecimal numbers.
     * @param bd1 - Factor1
     * @param bd2 - Factor2
     * @param mode - The mode for determining the new divex property.
     * - `0` is the default and will use the maximum divex of the 2 factors.
     * - `1` will use the sum of the factors divexs. This yields 100% accuracy (no truncating), but requires more storage, and more compute for future operations. This can also make the divex run away to infinity if used repeatedly.
     * - `2` will use the minimum divex of the 2 factors. This yields the least accuracy, truncating a lot, but it is the fastest!
     * @returns The product of BigDecimal1 and BigDecimal2.
     */
    multiply(bd1: BigDecimal, bd2: BigDecimal, mode: 0 | 1 | 2 = 0): BigDecimal {
        const divex: number = mode === 0 ? Math.max(bd1.divex, bd2.divex) // Max
                       : mode === 1      ? bd1.divex + bd2.divex          // Add
                       : /* mode === 2 */  Math.min(bd1.divex, bd2.divex) // Min

        const rawProduct: bigint = bd1.bigint * bd2.bigint;
        const newExponent: number = bd1.divex + bd2.divex;
    
        const divexDifference: number = newExponent - divex;
    
        // Bit shift the rawProduct by the divex difference to reach the desired divex level
        const product: bigint = rawProduct >> BigInt(divexDifference);
    
        // Create and return a new BigDecimal object with the adjusted product and the desired divex
        // TODO: Pass in a custom precision property, or maximum divex!

        return {
            bigint: product,
            divex,
        };
    },

    // Division...

    divide(bd1: BigDecimal, bd2: BigDecimal): void {

    },

    mod(bd1: BigDecimal, bd2: BigDecimal): void {

    },

    // Exponent...

    squared(bd: BigDecimal): void {

    },

    cubed(bd: BigDecimal): void {

    },

    pow(bd: BigDecimal, exp: number): void {

    },

    // Root...

    squareRoot(bd: BigDecimal): void {

    },

    cubeRoot(bd: BigDecimal): void {

    },

    root(bd: BigDecimal, root: number): void {

    },

    // Logarithm...

    log2(bd: BigDecimal): void {

    },

    // Natural logarithm
    logE(bd: BigDecimal): void {

    },

    log10(bd: BigDecimal): void {

    },

    logN(bd: BigDecimal, n: number): void {

    },

    // Other...

    /**
     * Returns a new BigDecimal that is the absolute value of the provided BigDecimal
     * @param bd - The BigDecimal
     * @returns The absolute value
     */
    abs(bd: BigDecimal): void {

    },

    /**
     * Negates the provided BigDecimal, modifying the original.
     * @param bd - The BigDecimal
     * @returns The negated BigDecimal
     */
    negate(bd: BigDecimal): void {
        bd.bigint *= NEGONE;
    },

    // Castings...

    /**
     * Converts a BigDecimal to a BigInt, rounding to the nearest integer by default.
     * @param bd - The BigDecimal
     * @param round - If *true*, it will round to the nearest BigInt. If *false*, it will truncate the decimal value, rounding in the negative direction. Default: *true*
     * @returns The BigInt
     */
    toBigInt(bd: BigDecimal, round: boolean = true): bigint {
        const divex_bigint: bigint = BigInt(bd.divex);
    
        // Bit shift to the right to get the integer part. This truncates any decimal information.
        let integerPart: bigint = bd.bigint >> divex_bigint;
    
        if (!round || bd.divex === 0) return integerPart;
    
        // We are rounding the decimal digits!
        // To round in binary is easy. If the first digit (or most-significant digit)
        // of the decimal portion is a 1, we round up! If it's 0, we round down.

        const bitAtPosition: 1 | 0 = bimath.getBitAtPositionFromRight(bd.bigint, bd.divex)
        if (bitAtPosition === 1) integerPart++;
        return integerPart;
    },

    /**
     * Converts a BigDecimal to a number (javascript double).
     * If it's greater than Number.MAX_VALUE, this will return Infinity or -Infinity likewise.
     * @param bd - The BigDecimal
     * @returns The number as a normal javascript double
     */
    toNumber(bd: BigDecimal): number {
        const divex_bigint: bigint = BigInt(bd.divex);
    
        // Extract the BigInt portion out of the BigDecimal
        const integerPart: bigint = bd.bigint >> divex_bigint;
    
        let number: number = Number(integerPart);
    
        // Fetch only the bits containing the decimal part of the number
        let decimalPartShifted: bigint = bd.bigint - (integerPart << divex_bigint);
        // Alternative line, around 10-20% slower:
        // const decimalPartShifted = MathBigInt.getLeastSignificantBits(bd.bigint, divex_bigint)
    
        // Convert to a number
    
        let powerOf2ToUse: number = powersOfTwoList[bd.divex];
    
        // Is the decimal portion SO BIG that casting it to a Number
        // would immediately make it Infinity? Accomodate for this scenario.
        if (bd.divex > MAX_DIVEX_BEFORE_INFINITY) {
    
            powerOf2ToUse = powersOfTwoList[MAX_DIVEX_BEFORE_INFINITY];
    
            // How much should be right-shifted or truncated from the decimal part
            // so that the resulting Number cast is below MAX_VALUE?
            
            // I only want to extract the most-significant 1023 bits of the decimal portion!
            // All I need to do is right shift some more!
            const remainingShiftNeeded: number = bd.divex - MAX_DIVEX_BEFORE_INFINITY;
            decimalPartShifted >>= BigInt(remainingShiftNeeded);
        }
    
        let decimal: number = Number(decimalPartShifted);
    
        // Simulate unshifting it by dividing by a power of 2
        decimal = decimal / powerOf2ToUse;
    
        return number + decimal;
    },

    /**
     * Converts a BigDecimal to a string. This returns its EXACT value!
     * Using this string to construct a new BigDecimal will always result in a BigDecimal with the same value.
     * 
     * Note: Due to the nature of all binary fractions having power-of-2 denominators,
     * this string can make it appear as if they have more decimal digit precision than they actually do.
     * For example, 1/1024 = 0.0009765625, which at first glance *looks* like it has
     * 9 digits of decimal precision, but in all effectiveness it only has 3 digits of precision,
     * because a single increment to 2/1024 now yields 0.001953125, which changed **every single** digit!
     * The effective decimal digits can be calculated using MathBigDec.getEffectiveDecimalPlaces().
     * @param bd - The BigDecimal
     * @returns The string with the exact value
     */
    toString(bd: BigDecimal): string {
        if (bd.bigint === ZERO) return '0';
        const isNegative: boolean = bd.bigint < ZERO;
    
        const powerOfTenToMultiply: bigint = TEN**BigInt(bd.divex);
    
        // This makes the number LARGE enough so that when we divide by a
        // power of 2, there won't be any division overflow.
        const largenedNumber: bigint = bd.bigint * powerOfTenToMultiply
    
        const dividedNumber: bigint = largenedNumber / getBigintPowerOfTwo(bd.divex);
        let string: string = `${dividedNumber}`
    
        if (bd.divex === 0) return string; // Integer
    
        // Modify the string because it has a decimal value...
    
        // Make sure leading zeros aren't left out of the beginning
        const integerPortion: bigint = bd.bigint >> BigInt(bd.divex);
        if (integerPortion === ZERO || integerPortion === NEGONE) {
            let missingZeros: number = bd.divex - string.length;
            if (isNegative) missingZeros++;
            if (missingZeros > 0) string = isNegative ? '-' + '0'.repeat(missingZeros) + string.slice(1)
                                                      : '0'.repeat(missingZeros) + string;
        }
    
        // Insert the decimal point at position 'divex' from the right side
        string = insertDotAtIndexFromRight(string, bd.divex);
        string = trimTrailingZeros(string);
    
        // If the integer portion is 0, apphend that to the start! For example, '.75' => '0.75'
        it: if (integerPortion === ZERO || integerPortion === NEGONE) {
            if (string.startsWith('-1')) break it; // One-off case that creates a bug if this isn't here. Happens when BigDecimal is -1 and divex is > 0.
            if (string.startsWith('-')) string = '-0' + string.slice(1); // '-.75' => '-0.75'
            else string = '0' + string; // '.75' => '0.75'
        }
    
        // Remove the dot if there's nothing after it. For example, '1.' => '1'
        if (string.endsWith('.')) string = string.slice(0, -1)
        
        return string;

        // Functions...

        /** Inserts a `.` at the specified index from the right side of the string. */
        function insertDotAtIndexFromRight(string: string, index: number): string {
            const leftPart: string = string.slice(0, string.length - index);
            const rightPart: string = string.slice(string.length - index);
            return leftPart + '.' + rightPart
        }
        
        /** Trims any '0's off the end of the provided string. */
        function trimTrailingZeros(string: string): string {
            let i: number = string.length - 1;
            while (i >= 0 && string[i] === '0') {
                i--;
            }
            return string.slice(0, i + 1);
        }
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
        return bimath.toDebugBinaryString(bd.bigint);
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
            roundUp = bimath.getBitAtPositionFromRight(bd.bigint, bitPosition) === 1
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
            return bimath.log10(powerOfTwo);
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
