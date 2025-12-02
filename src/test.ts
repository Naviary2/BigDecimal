// src/test.ts
// Testing code for BigDecimal library

import {
	type BigDecimal,
	FromNumber,
	ln,
	sqrt,
	pow,
	mod,
	multiply_floating,
	printInfo,
	toApproximateString,
} from './bigdecimal.js';

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
// printInfo(answer);

console.log(`Starting sqrt test on ${n1}...`);
const bd3 = sqrt(bd1);
console.log(`\nSqrt ${n1}:`);
printInfo(bd3);

const power2 = 3;
const bd4 = pow(bd1, 3);
console.log(`\nPower ${n1} by ${power2}:`);
printInfo(bd4);

const bd5 = mod(bd1, bd2);
console.log(`\nMod ${n1} by ${n2}:`);
printInfo(bd5);

for (let i = 0; i < 20; i++) {
	// Multiply by 0.1 each time.
	// bd1 = divide_fixed(bd1, bd2);
	// bd1 = divide_floating(bd1, bd2);
	bd1 = multiply_floating(bd1, bd2);
	printInfo(bd1);
	// console.log("Effective digits: ", getEffectiveDecimalPlaces(bd1));
}

/////////////////////////////////////////////////////////////////////////////////////
// Comprehensive Interaction Verification Suite
/////////////////////////////////////////////////////////////////////////////////////

function runComprehensiveVerification(): void {
	console.log('--- Running Comprehensive Interaction Verification Suite ---');
	console.log('Verifying all function outputs by inspecting their internal state.\n');

	// Helper to print a header and then the full info of a BigDecimal result
	function testAndPrint(name: string, result: BigDecimal): void {
		console.log(`\n▶ TEST: ${name}`);
		printInfo(result);
	}

	// Helper for primitives
	function testPrimitive(name: string, result: string | number | boolean): void {
		console.log(`\n▶ TEST: ${name}`);
		console.log(`  Result: ${result}`);
		console.log('----------------------------');
	}

	// --- Test Values ---
	// Note: NewBigDecimal_FromString was not implemented, using FromNumber instead
	const testValues = [
		FromNumber(10.6),
		FromNumber(-2.6),
		FromNumber(7),
		FromNumber(0.387),
		FromNumber(-0.58),
		FromNumber(0),
		// Large integers and very small decimals may lose precision when using FromNumber
		// For true arbitrary precision, a FromString function would be needed
	];

	// =================================================================================
	// Part 1: Single-Operand Function Tests
	// =================================================================================
	console.log('--- Part 1: Verifying Single-Operand Functions ---\n');
	for (const bd of testValues) {
		const bd_str = toApproximateString(bd);
		console.log(
			`\n\n################### Testing against value: ${bd_str} ###################\n`,
		);

		printInfo(bd);

		// testPrimitive("toBigInt()", `${toBigInt(bd)}n`);
		// testPrimitive("toNumber()", toNumber(bd));
		// testPrimitive("getEffectiveDecimalPlaces()", getEffectiveDecimalPlaces(bd));

		// const temp_bd_down = clone(bd);
		// setExponent(temp_bd_down, 20);
		// testAndPrint("setExponent(20) (decrease precision)", temp_bd_down);
		// const temp_bd_up = clone(bd);
		// setExponent(temp_bd_up, temp_bd_up.divex + 20);
		// testAndPrint("setExponent(divex+20) (increase precision)", temp_bd_up);
	}

	// =================================================================================
	// Part 2: Two-Operand Function Interaction Tests
	// =================================================================================
	// console.log("\n\n--- Part 2: Verifying Two-Operand Function Interactions ---\n");
	// for (const bd1 of testValues) {
	// 	const str1 = toApproximateString(bd1);
	// 	console.log(`\n\n################### Testing interactions with Operand 1: ${str1} ###################`);

	// 	for (const bd2 of testValues) {
	// 		const str2 = toApproximateString(bd2);

	// 		testAndPrint(`add(${str1}) + (${str2})`, add(bd1, bd2));
	// 		testAndPrint(`subtract(${str1}) - (${str2})`, subtract(bd1, bd2));
	// 		testAndPrint(`multiply(${str1}) * (${str2})`, multiply_fixed(bd1, bd2));
	// 		testPrimitive(`compare(${str1}) vs (${str2})`, compare(bd1, bd2));

	// 		// Divide - Proactively check for zero divisor
	// 		if (str2 === "0") {
	// 			console.log(`\n▶ TEST: divide(${str1}) / (${str2})`);
	// 			console.log("  Result: Skipped (Division by zero)");
	// 			console.log('----------------------------');
	// 		} else {
	// 			testAndPrint(`divide(${str1}) / (${str2})`, divide_fixed(bd1, bd2));
	// 		}
	// 	}
	// }

	console.log('\n--- Comprehensive Interaction Verification Finished ---');

	// These helper functions are used by the commented Part 2 tests above.
	// Keeping references to avoid unused function warnings when Part 2 is re-enabled.
	void testAndPrint;
	void testPrimitive;
}

// Run the verification
runComprehensiveVerification();
