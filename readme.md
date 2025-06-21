# Arbitrary Decimal Precision Arithmetic

**This library is not yet finished.**

This is a library for working with numbers of arbitrary precision that focuses on speed, while having compatibility not only for integers, but decimals as well.

When compared to the popular [Decimal.js](https://github.com/MikeMcl/decimal.js) and [BigNumber.js](https://github.com/MikeMcl/bignumber.js) libraries, this obtains speeds, on average **2-3 times faster** than those, making **BigDecimal.js** a good choice if speed is of more importance!

## How it works

Javascript's BigInt primitive is one of the fastest methods for performing arbitrary integer arithmetic in javascript. This library takes advantage of BigInt's speed, and combines it with fixed-point arithmetic. A set portion of the least-significant bits of the BigInt are dedicated towards the decimal portion of the number, indicated by the `divex` property, and the remaining most-significant bits are used for the integer portion!

If we wanted to store 2.75, that would look like `{ bigint: 11n, divex: 2}`. In binary, 11n is `1011`. But the right-most 2 bits are dedicated for the decimal part, so we split it into `10`, which is 2 in binary, and `11`, which is a binary fraction for 0.75. Added together we get 2.75. Or in other words, if we have our `bigint` and `divex` properties, than our true number equals `bigint / 2^divex`.

This allows us to work with arbitrary-sized numbers **with** arbitrary levels of decimal precision!

---

### An Important Note on Base-2 vs. Base-10

The core design of `BigDecimal.js` is to be a **base-2** (binary) arithmetic library. This is a source of significant speed advantage, as it aligns with how computers fundamentally process numbers.

However, this creates an important trade-off. Common decimal fractions like `0.1` or `0.2` cannot be represented perfectly in base-2; they become infinitely repeating binary fractions. This is the same reason why `0.1 + 0.2` does not equal `0.3` in standard JavaScript:
```javascript
0.1 + 0.2 // returns 0.30000000000000004
```