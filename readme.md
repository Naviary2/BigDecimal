# Arbitrary Decimal Precision Arithmetic

**This library is not yet finished.**

This is a library for working with numbers of arbitrary precision that focuses on speed, while having compatibility not only for integers, but decimals as well.

When compared to the popular [Decimal.js](https://github.com/MikeMcl/decimal.js) and [BigNumber.js](https://github.com/MikeMcl/bignumber.js) libraries, this obtains speeds, on average **2-3 times faster** than those, making **BigDecimal.js** a good choice if speed is of more importance!

## How it works

Javascript's BigInt primitive is one of the fastest methods for performing arbitrary integer arithmetic in javascript. This library takes advantage of BigInt's speed, and combines it with fixed-point arithmetic. A set portion of the least-significant bits of the BigInt are dedicated towards the decimal portion of the number, indicated by the `divex` property, and the remaining most-significant bits are used for the integer portion!

If we wanted to store 2.75, that would look like `{ bigint: 11n, divex: 2}`. In binary, 11n is `1011`. But the right-most 2 bits are dedicated for the decimal part, so we split it into `10`, which is 2 in binary, and `11`, which is a binary fraction for 0.75. Added together we get 2.75. Or in other words, if we have our `bigint` and `divex` properties, than our true number equals `bigint / 2^divex`.

This allows us to work with arbitrary-sized numbers **with** arbitrary levels of decimal precision!

---

If you do not need 100% accuracy, I recommend using [break_infinity.js](https://github.com/Patashu/break_infinity.js/tree/master?tab=readme-ov-file)! That is about 5x faster than this library. But it only has limited precision. It uses a mantissa, similar to javascript's normal numbers, "doubles". At any given point it roughly stores only 15 significant digits of precision. It has the same MAX_SAFE_INTEGER value as javascript numbers do, but it does not hit Infinity when the number gets too big.

**Where BigDecimal.js shines**, is when you need as much accuracy and precision as Decimal.js or BigNumber.js, just with greater speed! If you need more than 15 digits of precision, *and* you need decimals, BigDecimal.js is a great solution!

---

This library is very new and is not yet complete. The inspiration for this came for making [Infinite Chess](https://www.infinitechess.org) truly infinite, while remaining fast! Feel free to use this in your own projects! If you find a use for this, I'd love to hear about it! Also, feel free to suggest changes that increase speed or compatibility!
