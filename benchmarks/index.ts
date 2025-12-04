import { run, bench, group } from 'mitata';
import Decimal from 'decimal.js';
import BigNumber from 'bignumber.js';

import {
	FromNumber,
	divide_floating,
	add,
	multiply_floating,
	multiply_fixed,
	sqrt,
	SetGlobalPrecision,
} from '../src/bigdecimal.js';

// CONFIGURATION
const DECIMAL_PRECISION = 100;
const BINARY_PRECISION = Math.ceil(DECIMAL_PRECISION * Math.log2(10)); // ~333 bits

console.log(
	`\n🚀 Benchmarking at ~${DECIMAL_PRECISION} decimal digits (${BINARY_PRECISION} bits)\n`,
);

Decimal.set({ precision: DECIMAL_PRECISION });
BigNumber.config({ DECIMAL_PLACES: DECIMAL_PRECISION });
SetGlobalPrecision(BINARY_PRECISION);

// INPUTS
// Use "Dense" numbers to force the CPU to use all bits.
// A = 0.33333... (Repeating bits)
// B = 1.41421... (Chaotic bits)
const n_one = FromNumber(1, BINARY_PRECISION);
const n_three = FromNumber(3, BINARY_PRECISION);

// Prepare @naviary/bigdecimal inputs
const naviary_A = divide_floating(n_one, n_three, BINARY_PRECISION);
const naviary_B = sqrt(FromNumber(2, BINARY_PRECISION), BINARY_PRECISION);

// Prepare decimal.js inputs
const decimal_A = new Decimal(1).div(3);
const decimal_B = new Decimal(2).sqrt();

// Prepare bignumber.js inputs
const bn_A = new BigNumber(1).div(3);
const bn_B = new BigNumber(2).sqrt();

// BENCHMARKS

group('Addition (0.33 + 1.41)', () => {
	bench('decimal.js', () => decimal_A.plus(decimal_B));
	bench('bignumber.js', () => bn_A.plus(bn_B));
	bench('@naviary/bigdecimal', () => add(naviary_A, naviary_B));
});

group('Multiplication (0.33 * 1.41)', () => {
	bench('decimal.js', () => decimal_A.times(decimal_B));
	bench('bignumber.js', () => bn_A.multipliedBy(bn_B));
	bench('@naviary/bigdecimal', () => multiply_floating(naviary_A, naviary_B, BINARY_PRECISION));
});

group('Division (0.33 / 1.41)', () => {
	bench('decimal.js', () => decimal_A.div(decimal_B));
	bench('bignumber.js', () => bn_A.div(bn_B));
	bench('@naviary/bigdecimal', () => divide_floating(naviary_A, naviary_B, BINARY_PRECISION));
});

group('Feature: Fixed-Point Multiplication', () => {
	// Force competitor libraries to round back to the target precision to simulate Fixed Point behavior.
	bench('decimal.js (simulated)', () =>
		decimal_A.times(decimal_B).toDecimalPlaces(DECIMAL_PRECISION),
	);
	bench('bignumber.js (simulated)', () =>
		bn_A.multipliedBy(bn_B).decimalPlaces(DECIMAL_PRECISION),
	);
	// My native fixed-point method
	bench('@naviary/bigdecimal', () => multiply_fixed(naviary_A, naviary_B));
});

await run();
