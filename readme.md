# High Performance Arbitrary Decimal Precision

BigDecimal implementation focusing on speed. This outperforms popular libraries like [decimal.js](https://www.npmjs.com/package/decimal.js/v/10.2.1) or [bignumber.js](https://www.npmjs.com/package/bignumber.js).

This library was designed by [Naviary](https://www.youtube.com/@Naviary) to fill a missing gap in software requirements. A demonstration of its capabilities can be seen in this video, [The Journey to the Edge of the Infinite Chess Board](https://youtu.be/AaBkZzy2t0Y?si=b5lc2QYaHoF28cnW). This has been tested for numbers as large as 10^1000000, but theoretically it should work for as long as the bigint max size isn't exceeded, which is 4.20e323228496 in the V8 JavaScript engine.

## When to use this library

You need arbitrary large numbers, with arbitrary decimal precision, and integer calculations must be **exact**, not approximate.

You need speed greater speed than that of the mainstream libraries.

## When not to use

You don't need 100% accuracy, just needing numbers to not hit Infinity when they get too big, or zero when they get too small. Here I would recommend using [break_infinity.js](https://github.com/Patashu/break_infinity.js/tree/master?tab=readme-ov-file)! That is considerably faster than this for that purpose.

Or, when you need decimal numbers to be **perfectly** representable. For example, 0.1. This library will make a very close approximation to that, of which the accuracy is customizable. But, that's how standard javascript numbers work anyway, right? 🤷‍♂️ They approximate. In graphics rendering, approximations are typically enough. However, all integers can still be perfectly represented.

## How it works

Javascript's BigInt primitive is one of the fastest methods for performing arbitrary integer arithmetic in javascript. This library takes advantage of BigInt's speed, and combines it with fixed-point arithmetic. A set portion of the least-significant bits of the BigInt are dedicated towards the decimal portion of the number, and the remaining most-significant bits are used for the integer portion.

## Usage

### Installation

```bash
npm i @naviary/bigdecimal
```

### Quick Start

This library uses a functional API for optimal performance. Instead of creating class instances with `new`, you import functions to manipulate `BigDecimal` objects.

```typescript
import { 
  FromBigInt, 
  add, 
  toExactString 
} from '@naviary/bigdecimal';

// Variable requiring precision at high magnitudes.
// Default precision level is used if not specified.
let position = FromBigInt(10n ** 200n);
const velocity = FromNumber(0.25);

// Increment position.
// The result has as much decimal precision as the first argument.
position = add(position, velocity);

console.log(toExactString(result))
// Output: "10000...0000.25"
```

### API Reference

A good rule of thumb is all functions that accept two BigDecimals as input, will return the result with precision matching the **first** argument.

All methods do not modify the input arguments, returning a new BigDecimal, unless otherwise stated.

| Function | Description |
| :--- | :--- |
| **Creation** | |
| `FromNumber(n)` | Creates a BigDecimal from a JavaScript number. |
| `FromBigInt(n)` | Creates a BigDecimal from a native BigInt. |
| **Arithmetic** | |
| `add(a, b)` | Adds two BigDecimals. |
| `subtract(a, b)` | Subtracts `b` from `a`. |
| `multiply_fixed(a, b)` | Multiplies maintaining precision of first argument. |
| `multiply_floating(a, b)` | Multiplies and normalizes precision to a standard mantissa size (handles scale changes nicely). |
| `divide_fixed(a, b)` | Divides `a` by `b` maintaining precision of first argument. |
| `divide_floating(a, b)` | Divides `a` by `b` and normalizes precision to a standard mantissa size (handles scale changes nicely). |
| `pow(base, exp)` | Raises `base` to the power of `exp` and normalizes precision to a standard mantissa size. |
| `sqrt(x)` | Calculates the square root of `x` and normalizes precision to a standard mantissa size. |
| `abs(x)` | Returns the absolute value. |
| `negate(x)` | Returns the value with its sign inverted. |
| **Comparison** | |
| `compare(a, b)` | Returns `-1` if a < b, `0` if equal, `1` if a > b. |
| `areEqual(a, b)` | Returns `true` if values are numerically equal. |
| `isInteger(x)` | Returns `true` if the value has no fractional part. |
| `isZero(x)` | Returns `true` if the value is zero. |
| **Conversion** | |
| `clone` | Returns a duplicate of the BigDecimal. |
| `setExponent` | Modifies the given BigDecimal with a new precision level. |
| `fixPrecision` | Resets the precision of the BigDecimal to the default. |
| `toExactString(x)` | Returns the full, precise decimal string. |
| `toApproximateString(x)` | Returns a rounded decimal string to trim extraneous digits that only give an illusion of precision. |
| `toNumber(x)` | Converts to a standard JavaScript number (may overflow/underflow or lose precision). |
| `toBigInt(x)` | Rounds any decimal part and returns a BigInt. |
