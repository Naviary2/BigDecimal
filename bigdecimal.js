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
// With a MIN_PRECISION of 50 bits, 3.1 exponent 50 ==> 3.10000000000000142, which is A LOT closer to 3.1!
// I arbitrarily chose 50 bits for the minimum, because that gives us about 15 digits of precision,
// which is about how much javascript's doubles give us.
// TODO: If a BigDecimal's EXACT value can be represented with *less* bits, then modify it to use less!
// For example, integers, or fractions with power-of-2-denominators like 0.5, 0.25, 0.375, etc.
// can use less bits to represent the exact value.
const MIN_PRECISION = 50; // Default: 50

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



/** Complex BigInt math functions */
const MathBigInt = {

    /**
     * Calculate the logarithm base 2 of the specified BigInt. Returns an integer.
     * @param {bigint} bigint - The BigInt
     * @returns {number} The logarithm
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
     * Calculates the logarithm of the specified base of the BigInt. Returns an integer.
     * @param {bigint} bigint - The BigInt. 0+
     * @param {number} base - The base of the logarithm
     * @returns {number} The logarithm
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
    }
}



/**
 * Each BigDecimal contains the properties:
 * - `number` (BigInt)
 * - `exponent` (Number)
 */
class BigDecimalClass {
    /** The exponent-bit-shifted value of the bigint */
    number;
    /** The exponent (Number) */
    exponent;
}

/**
 * Creates a BigDecimal that is equal to the provided number and has the specified exponent level.
 * If the exponent is not provided, MIN_PRECISION is used, providing about 15 decimal places of precision.
 * 
 * TODO: Allow passing in strings with decimals (only integer strings allowed right now).
 * You can completely invserse the BigDecimalToString() algorithm to do this.
 * @param {bigint | string | number} number - The true value of the BigDecimal
 * @param {number | undefined} [exponent] - Optional. The desired exponent, or precision for the BigDecimal. 0+, where 0 is integer-level precision. If left undefined, MIN_PRECISION will be used.
 * @returns {BigDecimalClass} - The BigDecimal
 */
function BigDecimal(number, exponent) {
    if (typeof number !== 'number' || Number.isInteger(number)) { // An integer was passed in...

        if (typeof number !== 'bigint') number = BigInt(number)
        if (exponent == null) exponent = 0; // Integer precision
    
        number <<= BigInt(exponent);
    
        return { number, exponent }
    }

    // A number primitive with decimals was passed in...

    // Auto-sets the exponent level if not specified
    exponent = validateExponent(number, exponent);

    // Separate the integer and decimal parts of the number
    const { integer, decimal } = getIntegerAndDecimalParts_FromNumber(number);

    // The number has to be bit-shifted according to the desired exponent level
    number = BigInt(integer)
    number <<= BigInt(exponent);

    // What is the decimal part bit shifted?...

    let powerOf2ToUse = powersOfTwoList[exponent];

    // Is the exponent SO LARGE that bit shifting the Number before casting
    // to a BigInt would make it Infinity? Accomodate for this scenario.
    let extraToShiftLeft = 0;
    if (exponent > MAX_EXPONENT_BEFORE_INFINITY) {
        powerOf2ToUse = powersOfTwoList[MAX_EXPONENT_BEFORE_INFINITY];
        extraToShiftLeft = exponent - MAX_EXPONENT_BEFORE_INFINITY;
    }

    // Javascript doubles don't have a native bit shift operation
    // Because of this, we multiply by powers of 2 to simulate bit shifting!
    const shiftedDecimal = decimal * powerOf2ToUse; // Same as decimal * 2**exponent
    
    const roundedDecimal = Math.round(shiftedDecimal)
    let decimalPart = BigInt(roundedDecimal);

    if (extraToShiftLeft > 0) decimalPart <<= BigInt(extraToShiftLeft);

    // Finally, add the decimal part to the number
    number += decimalPart;

    return { number, exponent }
}

/**
 * Called by BigDecimal(). If the provided exponent is not defined, this will return
 * the minimum exponent required to retain as much precision as is in the provided number.
 * @param {number} number - The number
 * @param {number | undefined} exponent - The exponent
 * @returns {number} The validated exponent. 0+
 */
function validateExponent(number, exponent) {
    if (exponent != null) {
        if (exponent < 0) { exponent = 0; console.error('Cannot create a BigDecimal with negative exponent value! Setting to 0.') }
        return exponent;
    }
    // Set the exponent automatically, based on how many
    // digits to the right of the decimal place it uses.
    const precisionOfNumber = howMuchPrecisionDoesNumberHave(number);
    const bitCountForPrecision = howManyBitsForDigitsOfPrecision(precisionOfNumber);
    if (bitCountForPrecision < MIN_PRECISION) return MIN_PRECISION;
    else return bitCountForPrecision;
}

/**
 * Prints useful information about the BigDecimal, such as its properties,
 * binary string, exact value as a string, and converted back to a number.
 * @param {BigDecimalClass} bigdecimal - The BigDecimal
 */
function printInfo(bigdecimal) {
    console.log(bigdecimal)
    const binaryString = getBinaryStringOfBigDecimal(bigdecimal);
    console.log(`Binary string: ${binaryString}`)
    console.log(`Bit length: ${binaryString.replace(/ /g, '').length}`)
    console.log(`Converted to String: ${BigDecimalToString(bigdecimal)}`); // This is also its EXACT value.
    console.log(`Converted to Number: ${BigDecimalToNumber(bigdecimal)}`)
    console.log('----------------------------')
}

/**
 * Returns the BigDecimal in binary form, exactly like how computers store them.
 * This is **not** two's compliment notation. Negative values have all their bits flipped, and then added 1.
 * 
 * For readability, if the number is negative, a space will be added after the leading '1' sign.
 * @param {BigDecimalClass} bigdecimal - The BigDecimal
 * @returns {string} The binary string. If it is negative, the leading `1` sign will have a space after it for readability.
 */
function getBinaryStringOfBigDecimal(bigdecimal) {
    if (bigdecimal.number === ZERO) return '0';
    const isNegative = bigdecimal.number < ZERO;

    let binaryString = '';

    // This equation to calculate a bigint's bit-count, b = log_2(N) + 1, is snagged from:
    // https://math.stackexchange.com/questions/1416606/how-to-find-the-amount-of-binary-digits-in-a-decimal-number/1416817#1416817
    const bitCount = isNegative ? MathBigInt.log2(MathBigInt.abs(bigdecimal.number)) + TWO // Plus 2 to account for the sign bit
                 /* positive */ : MathBigInt.log2(           bigdecimal.number ) + ONE
    // Alternate method to calculate the bit count that first converts the number to two's compliment form:
    // const bitCount = bigdecimal.number.toString(2).length;

    // If the bit length is 5, the resulting mask would be '10000'
    let mask = ONE << (bitCount - ONE);

    while (mask !== ZERO) {
        // Apphend the bit at the mask position to the string...
        if ((bigdecimal.number & mask) === ZERO) binaryString += '0';
        else binaryString += '1';
        mask >>= ONE;
    }

    // If the number is negative, insert a space between the leading sign and the rest, for readability.
    if (isNegative) binaryString = binaryString[0] + ' ' + binaryString.slice(1)

    return binaryString;
}

/**
 * Separates the number into its integer and decimal components.
 * This can be used during the process of converting it to a BigInt or BigDecimal
 * @param {number} number - The number
 * @returns {object} An object with 2 properties, `integer` and `decimal`.
 */
function getIntegerAndDecimalParts_FromNumber(number) {
    let integerPart = Math.trunc(number);
    let decimalPart = number - integerPart;
    return { integer: integerPart, decimal: decimalPart }
}

/**
 * Converts a BigDecimal to a BigInt, rounding to the nearest integer by default.
 * @param {BigDecimalClass} bigdecimal - The BigDecimal
 * @param {boolean} [round] - If *true*, it will round to the nearest BigInt. If *false*, it will truncate the decimal value, rounding in the negative direction. Default: *true*
 * @returns {bigint} The BigInt
 */
function BigDecimalToBigInt(bigdecimal, round = true) {
    const exponent_bigint = BigInt(bigdecimal.exponent);

    // Bit shift to the right to get the integer part. This truncates any decimal information.
    let integerPart = bigdecimal.number >> exponent_bigint;

    if (!round || bigdecimal.exponent === 0) return integerPart;

    // We are rounding the decimal digits!...

    // To round in binary is easy. If the first digit (or most-significant digit)
    // of the decimal portion is a 1, we round up! If it's 0, we round down.
    // Let's create a mask to find the value of the first decimal bit!

    // Create a mask where there is a single 1 at position 'exponent'.
    // For example, if our exponent is 5, the resulting bitmask is 10000.
    let bitmask = ONE << (exponent_bigint - ONE);

    // Apply bitwise AND operation with the bitmask to test if this bit is a 1
    const result = bigdecimal.number & bitmask;

    // If the result is greater than zero, we know the bit is a 1! Round up.
    if (result > ZERO) integerPart += ONE;
    return integerPart;
}

/**
 * Converts a BigDecimal to a number. If it's greater than Number.MAX_VALUE, this will return Infinity.
 * @param {BigDecimalClass} bigdecimal - The BigDecimal
 * @returns {number} The number
 */
function BigDecimalToNumber(bigdecimal) {
    const exponent_bigint = BigInt(bigdecimal.exponent);

    // Extract the BigInt portion out of the BigDecimal
    const integerPart = bigdecimal.number >> exponent_bigint;

    let number = Number(integerPart);

    // Fetch only the bits containing the decimal part of the number
    let decimalPartShifted = bigdecimal.number - (integerPart << exponent_bigint);
    // Alternative line, around 10-20% slower:
    // const decimalPartShifted = getLeastSignificantBits(bigdecimal.number, exponent_bigint)

    // Convert to a number

    let powerOf2ToUse = powersOfTwoList[bigdecimal.exponent];

    // Is the decimal portion SO BIG that casting it to a Number
    // would immediately make it Infinity? Accomodate for this scenario.
    if (bigdecimal.exponent > MAX_EXPONENT_BEFORE_INFINITY) {

        powerOf2ToUse = powersOfTwoList[MAX_EXPONENT_BEFORE_INFINITY];

        // How much should be right-shifted or truncated from the decimal part
        // so that the resulting Number cast is below MAX_VALUE?
        
        // I only want to extract the most-significant 1023 bits of the decimal portion!
        // All I need to do is right shift some more!
        const remainingShiftNeeded = bigdecimal.exponent - MAX_EXPONENT_BEFORE_INFINITY;
        decimalPartShifted >>= BigInt(remainingShiftNeeded);
    }

    let decimal = Number(decimalPartShifted)

    // Simulate unshifting it by dividing by a power of 2
    decimal = decimal / powerOf2ToUse;

    return number + decimal;
}

/**
 * Converts a BigDecimal to a string. This returns its EXACT value!
 * @param {BigDecimalClass} bigdecimal 
 */
function BigDecimalToString(bigdecimal) {
    if (bigdecimal.number === ZERO) return '0';
    const isNegative = bigdecimal.number < ZERO;

    const powerOfTenToMultiply = TEN**BigInt(bigdecimal.exponent);

    // This makes the number LARGE enough so that when we divide by a
    // power of 2, there won't be any division overflow.
    const largenedNumber = bigdecimal.number * powerOfTenToMultiply

    const dividedNumber = largenedNumber / getBigintPowerOfTwo(bigdecimal.exponent);
    let string = `${dividedNumber}`

    if (bigdecimal.exponent === 0) return string; // Integer

    // Modify the string because it has a decimal value...

    // Make sure leading zeros aren't left out of the beginning
    const integerPortion = bigdecimal.number >> BigInt(bigdecimal.exponent);
    if (integerPortion === ZERO || integerPortion === NEGONE) {
        let missingZeros = bigdecimal.exponent - string.length;
        if (isNegative) missingZeros++;
        if (missingZeros > 0) string = isNegative ? '-' + '0'.repeat(missingZeros) + string.slice(1)
                                                  : '0'.repeat(missingZeros) + string;
    }

    // Insert the decimal point at position 'exponent' from the right side
    string = insertDotAtIndexFromRight(string, bigdecimal.exponent);
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
}

/**
 * Called by BigDecimalToString(). Inserts a `.` at the specified index from the right side of the string.
 * @param {string} string - The string
 * @param {number} index - The index
 * @returns 
 */
function insertDotAtIndexFromRight(string, index) {
    const leftPart = string.slice(0, string.length - index);
    const rightPart = string.slice(string.length - index);
    return leftPart + '.' + rightPart
}

/**
 * Trims any '0's off the end of the provided string.
 * @param {string} string - The string
 * @returns {string} The string with no zeros at the end
 */
function trimTrailingZeros(string) {
    let i = string.length - 1;
    while (i >= 0 && string[i] === '0') {
        i--;
    }
    return string.slice(0, i + 1);
}

/**
 * Returns the specified number of least significant bits of a BigInt.
 * This can be used to extract only the decimal part of a BigDecimal by passing in the exponent number for the count.
 * @param {bigint} bigint - The BigInt
 * @param {bigint} count - The number of bits to get
 * @returns {bigint} A BigInt containing only the specified bits
 */
function getLeastSignificantBits(bigint, count) {
    // Create a bitmask with the least significant n bits set to 1
    let bitmask = (ONE << count) - ONE; // If count is 5, this looks like: 11111

    // Apply bitwise AND operation with the bitmask to get the least significant bits
    let leastSignificantBits = bigint & bitmask;

    return leastSignificantBits;
}

/**
 * Returns the mimimum number of bits you need to get the specified digits of precision, rounding up.
 * 
 * For example, to have 3 decimal places of precision in a BigDecimal, or precision to the nearest thousandth,
 * call this function with precision `3`, and it will return `10` to use for the exponent value of your BigDecimal, because 2^10 ≈ 1000
 * @param {number} precision - The number of decimal places of precision you would like
 * @returns {number} The minimum number of bits needed to obtain that precision, rounded up.
 */
function howManyBitsForDigitsOfPrecision(precision) {
    const powerOfTen = 10**precision; // 3 ==> 1000
    // 2^x = powerOfTen. Solve for x
    const x = Math.log(powerOfTen) / LOG_TWO;
    return Math.ceil(x)
}

// Returns approximated digits of precision from given bits of precision
function precisionForBitsOfPrecision(bitsOfPrecision) {
    const powerOfTwo = 2 ** bitsOfPrecision;
    const precision = Math.log10(powerOfTwo);
    return Math.round(precision);
}

/**
 * Calculates the precision used, or number of digits,
 * to the right of the decimal place of the provided number.
 * @param {number} number - The number
 * @returns {number} The number of digits to the right of the decimal place.
 */
function howMuchPrecisionDoesNumberHave(number) {
    const splitParts = `${number}`.split('.')
    return splitParts[1] ? splitParts[1].length : 0;
}

// Rounding / Truncating

/**
 * Truncates a given BigDecimal to the desired exponent level.
 * 
 * If the provided exponent is higher than the existing exponent, no truncating will occur.
 * @param {BigDecimalClass} bigdecimal - The BigDecimal
 * @param {number} exponent - The desired exponent
 */
function setExponent(bigdecimal, exponent) {
    if (exponent < 0) { exponent = 0; console.error("Cannot set exponent of BigDecimal below 0! Setting to 0...") }
    const difference = exponent - bigdecimal.exponent;
    bigdecimal.number = bigdecimal.number << BigInt(difference)
    bigdecimal.exponent = exponent;
}



// Multiplication

/**
 * Multiplies two BigDecimal numbers. The new BigDecimal will have exactly the specified exponent level.
 * 
 * I recommend that exponent be atleast 50. This yields approximately
 * 15 digits of precision which is about how many javascript's doubles have.
 * However, if you're only multiplying integers, this doesn't matter.
 * 
 * TODO: Round instead of truncating lost values.
 * @param {BigDecimalClass} BigDecimal1 - Factor1
 * @param {BigDecimalClass} BigDecimal2 - Factor2
 * @param {string} exponent - The desired exponent value for the product, or number of bits to allocate for the decimal part.
 * @returns {BigDecimalClass} The product of BigDecimal1 and BigDecimal2.
 */
function multiply(BigDecimal1, BigDecimal2, exponent) {
    const rawProduct = BigDecimal1.number * BigDecimal2.number;
    const newExponent = BigDecimal1.exponent + BigDecimal2.exponent;
 
    const exponentDifference = newExponent - exponent;

    // Bit shift the rawProduct by the exponent difference to reach the desired exponent level
    const product = rawProduct >> BigInt(exponentDifference);

    // Create and return a new BigDecimal object with the adjusted product and the desired exponent
    return { number: product, exponent };
}

/**
 * Multiplies 2 BigDecimals together. The resulting exponent will be the sum of the factors exponents added together.
 * 
 * This yeilds 100% accuracy (no truncating), but requires more storage, and more compute for future operations.
 * @param {BigDecimalClass} BigDecimal1 - Factor 1
 * @param {BigDecimalClass} BigDecimal2 - Factor 2
 * @returns {BigDecimalClass} The product
 */
function multiply_add(BigDecimal1, BigDecimal2) {
    const exponent = BigDecimal1.exponent + BigDecimal2.exponent
    return multiply(BigDecimal1, BigDecimal2, exponent)
}

/**
 * Multiplies 2 BigDecimals together. The resulting exponent will be the maximum of the factors' exponents.
 * 
 * This doesn't yield 100% accuracy, but rounds. But it keeps exponent
 * values from running away to infinity, making future operations fast!
 * @param {BigDecimalClass} BigDecimal1 - Factor 1
 * @param {BigDecimalClass} BigDecimal2 - Factor 2
 * @returns {BigDecimalClass} The product
 */
function multiply_max(BigDecimal1, BigDecimal2) {
    const exponent = Math.max(BigDecimal1.exponent, BigDecimal2.exponent)
    return multiply(BigDecimal1, BigDecimal2, exponent)
}

/**
 * Multiplies 2 BigDecimals together. The resulting exponent will be the minimum of the factors' exponents.
 * 
 * This yields the least accuracy, rounding a lot. But it is the fastest!
 * @param {BigDecimalClass} BigDecimal1 - Factor 1
 * @param {BigDecimalClass} BigDecimal2 - Factor 2
 * @returns {BigDecimalClass} The product
 */
function multiply_min(BigDecimal1, BigDecimal2) {
    const exponent = Math.min(BigDecimal1.exponent, BigDecimal2.exponent)
    return multiply(BigDecimal1, BigDecimal2, exponent)
}




////////////////////////////////////////////////////////////////////
// Testing
////////////////////////////////////////////////////////////////////




const factor1 = 17.111222333444;
const factor2 = 5.55;

const bitsOfPrecision = 50
const bd1 = new BigDecimal(factor1, bitsOfPrecision);
    console.log(`${factor1} converted into BigDecimal:`)
    printInfo(bd1)
const bd2 = new BigDecimal(factor2, bitsOfPrecision);



console.log(`\nMultiplying factors ${factor1} and ${factor2} together...`)
console.log(`Expected results: ${factor1 * factor2}\n`)

const loopCount = 10**6;
let product;

// This BigDecimal library
console.time('BigDecimal')
for (let i = 0; i < loopCount; i++) {
    product = multiply_max(bd1, bd2);
}
console.timeEnd('BigDecimal')
console.log(`BigDecimal product: ${BigDecimalToString(product)}`)
console.log(`Bits of precision used: ${product.exponent}`)
console.log(`Approximate digits of precision used: ${precisionForBitsOfPrecision(product.exponent)}`)
console.log('')


// Decimal libarary
const Decimal = require('decimal.js');
const d1 = new Decimal(factor1);
const d2 = new Decimal(factor2);
console.time('Decimal')
for (let i = 0; i < loopCount; i++) {
    product = d1.times(d2);
}
console.timeEnd('Decimal')
console.log(`Decimal product: ${product.toString()}`)
console.log(`Decimal digits of precision used: ${product.precision()}`)
console.log('')


// BigNumber library
const BigNumber = require('bignumber.js');
const { prod } = require('mathjs');
const b1 = new BigNumber(factor1);
const b2 = new BigNumber(factor2);
console.time('BigNumber')
for (let i = 0; i < loopCount; i++) {
    product = b1.times(b2);
}
console.timeEnd('BigNumber')
console.log(`BigNumber product: ${product.toString()}`)
console.log(`BigNumber digits of precision used: ${product.precision()}`)







//=========================================================================
// EVERYTHING BELOW USES THE OLD [bigint, factor] format!
//=========================================================================

// Multiplies and returns a BigInt with the same factor as the first argument!
// function multiply([bigint1, factor1], [bigint2, factor2]) {
//     const product = bigint1 * bigint2;

//     // If factor2 is not 1n, adjust the product
//     if (factor2 !== 1n) {
//         return [product / factor2, factor1];
//     }

//     return [product, factor1];
// }

// Divides and returns a BigInt with the same factor as the first argument!
// function divide([bigint1, factor1], [bigint2, factor2]) {
//     const adjustedNumerator = bigint1 * factor2;
//     const quotient = adjustedNumerator / bigint2;
    
//     return [quotient, factor1];
// }


// function bigIntToString([bigInt, factor]) {

//     let string = bigInt.toString();

//     // If the factor is 1, no need to insert a decimal point
//     if (factor === 1n) return string;

//     const factorLength = factor.toString().length - 1;  // Subtract 1 because '10' has 1 zero, '100' has 2 zeros, etc.

//     if (string.length <= factorLength) {
//         // If the string length is less than or equal to the factor length, pad with zeros and place a decimal at the start
//         const padding = '0'.repeat(factorLength - string.length + 1);  // +1 for the '0.' before the number
//         return '0.' + padding + string;
//     } else {
//         // Otherwise, insert a decimal point at the appropriate position
//         const integerPart = string.slice(0, -factorLength);
//         const decimalPart = string.slice(-factorLength);
//         return integerPart + '.' + decimalPart;
//     }
// }

// FASTER version! But gives you less precision, because you are converting to
// double-precision BEFORE you splice the decimal part off.
// This still meets my needs for big ints up to 9 trillion with 3 decimal places.
// After that I will lose precision taking the fast method.
// function bigIntToNumber_MedPrec([bigInt, factor]) { // 15259, 1000 => 15.259
//     return Number(bigInt) / Number(factor);
// }

// MORE PRECISE version, but SLOWER!
// function bigIntToNumber_HighPrec([bigInt, factor]) {
//     const decimal = bigInt % factor; // 259
//     const decimalPart = Number(decimal) / Number(factor) // 259 / 1000 = 0.259

//     const integerBigInt = bigInt / factor; // 15.259 => 15
//     const integerPart = Number(integerBigInt) // 15

//     return integerPart + decimalPart; // 15 + 0.259 => 15.259
// }

// Returns log10 of a BigInt! Not sure how precise it is.
// Pulled from https://stackoverflow.com/questions/70382306/logarithm-of-a-bigint
// When I need to find the log of a scaling-factor, use howManyDecimalDigitsIsBigInt() instead
// function log10(bigint) {
//     if (bigint < 0) return NaN;
//     const s = bigint.toString(10);
  
//     return s.length + Math.log10("0." + s.substring(0, 15))
// }

// Returns how many digits of the BigInt represents the decimal part,
// based on the passed in scalingFactor. This must ALWAYS be an n'th power of 10!
// function getDecimalCountFromScalingFactor(scalingFactor) { // 1 / 10 / 100 / 1000 ...
//     const string = scalingFactor.toString(); // 1000 => '1000'
//     return string.length - 1;
// }