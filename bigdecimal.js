"use strict";

/**
 * Each BigDecimal contains the properties:
 * - `number` (BigInt)
 * - `exponent` (Number)
 */
class BigDecimalClass {
    /** The exponent-bit-shifted value of the bigint */
    number;
    /** The exponent */
    exponent;
}

/**
 * 
 * @param {bigint | string | number} value - The true value of the BigDecimal
 * @param {number} exponent - The desired exponent, or precision for the BigDecimal
 * @returns {BigDecimalClass} - The BigDecimal
 */
function BigDecimal(value, exponent) {
    if (typeof value !== 'bigint') value = BigInt(value);

    // The number has to be bit-shifted according to the desired exponent level
    /** BigInt */
    const number = value << BigInt(exponent);

    return { number, exponent }
}

/**
 * Multiplies two BigDecimal numbers.
 * @param {BigDecimalClass} BigDecimal1 - Factor1
 * @param {BigDecimalClass} BigDecimal2 - Factor2
 * @returns {BigDecimalClass} The product of BigDecimal1 and BigDecimal2.
 */
function multiply(BigDecimal1, BigDecimal2) {
    const rawProduct = BigDecimal1.number * BigDecimal2.number;
    const newExponent = BigDecimal1.exponent + BigDecimal2.exponent;

    const desiredExponent = Math.max(BigDecimal1.exponent, BigDecimal2.exponent)
    const exponentDifference = newExponent - desiredExponent;

    // Bit shift the rawProduct by the exponent difference to reach the desired exponent level
    const product = rawProduct >> BigInt(exponentDifference);

    // Create and return a new BigDecimal object with the adjusted product and the desired exponent
    return { number: product, exponent: desiredExponent };
}

/**
 * Returns the binary string representation of the BigDecimal.
 * @param {BigDecimalClass} bigdecimal - The BigDecimal
 * @returns {string} The value of the BigDecimal in binary. This is exponent-shifted. It is NOT the integer part of the BigDecimal!
 */
function getBinaryString(bigdecimal) {
    return bigdecimal.number.toString(2);
}

/**
 * Separates the bigdecimal into its integer and decimal/fractional parts
 * @param {BigDecimalClass} bigdecimal - The BigDecimal
 * @returns {object} An object with 2 properties, `integer` and `decimal`.
 */
function getIntAndDecimalPartsFromBigDecimal(bigdecimal) {
    // Bit shift to the right to get the integer part
    const integer = bigdecimal.number >> BigInt(bigdecimal.exponent);
    
    let decimal; // Yet to be calculated...

    return { integer, decimal }
}


////////////////////////////////////////////////////////////////////
// Testing
////////////////////////////////////////////////////////////////////

const bd1 = new BigDecimal(2, 1);
console.log(`BigDecimal1:`)
console.log(bd1)
console.log(`Binary string: ${getBinaryString(bd1)}`)
console.log(getIntAndDecimalPartsFromBigDecimal(bd1))

const bd2 = new BigDecimal(7, 2);
console.log(`\nBigDecimal2:`)
console.log(bd2)
console.log(`Binary string: ${getBinaryString(bd2)}`)
console.log(getIntAndDecimalPartsFromBigDecimal(bd2))

const product = multiply(bd1, bd2);
console.log(`\nProduct:`)
console.log(product)
console.log(`Binary string: ${getBinaryString(product)}`)
console.log(getIntAndDecimalPartsFromBigDecimal(product))




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
