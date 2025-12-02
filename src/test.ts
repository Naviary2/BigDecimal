// src/test.ts

import bimath from './bimath.js';
import {
	FromNumber,
	toExactString,
	toApproximateString,
	toNumber,
	toBigInt,
	ln,
	sqrt,
	powerInt,
	mod,
	multiply_floating,
	type BigDecimal,
} from './bigdecimal.js';

/**
 * Returns the BigDecimal's `bigint` property in binary form, **exactly** like how computers store them,
 * in two's complement notation. Negative values have all their bits flipped, and then added 1.
 * To multiply by -1, reverse all the bits, and add 1. This works both ways.
 *
 * For readability, if the number is negative, a space will be added after the leading '1' sign.
 * @param bd - The BigDecimal
 * @returns The binary string. If it is negative, the leading `1` sign will have a space after it for readability.
 */
function toDebugBinaryString(bd: BigDecimal): string {
	return bimath.toDebugBinaryString(bd.bigint);
}

/**
 * Prints useful information about the BigDecimal, such as its properties,
 * binary string, exact value as a string, and converted back to a number.
 * @param bd - The BigDecimal
 */
function printInfo(bd: BigDecimal): void {
	console.log(bd);
	console.log(`Binary string: ${toDebugBinaryString(bd)}`);
	console.log(`Converted to Exact String: ${toExactString(bd)}`);
	console.log(`Converted to String: ${toApproximateString(bd)}`);
	console.log(`Converted to Number: ${toNumber(bd)}`);
	console.log(`Converted to BigInt: ${toBigInt(bd)}`);
	console.log('----------------------------');
}

/////////////////////////////////////////////////////////////////////////////////////
// Testing
/////////////////////////////////////////////////////////////////////////////////////

const n1 = 5.66;
let bd1: BigDecimal = FromNumber(n1);
console.log(`${n1} converted into a BigDecimal:`);
printInfo(bd1);

const n2: number = -5.1;
const bd2: BigDecimal = FromNumber(n2);
const answer = ln(bd1);
console.log(`\nNatural log of ${n1}: ${answer}`);

console.log(`Starting sqrt test on ${n1}...`);
const bd3 = sqrt(bd1);
console.log(`\nSqrt ${n1}:`);
printInfo(bd3);

const power2 = 3;
const bd4 = powerInt(bd1, 3);
console.log(`\nPower ${n1} by ${power2}:`);
printInfo(bd4);

const bd5 = mod(bd1, bd2);
console.log(`\nMod ${n1} by ${n2}:`);
printInfo(bd5);

for (let i = 0; i < 20; i++) {
	// Multiply by bd2 (-5.1) each time.
	bd1 = multiply_floating(bd1, bd2);
	printInfo(bd1);
}
