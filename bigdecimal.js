
/**
 * bigdecimal.js v0.1.2 Beta
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
 * - Move most of the MathBigDec functions into the BigDecimal class as static methods.
 * After this we could, for example, do mybigdecimal.multiply(bigdecfactor2)
 * to modify the bigdecimal we called .multiply() on.
 * 
 * - Decide how we want to handle the precision when you pass in a string for the BigDecimal.
 * For example, if 1.111222333444555666777888999 is passed in, should the precision be a set
 * 50 bits, or should the precision be 50 bits *more* than the minimum amount of bits to round
 * to that value? And if the precision is always constant, how would we handle repeated division
 * when the number gets smaller and smaller? It would eventually truncate to zero. Do we need a
 * way to dynamically increase the precision when the number gets smaller and smaller?
 * 
 * - Can a faster toBinary() method be written that uses toString(2)
 * instead of iterating through every bit in the bigint?
 * 
 * - Finish writing all remaining arithmetic methods of MathBigDec!
 * 
 */

"use strict";

// Useful Number constants
const LOG_TWO = Math.log(2);

// Usefule BigInt constants
const NEGONE = -1n;
const ZERO = 0n;
const ONE = 1n;
const TWO = 2n;
const TEN = 10n;

// The minimum number of bits used to store decimal bits in BigDecimals.
// Without a minimum precision, small numbers parsed into BigDecimals would lose some precision.
// For example, 3.1 exponent 4 ==> 3.125. Now even though 3.125 DOES round to 3.1,
// it means we'll very quickly lose a lot of accuracy when performing arithmetic!
// The user expects that, when they pass in 3.1, the resulting BigDecimal should be AS CLOSE to 3.1 as possible!!
// With a DEFAULT_PRECISION of 50 bits, 3.1 exponent 50 ==> 3.10000000000000142, which is A LOT closer to 3.1!
// I arbitrarily chose 50 bits for the minimum, because that gives us about 15 digits of precision,
// which is about how much javascript's doubles give us.
// TODO: If a BigDecimal's EXACT value can be represented with *less* bits, then modify it to use less!
// For example, integers, or fractions with power-of-2-denominators like 0.5, 0.25, 0.375, etc.
// can use less bits to represent the exact value.
const DEFAULT_PRECISION = 50; // Default: 50

/**
 * The maximum exponent a BigDecimal is allowed to have.
 * Beyond this, the exponent is assumed to be running away towards Infinity, so an error is thrown.
 */
const MAX_EXPONENT = 1e5; // Default: 1e5 (100,000)

/** A list of powers of 2, 1024 in length, starting at 1 and stopping before Number.MAX_VALUE. This goes up to 2^1023. */
const powersOfTwoList = (() => {
    const powersOfTwo = [];
    let currentPower = 1
    while (currentPower < Number.MAX_VALUE) {
        powersOfTwo.push(currentPower)
        currentPower *= 2;
    }
    return powersOfTwo;
})();

// Any exponent greater than 1023 can lead to Number casts greater
// than MAX_VALUE or equal to Infinity, because 2^1024 === Infinity.
// BigDecimals with exponents THAT big need special care!
const MAX_EXPONENT_BEFORE_INFINITY = powersOfTwoList.length - 1; // 1023

/**
 * Returns the specified bigint power of 2 when called.
 * This has a dynamic internal list that, when a power of 2 is requested that is does not have,
 * it will calculate more powers of 2 up to the requested power!
 * @param {number} power - The power of 2 to retrieve
 * @returns {bigint} The bigint power of 2 requested
 */
const getBigintPowerOfTwo = (function() {

    // Initiate the list
    const powersOfTwo = []
    let currentPower = ONE
    const MAX_VALUE = BigInt(Number.MAX_VALUE)
    while (currentPower < MAX_VALUE) {
        powersOfTwo.push(currentPower)
        currentPower <<= ONE;
    }

    // Adds more powers of 2 until we reach the provided power
    function addMorePowers(powerCap) {
        console.log(`Adding more bigint powers of 2, up to 2^${powerCap}!`)
        for (let i = powersOfTwo.length - 1; i <= powerCap - 1; i++) {
            const thisPower = powersOfTwo[i];
            powersOfTwo[i+1] = thisPower << ONE;
        }
    }

    // Return a function that, when called, returns the specified power of 2
    return (power) => {
        // Do we have enough powers of two in store?
        if (power > powersOfTwo.length - 1) addMorePowers(power);
        return powersOfTwo[power];
    }
})()

// /**
//  * DEPRICATED. Old constructor method.
//  * 
//  * Creates a BigDecimal that is equal to the provided number and has the specified exponent level.
//  * If the exponent is not provided, DEFAULT_PRECISION is used, providing about 15 decimal places of precision.
//  * 
//  * @param {bigint | string | number} number - The true value of the BigDecimal
//  * @param {number | undefined} [exponent] - Optional. The desired exponent, or precision for the BigDecimal. 0+, where 0 is integer-level precision. If left undefined, DEFAULT_PRECISION will be used.
//  * @returns {BigDecimalClass} - The BigDecimal
//  */
// function BigDecimal(number, exponent) {
//     if (typeof number !== 'number' || Number.isInteger(number)) { // An integer was passed in...

//         if (typeof number !== 'bigint') number = BigInt(number)
//         if (exponent == null) exponent = 0; // Integer precision
    
//         number <<= BigInt(exponent);

//         return newBigDecimalFromProperties(number, exponent);
//     }

//     // A number primitive with decimals was passed in...

//     // Auto-sets the exponent level if not specified
//     exponent = validateExponent(number, exponent);

//     // Separate the integer and decimal parts of the number
//     const { integer, decimal } = getIntegerAndDecimalParts_FromNumber(number);

//     // The number has to be bit-shifted according to the desired exponent level
//     number = BigInt(integer)
//     number <<= BigInt(exponent);

//     // What is the decimal part bit shifted?...

//     let powerOf2ToUse = powersOfTwoList[exponent];

//     // Is the exponent SO LARGE that bit shifting the Number before casting
//     // to a BigInt would make it Infinity? Accomodate for this scenario.
//     let extraToShiftLeft = 0;
//     if (exponent > MAX_EXPONENT_BEFORE_INFINITY) {
//         powerOf2ToUse = powersOfTwoList[MAX_EXPONENT_BEFORE_INFINITY];
//         extraToShiftLeft = exponent - MAX_EXPONENT_BEFORE_INFINITY;
//     }

//     // Javascript doubles don't have a native bit shift operation
//     // Because of this, we multiply by powers of 2 to simulate bit shifting!
//     const shiftedDecimal = decimal * powerOf2ToUse; // Same as decimal * 2**exponent
    
//     const roundedDecimal = Math.round(shiftedDecimal)
//     let decimalPart = BigInt(roundedDecimal);

//     if (extraToShiftLeft > 0) decimalPart <<= BigInt(extraToShiftLeft);

//     // Finally, add the decimal part to the number
//     number += decimalPart;

//     return newBigDecimalFromProperties(number, exponent);
// }

// /**
//  * DEPRICATED. Used by old BigDecimal constructor.
//  * 
//  * Use this BigDecimal constructor when you already know the `number` and `exponent` properties of the BigDecimal.
//  * @param {bigint} number - The `number` property
//  * @param {number} exponent - The `exponent` property
//  */
// function newBigDecimalFromProperties(number, exponent) {
//     watchExponent(exponent); // Protects the exponent from running away to Infinity.
//     return { number, exponent }
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



/**
 * Each BigDecimal contains the properties:
 * - `bigint` (BigInt)
 * - `exponent` (Number)
 * - `precision` (Number)
 */
class BigDecimal {

    bigint;
    exponent;
    /** The maximum exponent allowed. */
    precision;

    /**
     * The BigDecimal constructor. Creates a BigDecimal that is equal to the provided number.
     * @param {number | bigint | string} number - The desired value.
     * @param {number} precision - The maximum exponent allowed.
     * @param {bigint} [bigint] The bigint property, if already known. Either this or `number` must be provided.
     * @param {number} [exponent] The exponent property, if already known. Must be provided if `bigint` is provided.
     */
    constructor(number, precision = DEFAULT_PRECISION, bigint, exponent) {
        if (number != null) {
            if (bigint != null || exponent != null) throw new Error("You must choose between specifying the number, or bigint & exponent parameters.")
            const type = typeof number;
            if (type === 'number') {
                if (!isFinite(number)) throw new Error(`Cannot create a BigDecimal from Infinity!`)
            } else if (type !== 'bigint' && type !== 'string') throw new Error(`Invalid number type! Can be number, bigint, or string. Received: ${type}`)

            // Cast to string. Also converts OUT of scientific notation, and removes trailing decimal zeros.
            number = toDecimalString(number);

            const dotIndex = number.lastIndexOf('.');
            const dotIndexFromRight = dotIndex !== -1 ? number.length - dotIndex - 1 : 0; // 0-based from right
            const decimalDigitCount = dotIndexFromRight;

            // Set the exponent property to the specified precision.
            // If the number can be represented perfectly will a lower exponent,
            // this will be modified soon!
            let exponentProperty = precision;

            // Make the number an integer by multiplying by 10^n where n is the decimal digit count.
            const powerOfTen = TEN**BigInt(decimalDigitCount);
            // We can accomplish the same thing by just removing the dot instead.
            if (dotIndex !== -1) number = number.slice(0, dotIndex) + number.slice(dotIndex + 1)

            number = BigInt(number); // Cast to a bigint now

            number *= getBigintPowerOfTwo(exponentProperty)

            // Now we undo the multiplication by 10^n we did earlier.
            let bigintProperty = number / powerOfTen

            // If this is zero, we can represent this number perfectly with a lower exponent!
            const difference = number - (bigintProperty * powerOfTen)
            if (difference === ZERO) {
                // The different in number of digits is the number of
                // bits we need to represent this number exactly!!
                const newExponent = `${number}`.length - `${bigintProperty}`.length;
                const exponentDifferent = exponentProperty - newExponent
                bigintProperty /= getBigintPowerOfTwo(exponentDifferent)
                exponentProperty = newExponent;
            }

            this.bigint = bigintProperty;
            this.exponent = exponentProperty;

        } else if (bigint != null && exponent != null) {
            if (typeof bigint !== 'bigint') throw new Error(`Bigint property must be of type bigint! Received: ${typeof bigint}`)
            if (typeof exponent !== 'number') throw new Error(`Exponent property must be of type number! Received: ${typeof exponent}`)
            if (exponent < 0) throw new Error(`Exponent must not be below 0!`)
            else if (exponent > MAX_EXPONENT) throw new Error(`Exponent must not exceed ${MAX_EXPONENT}! Received: ${exponent}. If you need more range, please increase the MAX_EXPONENT variable.`)
            this.bigint = bigint;
            this.exponent = exponent;
        } else throw new Error(`You must choose between specifying the number, or bigint & exponent parameters.`)

        if (typeof precision !== 'number') throw new Error(`Precision property must be of type number! Received: ${typeof precision}`)
        if (precision < 0 || precision > MAX_EXPONENT) throw new Error(`Precision property must be between 0 and ${MAX_EXPONENT}! Received: ${precision}`)
        this.precision = precision;
    }
}

/**
 * Throws an error if the provided exponent is beyond `MAX_EXPONENT`.
 * It is assumed it's running away to Infinity.
 * @param {number} exponent - The `exponent` property of the BigDecimal
 */
function watchExponent(exponent)  {
    if (exponent > MAX_EXPONENT)
        throw new Error(`Cannot create a BigDecimal with exponent ${exponent}! Out of range. Max allowed: ${MAX_EXPONENT}. If you need more range, please increase the MAX_EXPONENT variable.`)
}

/**
 * Converts a number that may be in scientific (e) notation to decimal notation as a string.
 * Also removes trailing decimal zeros.
 * @param {number | string} num - The number to convert
 * @returns {string} The number in decimal format as a string
 */
function toDecimalString(num) {
    // Algorithm borrowed from jiggzson: https://gist.github.com/jiggzson/b5f489af9ad931e3d186 

    const nsign = Math.sign(num);
    num = Math.abs(num); // Remove the sign

    if (/\d+\.?\d*e[\+\-]*\d+/i.test(num)) { // Scientific notation, convert to decimal format...
        const zero = '0'
        const [coeff, exponent] = String(num).toLowerCase().split('e');
        let numZeros = Math.abs(exponent)
        const sign = exponent / numZeros
        const coeff_array = coeff.split('.');
        if (sign === -1) {
            numZeros = numZeros - coeff_array[0].length;
            if (numZeros < 0) num = coeff_array[0].slice(0, numZeros) + '.' + coeff_array[0].slice(numZeros) + (coeff_array.length === 2 ? coeff_array[1] : '');
            else num = zero + '.' + new Array(numZeros + 1).join(zero) + coeff_array.join('');
        } else { // sign is 0 or 1
            const dec = coeff_array[1];
            if (dec) numZeros = numZeros - dec.length;
            if (numZeros < 0) num = coeff_array[0] + dec.slice(0, numZeros) + '.' + dec.slice(numZeros);
            else num = coeff_array.join('') + new Array(numZeros + 1).join(zero);
        }
    }

    if (nsign < 0) return '-' + num;
    else return `${num}`;
}


/** Complex BigInt math functions */
const BigIntMath = {

    /**
     * Calculate the logarithm base 2 of the specified BigInt. Returns an integer.
     * @param {bigint} bigint - The BigInt. 0+
     * @returns {number} The logarithm to base 2
     */
    log2(bigint) {
        if (bigint < ZERO) return NaN;
        
        let result = ZERO;
        let tempNumber = bigint;
        
        while (tempNumber > ONE) {
            tempNumber >>= ONE;
            result++;
        }
        
        return result;
    },
    
    /**
    * Calculates the logarithm base 10 of the specified BigInt. Returns an integer.
    * @param {bigint} bigint - The BigInt. 0+
    * @returns {number} The logarithm to base 10
    */
    log10(bigint) {
        if (bigint <= ZERO) return NaN;
    
        let result = ZERO;
        let tempNumber = bigint;
    
        while (tempNumber >= TEN) {
            tempNumber /= TEN;
            result++;
        }
    
        return Number(result);
    },
   
    /**
     * Calculates the logarithm of the specified base of the BigInt. Returns an integer.
     * @param {bigint} bigint - The BigInt. 0+
     * @param {number} base - The base of the logarithm
     * @returns {number} The logarithm to base N
     */
    logN(bigint, base) {
        if (bigint < ZERO) return NaN;
    
        let result = ZERO;
        let tempNumber = bigint;
    
        while (tempNumber >= base) {
            tempNumber /= base;
            result++;
        }
    
        return result;
    },
    
    /**
     * Calculates the absolute value of a bigint
     * @param {bigint} bigint - The BigInt
     * @returns {bigint} The absolute value
     */
    abs(bigint) {
        return bigint < ZERO ? -bigint : bigint;
    },

    /**
     * Returns the specified number of least significant.
     * This can be used to extract only the decimal portion of a BigDecimal by passing in the exponent number for the count.
     * @param {bigint} bigint - The BigInt
     * @param {bigint} count - The number of bits to get
     * @returns {bigint} A BigInt containing only the specified bits
     */
    getLeastSignificantBits(bigint, count) {
        // Create a bitmask with the least significant n bits set to 1
        let bitmask = (ONE << count) - ONE; // If count is 5, this looks like: 11111

        // Apply bitwise AND operation with the bitmask to get the least significant bits
        let leastSignificantBits = bigint & bitmask;

        return leastSignificantBits;
    },

    /**
     * Gets the bit at the specified position from the right. 1-based
     * @param {bigint} bigint - The BigInt
     * @param {number} position - The position from right. 1-based
     * @returns {number} 1 or 0
     */
    getBitAtPositionFromRight(bigint, position) {
        // Guard clauses
        if (typeof bigint !== 'bigint') throw new Error(`bigint must be of bigint type! Received: ${typeof bigint}`)
        if (typeof position !== 'number') throw new Error(`Position must be of number type! Received: ${typeof position}`)
        if (position < 1) throw new Error(`Cannot get bit at position ${position}! Must be 1+.`)

        // Create a mask where there is a single 1 at the position.
        // For example, if our position is 5, the resulting bitmask is '10000'.
        let bitmask = ONE << (BigInt(position) - ONE);
        // Apply bitwise AND operation with the bitmask to test if this bit is a 1
        const result = bigint & bitmask;
        // If the result is greater than zero, we know the bit is a 1!
        return result > ZERO ? 1 : 0;
    },
}


/** 
 * Math and arithmetic methods performed on BigDecimals 
 * 
 * TODO: Move many of these into the BigDecimal class as static methods.
 * */
const MathBigDec = {

    // Addition...

    add() {

    },

    // Subtraction...

    subtract() {

    },

    // Multiplication...

    /**
     * Multiplies two BigDecimal numbers.
     * @param {BigDecimal} bd1 - Factor1
     * @param {BigDecimal} bd2 - Factor2
     * @param {number} [mode] - The mode for determining the new exponent property.
     * - `0` is the default and will use the maximum exponent of the 2 factors.
     * - `1` will use the sum of the factors exponents. This yields 100% accuracy (no tuncating), but requires more storage, and more compute for future operations.
     * - `2` will use the minimum exponent of the 2 factors. This yields the least accuracy, truncating a lot, but it is the fastest!
     * @returns {BigDecimal} The product of BigDecimal1 and BigDecimal2.
     */
    multiply(bd1, bd2, mode = 0) {
        const exponent = mode === 0     ? Math.max(bd1.exponent, bd2.exponent) // Max
                       : mode === 1     ? bd1.exponent + bd2.exponent          // Add
                       : /* mode === 2 */ Math.min(bd1.exponent, bd2.exponent) // Min

        const rawProduct = bd1.bigint * bd2.bigint;
        const newExponent = bd1.exponent + bd2.exponent;
    
        const exponentDifference = newExponent - exponent;
    
        // Bit shift the rawProduct by the exponent difference to reach the desired exponent level
        const product = rawProduct >> BigInt(exponentDifference);
    
        // Create and return a new BigDecimal object with the adjusted product and the desired exponent
        // TODO: Pass in a custom precision property, or maximum exponent!
        // Should this be the precision of the first bigdecimal parameter passed in?
        return new BigDecimal(undefined, undefined, product, exponent)
    },

    // Division...

    divide(bd1, bd2) {

    },

    mod(bd1, bd2) {

    },

    // Exponent...

    squared() {

    },

    cubed() {

    },

    pow() {

    },

    // Root...

    squareRoot(bd) {

    },

    cubeRoot(bd) {

    },

    root(bd, root) {

    },

    // Logarithm...

    log2() {

    },

    // Natural logarithm
    logE() {

    },

    log10() {

    },

    logN() {

    },

    // Other...

    /**
     * Returns a new BigDecimal that is the absolute value of the provided BigDecimal
     * @param {BigDecimalClass} bd - The BigDecimal
     * @returns {BigDecimalClass} The absolute value
     */
    abs(bd) {

    },

    /**
     * Negates the provided BigDecimal, modifying the original.
     * @param {BigDecimalClass} bd - The BigDecimal
     * @returns {BigDecimalClass} The negated BigDecimal
     */
    negate(bd) {
        bd.bigint *= NEGONE;
    },

    // Castings...

    /**
     * Converts a BigDecimal to a BigInt, rounding to the nearest integer by default.
     * @param {BigDecimalClass} bd - The BigDecimal
     * @param {boolean} [round] - If *true*, it will round to the nearest BigInt. If *false*, it will truncate the decimal value, rounding in the negative direction. Default: *true*
     * @returns {bigint} The BigInt
     */
    toBigInt(bd, round = true) {
        const exponent_bigint = BigInt(bd.exponent);
    
        // Bit shift to the right to get the integer part. This truncates any decimal information.
        let integerPart = bd.bigint >> exponent_bigint;
    
        if (!round || bd.exponent === 0) return integerPart;
    
        // We are rounding the decimal digits!
        // To round in binary is easy. If the first digit (or most-significant digit)
        // of the decimal portion is a 1, we round up! If it's 0, we round down.

        const bitAtPosition = BigIntMath.getBitAtPositionFromRight(bd.bigint, bd.exponent)
        // If the result is greater than zero, we know the bit is a 1! Round up.
        if (bitAtPosition === 1) integerPart++;
        return integerPart;
    },

    /**
     * Converts a BigDecimal to a number (javascript double).
     * If it's greater than Number.MAX_VALUE, this will return Infinity or -Infinity likewise.
     * @param {BigDecimalClass} bd - The BigDecimal
     * @returns {number} The number as a normal javascript double
     */
    toNumber(bd) {
        const exponent_bigint = BigInt(bd.exponent);
    
        // Extract the BigInt portion out of the BigDecimal
        const integerPart = bd.bigint >> exponent_bigint;
    
        let number = Number(integerPart);
    
        // Fetch only the bits containing the decimal part of the number
        let decimalPartShifted = bd.bigint - (integerPart << exponent_bigint);
        // Alternative line, around 10-20% slower:
        // const decimalPartShifted = MathBigInt.getLeastSignificantBits(bd.bigint, exponent_bigint)
    
        // Convert to a number
    
        let powerOf2ToUse = powersOfTwoList[bd.exponent];
    
        // Is the decimal portion SO BIG that casting it to a Number
        // would immediately make it Infinity? Accomodate for this scenario.
        if (bd.exponent > MAX_EXPONENT_BEFORE_INFINITY) {
    
            powerOf2ToUse = powersOfTwoList[MAX_EXPONENT_BEFORE_INFINITY];
    
            // How much should be right-shifted or truncated from the decimal part
            // so that the resulting Number cast is below MAX_VALUE?
            
            // I only want to extract the most-significant 1023 bits of the decimal portion!
            // All I need to do is right shift some more!
            const remainingShiftNeeded = bd.exponent - MAX_EXPONENT_BEFORE_INFINITY;
            decimalPartShifted >>= BigInt(remainingShiftNeeded);
        }
    
        let decimal = Number(decimalPartShifted)
    
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
     * @param {BigDecimalClass} bd - The BigDecimal
     * @returns {string} The string with the exact value
     */
    toString(bd) {
        if (bd.bigint === ZERO) return '0';
        const isNegative = bd.bigint < ZERO;
    
        const powerOfTenToMultiply = TEN**BigInt(bd.exponent);
    
        // This makes the number LARGE enough so that when we divide by a
        // power of 2, there won't be any division overflow.
        const largenedNumber = bd.bigint * powerOfTenToMultiply
    
        const dividedNumber = largenedNumber / getBigintPowerOfTwo(bd.exponent);
        let string = `${dividedNumber}`
    
        if (bd.exponent === 0) return string; // Integer
    
        // Modify the string because it has a decimal value...
    
        // Make sure leading zeros aren't left out of the beginning
        const integerPortion = bd.bigint >> BigInt(bd.exponent);
        if (integerPortion === ZERO || integerPortion === NEGONE) {
            let missingZeros = bd.exponent - string.length;
            if (isNegative) missingZeros++;
            if (missingZeros > 0) string = isNegative ? '-' + '0'.repeat(missingZeros) + string.slice(1)
                                                      : '0'.repeat(missingZeros) + string;
        }
    
        // Insert the decimal point at position 'exponent' from the right side
        string = insertDotAtIndexFromRight(string, bd.exponent);
        string = trimTrailingZeros(string);
    
        // If the integer portion is 0, apphend that to the start! For example, '.75' => '0.75'
        it: if (integerPortion === ZERO || integerPortion === NEGONE) {
            if (string.startsWith('-1')) break it; // One-off case that creates a bug if this isn't here. Happens when BigDecimal is -1 and exponent is > 0.
            if (string.startsWith('-')) string = '-0' + string.slice(1); // '-.75' => '-0.75'
            else string = '0' + string; // '.75' => '0.75'
        }
    
        // Remove the dot if there's nothing after it. For example, '1.' => '1'
        if (string.endsWith('.')) string = string.slice(0, -1)
        
        return string;

        // Functions...

        /** Inserts a `.` at the specified index from the right side of the string. */
        function insertDotAtIndexFromRight(string, index) {
            const leftPart = string.slice(0, string.length - index);
            const rightPart = string.slice(string.length - index);
            return leftPart + '.' + rightPart
        }
        
        /** Trims any '0's off the end of the provided string. */
        function trimTrailingZeros(string) {
            let i = string.length - 1;
            while (i >= 0 && string[i] === '0') {
                i--;
            }
            return string.slice(0, i + 1);
        }
    },

    /**
     * Returns the BigDecimal's `number` property in binary form, **exactly** like how computers store them,
     * in two's complement notation. Negative values have all their bits flipped, and then added 1.
     * To multiply by -1, reverse all the bits, and add 1. This works both ways.
     * 
     * For readability, if the number is negative, a space will be added after the leading '1' sign.
     * @param {BigDecimalClass} bd - The BigDecimal
     * @returns {string} The binary string. If it is negative, the leading `1` sign will have a space after it for readability.
     */
    toBinary(bd) {
        if (bd.bigint === ZERO) return '0';
        const isNegative = bd.bigint < ZERO;
    
        let binaryString = '';
    
        // This equation to calculate a bigint's bit-count, b = log_2(N) + 1, is snagged from:
        // https://math.stackexchange.com/questions/1416606/how-to-find-the-amount-of-binary-digits-in-a-decimal-number/1416817#1416817
        const bitCount = isNegative ? BigIntMath.log2(BigIntMath.abs(bd.bigint)) + TWO // Plus 2 to account for the sign bit
                     /* positive */ : BigIntMath.log2(           bd.bigint ) + ONE
        // Alternate method to calculate the bit count that first converts the number to two's complement notation:
        // const bitCount = bd.bigint.toString(2).length;
    
        // If the bit length is 5, the resulting mask would be '10000'
        let mask = ONE << (bitCount - ONE);
    
        while (mask !== ZERO) {
            // Apphend the bit at the mask position to the string...
            if ((bd.bigint & mask) === ZERO) binaryString += '0';
            else binaryString += '1';
            mask >>= ONE;
        }
    
        // If the number is negative, insert a space between the leading sign and the rest, for readability.
        if (isNegative) binaryString = binaryString[0] + ' ' + binaryString.slice(1)
    
        return binaryString;
    },

    clone(bd) {

    },

    // Rounding & Truncating...

    /**
     * Truncates a given BigDecimal to the desired exponent level.
     * If the provided exponent is higher than the existing exponent, no truncating will occur.
     * @param {BigDecimalClass} bd - The BigDecimal
     * @param {number} exponent - The desired exponent
     * @param {boolean} round - Whether or not to round instead of truncating.
     */
    setExponent(bd, exponent, round = true) {
        if (exponent < 0) throw new Error(`Cannot set exponent of BigDecimal below 0! Received: ${exponent}`)
        watchExponent(exponent); // Protects the exponent from running away to Infinity.
        const difference = bd.exponent - exponent;

        let roundUp = false;
        if (round && difference > 0) { // Only round if we're shifting right.
            // What is the bit's positition we need to round up if it's a '1'?
            const bitPosition = difference;
            roundUp = BigIntMath.getBitAtPositionFromRight(bd.bigint, bitPosition) === 1
        }
        
        bd.bigint >>= BigInt(difference);
        if (roundUp) bd.bigint++;
        bd.exponent = exponent;
    },

    /**
     * TO BE WRITTEN...
     * 
     * Rounds the BigDecimal towards positive Infinity.
     * @param {BigDecimalClass} bd - The BigDecimal
     */
    ceil(bd) {

    },

    /**
     * TO BE WRITTEN...
     * 
     * Rounds the BigDecimal towards negative Infinity.
     * @param {BigDecimalClass} bd - The BigDecimal
     */
    floor(bd) {

    },

    /**
     * TO BE WRITTEN...
     * 
     * Rounds the BigDecimal away from zero.
     * @param {BigDecimalClass} bd - The BigDecimal
     */
    roundUp(bd) {

    },

    /**
     * TO BE WRITTEN...
     * 
     * Rounds the BigDecimal towards zero.
     * @param {BigDecimalClass} bd - The BigDecimal
     */
    roundDown(bd) {

    },
    
    // Comparisons...

    /**
     * TO BE WRITTEN...
     * 
     * Detects of the provided BigDecimals are equal.
     * To do this, it first tries to convert them into the same exponent level,
     * because BigDecimals of different exponent levels may still be equal,
     * so it's not enough to compare their `number` properties.
     * @param {BigDecimalClass} bd1 - BigDecimal1
     * @param {BigDecimalClass} bd2 - BigDecimal2
     * @returns {boolean} *true* if they are equal
     */
    areEqual(bd1, bd2) {

    },

    isGreaterThan(bd1, bd2) {

    },

    isGreaterThanOrEqualTo(bd1, bd2) {

    },

    isLessThan(bd1, bd2) {

    },

    isLessThanOrEqualTo(bd1, bd2) {

    },

    isInteger(bd) {

    },

    isNegative(bd) {

    },

    isPositive(bd) {

    },

    isZero(bd) {

    },

    // Miscellanious...

    /**
     * Returns the mimimum number of bits you need to get the specified digits of precision, rounding up.
     * 
     * For example, to have 3 decimal places of precision in a BigDecimal, or precision to the nearest thousandth,
     * call this function with precision `3`, and it will return `10` to use for the exponent value of your BigDecimal, because 2^10 ≈ 1000
     * 
     * HOWEVER, it is recommended to add some constant amount of extra precision to retain accuracy!
     * 3.1 exponent 4 ==> 3.125. Now even though 3.125 DOES round to 3.1,
     * performing our arithmetic with 3.125 will quickly exponentiate inaccuracies!
     * If we added 30 extra bits of precision, then our 4 bits of precision
     * becomes 34 bits. 3.1 exponent 34 ==> 3.099999999976717... which is a LOT closer to 3.1!
     * @param {number} precision - The number of decimal places of precision you would like
     * @returns {number} The minimum number of bits needed to obtain that precision, rounded up.
     */
    howManyBitsForDigitsOfPrecision(precision) {
        const powerOfTen = 10**precision; // 3 ==> 1000
        // 2^x = powerOfTen. Solve for x
        const x = Math.log(powerOfTen) / LOG_TWO;
        return Math.ceil(x)
    },

    /**
     * Estimates the number of effective decimal place precision of a BigDecimal.
     * This is a little less than one-third of the exponent, or the decimal bit-count precision.
     * @param {BigDecimalClass} bd - The BigDecimal
     * @returns {number} The number of estimated effective decimal places.
     */
    getEffectiveDecimalPlaces(bd) {
        if (bd.exponent <= MAX_EXPONENT_BEFORE_INFINITY) {
            const powerOfTwo = powersOfTwoList[bd.exponent];
            const precision = Math.log10(powerOfTwo);
            return Math.floor(precision);
        } else {
            const powerOfTwo = getBigintPowerOfTwo(bd.exponent)
            return BigIntMath.log10(powerOfTwo);
        }
    },

    /**
     * Prints useful information about the BigDecimal, such as its properties,
     * binary string, exact value as a string, and converted back to a number.
     * @param {BigDecimalClass} bd - The BigDecimal
     */
    printInfo(bd) {
        console.log(bd)
        console.log(`Binary string: ${MathBigDec.toBinary(bd)}`)
        console.log(`Bit length: ${MathBigDec.getBitLength(bd)}`)
        console.log(`Converted to String: ${MathBigDec.toString(bd)}`); // This is also its EXACT value.
        console.log(`Converted to Number: ${MathBigDec.toNumber(bd)}`)
        console.log('----------------------------')
    },

    /**
     * Calculates the number of bits used to store the `number` property of the BigDecimal.
     * @param {BigDecimalClass} bd - The BigDecimal
     * @returns {number} The number of bits
     */
    getBitLength(bd) {
        // Conveniently, converted to a string, two's complement notation
        // contains a - sign at the beginning for negatives,
        // subsequently in the computer, a '1' bit is used for the sign.
        // This means the bit length is still the same!
        return bd.bigint.toString(2).length;
    }
};







////////////////////////////////////////////////////////////////////
// Testing
////////////////////////////////////////////////////////////////////


const n1 = '1.11223344';
const bd1 = new BigDecimal(n1); // 125 => 0625
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





const Decimal = require('decimal.js'); // Decimal libarary
// const Decimal = require('break_infinity.js') // Break_Infinity library
const BigNumber = require('bignumber.js'); // BigNumber library

// (function speedTest_Multiply() {

//     const factor1 = 17.111222333444;
//     const factor2 = 5.55;

//     const bitsOfPrecision = 50
//     const f1 = new BigDecimal(factor1, bitsOfPrecision);
//     const f2 = new BigDecimal(factor2, bitsOfPrecision);

//     console.log(`\nMultiplying factors ${factor1} and ${factor2} together...`)
//     console.log(`Expected results: ${factor1 * factor2}\n`)
    
//     const loopCount = 10**6;
//     let product;
    
//     // This BigDecimal library
//     console.time('BigDecimal')
//     for (let i = 0; i < loopCount; i++) {
//         product = MathBigDec.multiply(f1, f2);
//     }
//     console.timeEnd('BigDecimal')
//     console.log(`BigDecimal product: ${MathBigDec.toString(product)}`)
//     console.log(`Bits of precision used: ${product.exponent}`)
//     console.log(`Approximate digits of precision used: ${MathBigDec.getEffectiveDecimalPlaces(product)}`)
//     console.log('')
    
    
//     // Decimal libarary
//     const d1 = new Decimal(factor1);
//     const d2 = new Decimal(factor2);
//     console.time('Decimal')
//     for (let i = 0; i < loopCount; i++) {
//         product = d1.times(d2);
//     }
//     console.timeEnd('Decimal')
//     console.log(`Decimal product: ${product.toString()}`)
//     console.log(`Decimal digits of precision used: ${product.precision()}`)
//     console.log('')
    
    
//     // BigNumber library
//     const b1 = new BigNumber(factor1);
//     const b2 = new BigNumber(factor2);
//     console.time('BigNumber')
//     for (let i = 0; i < loopCount; i++) {
//         product = b1.times(b2);
//     }
//     console.timeEnd('BigNumber')
//     console.log(`BigNumber product: ${product.toString()}`)
//     console.log(`BigNumber digits of precision used: ${product.precision()}`)
// })();
