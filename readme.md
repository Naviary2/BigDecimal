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
