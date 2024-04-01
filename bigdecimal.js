"use strict";

/**
 * TODO:
 * 
 * - In MathBigDec.setExponent(), add a parameter `round`.
 * Take inspiration from MathBigDec.toBigInt() for how to round in binary.
 * 
 * - In MathBigDec.multiply(), add a parameter `round`. Currently it is truncating all products.
 * BUT, does this mean less efficiency? Is it better to increase the exponent
 * of all BigDecimals by 1 in order to avoid the need to round?
 * 
 * - Fully automate the precision. Like, if you only need 4 bits of decimal to represent '1.1',
 * always add a constant of 30 extra bits of precision more than needed, making it 34.
 * Use MathBigDec.howManyBitsForDigitsOfPrecision() to calculate the base amount, then add 30.
 * Add options for high precision, medium, and low, for adding different base amounts.
 * 
 * - During BigDecimal construction, if a number can be **exactly** represented
 * with less bits, then use less bits! This includes integers, and
 * fractions with power-of-2 denominators, like 1, 1.5, 1.25, 1.375, etc.
 * They can all be represented perfectly with less bits, may as well!
 * 
 * - Allow the construction of a BigDecimal by passing in strings with decimal values.
 * You can reverse the MathBigDec.toString() algorithm to accomplish this.
 * Currently only passing in integer strings are allowed.
 * 
 * - Finish writing all remaining arithmetic methods of MathBigDec!
 * 
 */

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
 * TODO: Completely automate the chosen precision. Maybe the minimum number of bits required to
 * round to the specified number, plus an extra 30? Maybe have options for high precision, medium, and low?
 * 
 * TODO: Allow passing in strings with decimals (only integer strings allowed right now).
 * You can completely invserse the MathBigDec.toString() algorithm to do this.
 * 
 * @param {bigint | string | number} number - The true value of the BigDecimal
 * @param {number | undefined} [exponent] - Optional. The desired exponent, or precision for the BigDecimal. 0+, where 0 is integer-level precision. If left undefined, MIN_PRECISION will be used.
 * @returns {BigDecimalClass} - The BigDecimal
 */
function BigDecimal(number, exponent) {
    if (typeof number !== 'number' || Number.isInteger(number)) { // An integer was passed in...

        if (typeof number !== 'bigint') number = BigInt(number)
        if (exponent == null) exponent = 0; // Integer precision
    
        number <<= BigInt(exponent);

        return newBigDecimalFromProperties(number, exponent);
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

    return newBigDecimalFromProperties(number, exponent);
}

/**
 * Use this BigDecimal constructor when you already know the `number` and `exponent` properties of the BigDecimal.
 * @param {bigint} number - The `number` property
 * @param {number} exponent - The `exponent` property
 */
function newBigDecimalFromProperties(number, exponent) {
    watchExponent(exponent); // Protects the exponent from running away to Infinity.
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
    if (bitCountForPrecision < MIN_PRECISION) bitCountForPrecision = MIN_PRECISION;
    return bitCountForPrecision;
}

/**
 * Throws an error if the provided exponent is beyond `MAX_EXPONENT`.
 * It is assumed it's running away to Infinity.
 * @param {number} exponent - The `exponent` property of the BigDecimal
 */
function watchExponent(exponent)  {
    if (exponent > MAX_EXPONENT) throw new Error(`Cannot create a BigDecimal with exponent ${exponent}! Out of range. Max allowed: ${MAX_EXPONENT}`)
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
 * Calculates the precision used, or number of digits,
 * to the right of the decimal place of the provided number.
 * @param {number} number - The number
 * @returns {number} The number of digits to the right of the decimal place.
 */
function howMuchPrecisionDoesNumberHave(number) {
    const splitParts = `${number}`.split('.')
    return splitParts[1] ? splitParts[1].length : 0;
}


/** Complex BigInt math functions */
const MathBigInt = {

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
    }
}


/** Math and arithmetic methods performed on BigDecimals */
const MathBigDec = {

    // Addition...

    add() {

    },

    // Subtraction...

    subtract() {

    },

    // Multiplication...
    
    /**
     * Multiplies two BigDecimal numbers. The new BigDecimal will have exactly the specified exponent level.
     * 
     * I recommend that exponent be atleast 50. This yields approximately
     * 15 digits of precision which is about how many javascript's doubles have.
     * However, if you're only multiplying integers, this doesn't matter.
     * 
     * TODO: Round instead of truncating lost values.
     * BUT, does this mean less efficiency? Is it better to increase the exponent
     * by 1 in all scenarios to avoid having to round?
     * @param {BigDecimalClass} bd1 - Factor1
     * @param {BigDecimalClass} bd2 - Factor2
     * @param {string} exponent - The desired exponent value for the product, or number of bits to allocate for the decimal part.
     * @returns {BigDecimalClass} The product of BigDecimal1 and BigDecimal2.
     */
    multiply(bd1, bd2, exponent) {
        const rawProduct = bd1.number * bd2.number;
        const newExponent = bd1.exponent + bd2.exponent;
     
        const exponentDifference = newExponent - exponent;
    
        // Bit shift the rawProduct by the exponent difference to reach the desired exponent level
        const product = rawProduct >> BigInt(exponentDifference);
    
        // Create and return a new BigDecimal object with the adjusted product and the desired exponent
        return newBigDecimalFromProperties(product, exponent)
    },
    
    /**
     * Multiplies 2 BigDecimals together. The resulting exponent will be the sum of the factors exponents added together.
     * 
     * This yeilds 100% accuracy (no truncating), but requires more storage, and more compute for future operations.
     * @param {BigDecimalClass} bd1 - Factor 1
     * @param {BigDecimalClass} bd2 - Factor 2
     * @returns {BigDecimalClass} The product
     */
    multiply_add(bd1, bd2) {
        const exponent = bd1.exponent + bd2.exponent
        return MathBigDec.multiply(bd1, bd2, exponent)
    },
    
    /**
     * Multiplies 2 BigDecimals together. The resulting exponent will be the maximum of the factors' exponents.
     * This is the recommended multiplication method.
     * 
     * This doesn't yield 100% accuracy, but rounds, keeping exponent
     * values from running away to infinity.
     * @param {BigDecimalClass} bd1 - Factor 1
     * @param {BigDecimalClass} bd2 - Factor 2
     * @returns {BigDecimalClass} The product
     */
    multiply_max(bd1, bd2) {
        const exponent = Math.max(bd1.exponent, bd2.exponent)
        return MathBigDec.multiply(bd1, bd2, exponent)
    },
    
    /**
     * Multiplies 2 BigDecimals together. The resulting exponent will be the minimum of the factors' exponents.
     * 
     * This yields the least accuracy, rounding a lot. But it is the fastest!
     * @param {BigDecimalClass} bd1 - Factor 1
     * @param {BigDecimalClass} bd2 - Factor 2
     * @returns {BigDecimalClass} The product
     */
    multiply_min(bd1, bd2) {
        const exponent = Math.min(bd1.exponent, bd2.exponent)
        return MathBigDec.multiply(bd1, bd2, exponent)
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

    // Root...

    squareRoot(bd) {

    },

    cubeRoot(bd) {

    },

    root(bd, root) {

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
        bd.number *= NEGONE;
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
        let integerPart = bd.number >> exponent_bigint;
    
        if (!round || bd.exponent === 0) return integerPart;
    
        // We are rounding the decimal digits!...
    
        // To round in binary is easy. If the first digit (or most-significant digit)
        // of the decimal portion is a 1, we round up! If it's 0, we round down.
        // Let's create a mask to find the value of the first decimal bit!
    
        // Create a mask where there is a single 1 at position 'exponent'.
        // For example, if our exponent is 5, the resulting bitmask is '10000'.
        let bitmask = ONE << (exponent_bigint - ONE);
    
        // Apply bitwise AND operation with the bitmask to test if this bit is a 1
        const result = bd.number & bitmask;
    
        // If the result is greater than zero, we know the bit is a 1! Round up.
        if (result > ZERO) integerPart += ONE;
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
        const integerPart = bd.number >> exponent_bigint;
    
        let number = Number(integerPart);
    
        // Fetch only the bits containing the decimal part of the number
        let decimalPartShifted = bd.number - (integerPart << exponent_bigint);
        // Alternative line, around 10-20% slower:
        // const decimalPartShifted = MathBigInt.getLeastSignificantBits(bigdecimal.number, exponent_bigint)
    
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
     * @param {BigDecimalClass} bigdecimal - The BigDecimal
     * @returns {string} The string with the exact value
     */
    toString(bigdecimal) {
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
     * Returns the BigDecimal's `number` property in binary form, **exactly** like how computers store them.
     * This is **not** two's compliment notation. Negative values have all their bits flipped, and then added 1.
     * 
     * For readability, if the number is negative, a space will be added after the leading '1' sign.
     * @param {BigDecimalClass} bd - The BigDecimal
     * @returns {string} The binary string. If it is negative, the leading `1` sign will have a space after it for readability.
     */
    toBinary(bd) {
        if (bd.number === ZERO) return '0';
        const isNegative = bd.number < ZERO;
    
        let binaryString = '';
    
        // This equation to calculate a bigint's bit-count, b = log_2(N) + 1, is snagged from:
        // https://math.stackexchange.com/questions/1416606/how-to-find-the-amount-of-binary-digits-in-a-decimal-number/1416817#1416817
        const bitCount = isNegative ? MathBigInt.log2(MathBigInt.abs(bd.number)) + TWO // Plus 2 to account for the sign bit
                     /* positive */ : MathBigInt.log2(           bd.number ) + ONE
        // Alternate method to calculate the bit count that first converts the number to two's compliment form:
        // const bitCount = bigdecimal.number.toString(2).length;
    
        // If the bit length is 5, the resulting mask would be '10000'
        let mask = ONE << (bitCount - ONE);
    
        while (mask !== ZERO) {
            // Apphend the bit at the mask position to the string...
            if ((bd.number & mask) === ZERO) binaryString += '0';
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
     * TODO: Add a `round` parameter! Take inspiration from MathBigDec.toBigInt()!
     * 
     * Truncates a given BigDecimal to the desired exponent level.
     * If the provided exponent is higher than the existing exponent, no truncating will occur.
     * @param {BigDecimalClass} bigdecimal - The BigDecimal
     * @param {number} exponent - The desired exponent
     */
    setExponent(bigdecimal, exponent) {
        if (exponent < 0) { exponent = 0; console.error("Cannot set exponent of BigDecimal below 0! Setting to 0...") }
        const difference = exponent - bigdecimal.exponent;
        bigdecimal.number = bigdecimal.number << BigInt(difference)
        bigdecimal.exponent = exponent;
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
            return MathBigInt.log10(powerOfTwo);
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
        // Conveniently, two's compliment notation contains a - sign at the beginning for negatives,
        // subsequently in computer binary, a '1' bit is used for the sign.
        // This means the bit length is still the same!
        return bd.number.toString(2).length;
    }
};







////////////////////////////////////////////////////////////////////
// Testing
////////////////////////////////////////////////////////////////////




const bd1 = BigDecimal(5.234, 10);
MathBigDec.printInfo(bd1)
const bd2 = BigDecimal(3.1, 10);
MathBigDec.printInfo(bd2)




const Decimal = require('decimal.js'); // Decimal libarary
const BigNumber = require('bignumber.js'); // BigNumber library

// (function speedTest_Multiply() {

//     const factor1 = 17.111222333444;
//     const factor2 = 5.55;

//     const bitsOfPrecision = 50
//     const f1 = new BigDecimal(factor1, bitsOfPrecision);
//     const f2 = new BigDecimal(factor2, bitsOfPrecision);

//     console.log(`\nMultiplying factors ${factor1} and ${factor2} together...`)
//     console.log(`Expected results: ${factor1 * factor2}\n`)
    
//     const loopCount = 10**7;
//     let product;
    
//     // This BigDecimal library
//     console.time('BigDecimal')
//     for (let i = 0; i < loopCount; i++) {
//         product = MathBigDec.multiply_max(f1, f2);
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
