# High Performance Arbitrary Decimal Precision

Binary BigDecimal implementation focusing on performance. This reaches speeds **5x to 50x faster** on various operations than mainstream libraries [decimal.js](https://www.npmjs.com/package/decimal.js/v/10.2.1), and [bignumber.js](https://www.npmjs.com/package/bignumber.js) (benchmarks below)!

This library was designed by [Naviary](https://www.youtube.com/@Naviary) to fill a missing gap in software requirements. A demonstration of its capabilities can be seen in this video, [The Journey to the Edge of the Infinite Chess Board](https://youtu.be/AaBkZzy2t0Y?si=b5lc2QYaHoF28cnW). This has been tested for numbers as large as 10^1000000, but theoretically it should work for as long as the bigint max size isn't exceeded, which is 4.20e323228496 in the V8 JavaScript engine.

## When to use this library

You need arbitrary large numbers, with arbitrary decimal precision, and integer calculations must be exact, not approximate. (Support for floating point operations included when precision isn't required)

You need speed greater than that of the mainstream libraries.

## When not to use

You don't need precision down to the integer, just needing numbers to not hit Infinity when they get too big, or zero when they get too small. Here I would recommend using [break_infinity.js](https://github.com/Patashu/break_infinity.js/tree/master?tab=readme-ov-file)! That is faster than this for that purpose.

You need decimal numbers to be **perfectly** representable. For example, 0.1. This library will make a very close approximation to that, of which the accuracy is customizable. However, all integers and dyadic rationals are perfectly representable.

## How it works

Javascript's BigInt primitive is one of the fastest methods for performing arbitrary integer arithmetic in javascript. This library takes advantage of BigInt's speed, and combines it with fixed-point arithmetic. A set portion of the least-significant bits of the BigInt are dedicated towards the decimal portion of the number, and the remaining most-significant bits are used for the integer portion. Thus, under the hood this stores numbers in binary.

## Usage

### Installation

```bash
npm i @naviary/bigdecimal
```

### Quick Start

This library uses a functional API for optimal performance. Instead of creating class instances with `new`, you import functions to manipulate `BigDecimal` objects.

```typescript
import { fromBigInt, fromNumber, add, toExactString } from '@naviary/bigdecimal';

// Variable requiring precision at high magnitudes.
// Default precision level is used if not specified.
let position = fromBigInt(10n ** 200n);
const velocity = fromNumber(0.25);

// Increment position.
// The result has as much decimal precision as the first argument.
position = add(position, velocity);

console.log(toExactString(position));
// Output: "100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000.25"
```

### API Reference

A good rule of thumb is all functions that accept two BigDecimals as input, will return the result with precision matching the **first** argument, unless otherwise stated, below.

All methods do not modify the input arguments, returning a new BigDecimal, unless otherwise stated, below.

| Function                 | Description                                                                                                                                                           |
| :----------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Config**               |                                                                                                                                                                       |
| `setDefaultPrecision(x)` | Sets the default number of bits of precision dedicated towards the decimal portion of BigDecimals. Default: 23 bits (~7 decimal digits)                               |
| **Creation**             |                                                                                                                                                                       |
| `fromNumber(n)`          | Creates a BigDecimal from a JavaScript number.                                                                                                                        |
| `fromBigInt(n)`          | Creates a BigDecimal from a native BigInt.                                                                                                                            |
| **Arithmetic**           |                                                                                                                                                                       |
| `add(a, b)`              | Adds two BigDecimals, maintaining the precision of the first argument.                                                                                                |
| `subtract(a, b)`         | Subtracts `b` from `a`, maintaining the precision of `a`.                                                                                                             |
| `multiply(a, b)`         | Multiplies maintaining precision of the first argument.                                                                                                               |
| `multiplyFloating(a, b)` | Multiplies and shifts the decimal point to normalize the mantissa, minimicking a floating point operation.                                                            |
| `divide(a, b)`           | Divides `a` by `b` maintaining precision of the first argument.                                                                                                       |
| `divideFloating(a, b)`   | Divides `a` by `b` and shifts the decimal point to normalize the mantissa, minimicking a floating point operation.                                                    |
| `mod(a, b)`              | Calculates the remainder of `a` divided by `b` (modulo)                                                                                                               |
| `pow(base, exp)`         | Raises `base` to the power of `exp` and shifts the decimal point to normalize the mantissa, minimicking a floating point operation.                                   |
| `sqrt(x)`                | Calculates the square root of `x` and shifts the decimal point to normalize the mantissa, minimicking a floating point operation.                                     |
| `hypot(x, y)`            | Calculates the hypotenuse of a right triangle with given side lengths and shifts the decimal point to normalize the mantissa, minimicking a floating point operation. |
| `log10(x)`               | Calculates the base-10 logarithm of the value.                                                                                                                        |
| `ln(x)`                  | Calculates the natural logarithm of the value.                                                                                                                        |
| `exp(x)`                 | Calculates the exponential function e^x of the value.                                                                                                                 |
| `abs(x)`                 | Returns the absolute value.                                                                                                                                           |
| `negate(x)`              | Returns the value with its sign inverted.                                                                                                                             |
| `min(a, b)`              | Returns the smaller of the two values. Returns one of the input arguments.                                                                                            |
| `max(a, b)`              | Returns the larger of the two values. Returns one of the input arguments.                                                                                             |
| `clamp(x, a, b)`         | Clamps the BigDecimal between two values. Returns one of the input arguments.                                                                                         |
| `round(x)`               | Rounds the BigDecimal to the nearest integer.                                                                                                                         |
| `floor(x)`               | Returns the largest integer that is smaller than the value.                                                                                                           |
| `ceil(x)`                | Returns the smallest integer that is greater than the value.                                                                                                          |
| **Comparison**           |                                                                                                                                                                       |
| `compare(a, b)`          | Returns `-1` if a < b, `0` if equal, `1` if a > b.                                                                                                                    |
| `areEqual(a, b)`         | Returns `true` if values are numerically equal. (Differing precisions doesn't matter)                                                                                 |
| `isInteger(x)`           | Returns `true` if the value has no fractional part.                                                                                                                   |
| `isZero(x)`              | Returns `true` if the value is zero.                                                                                                                                  |
| **Utility**              |                                                                                                                                                                       |
| `clone(x)`               | Returns a duplicate of the BigDecimal.                                                                                                                                |
| `setPrecision(x, exp)`   | Mutates the given BigDecimal with a new precision level.                                                                                                              |
| `resetPrecision(x)`      | Resets the precision of the BigDecimal to the default. Mutates the original BigDecimal.                                                                               |
| `hasDefaultPrecision(x)` | Returns `true` if the value has the default precision.                                                                                                                |
| **Conversion**           |                                                                                                                                                                       |
| `toNumber(x)`            | Converts to a standard JavaScript number. May overflow to Infinity, underflow to zero, or lose precision.                                                             |
| `toBigInt(x)`            | Converts to a BigInt, rounding to the nearest integer.                                                                                                                |
| `toExactString(x)`       | Returns the full, precise decimal string.                                                                                                                             |
| `toApproximateString(x)` | Returns a rounded decimal string, trimming extraneous digits that give an illusion of precision.                                                                      |

## Benchmarks

Performance comparisons were conducted using the mitata micro-benchmarking framework. All tests were normalized to 100 decimal digits of precision (approx. 333 bits).

Replicate by running:

```
npm run bench
```

Summary of results:

| Operation (100 Digits)   | @naviary/bigdecimal | bignumber.js | decimal.js | Speedup vs Best Competitor |
| :----------------------- | :------------------ | :----------- | :--------- | :------------------------- |
| **Addition**             | **38 ns**           | 169 ns       | 434 ns     | **4.4x Faster**            |
| **Multiplication**       | **180 ns**          | 5,100 ns     | 7,030 ns   | **28x Faster**             |
| **Division**             | **536 ns**          | 8,150 ns     | 9,730 ns   | **15x Faster**             |
| **Fixed-Point Multiply** | **101 ns**          | 5,250 ns     | 7,390 ns   | **52x Faster**             |

Competitors behave as floating-point libraries by default. To simulate fixed-point behavior, they require a manual rounding step after every operation, which incurred some extra overhead.

Using native CPU-optimized BigInt arithmetic clearly achieves significant speedups in heavy operations! And the speedups performance gaps only grow larger as the number of digits increases.

Full results:

<img width="701" height="975" alt="Screenshot 2025-12-04 at 5 17 58 AM" src="https://github.com/user-attachments/assets/e83f9ec3-1fb8-4cdd-9bcb-a6dd2b1a7cfd" />
