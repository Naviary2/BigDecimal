# Arbitrary Decimal Precision Arithmetic

This is a library for working with numbers of arbitrary size that focuses on speed, while having compatibility not only for integers, but decimals as well.

Javascript's BigInt primitive is one of the fastest methods for performing arbitrary integer arithmetic in javascript. This library takes advantage of BigInt's speed, and combines it with something called fixed-point arithmetic. A set portion of the least-significant bits of the BigInt are dedicated towards the decimal portion of the number, and the remaining most-significant bits are used for the integer portion!

This allows us to work with arbitrary-sized numbers **with** arbitrary levels of decimal precision!

When compared to the popular [Decimal.js](https://github.com/MikeMcl/decimal.js) and [BigNumber.js](https://github.com/MikeMcl/bignumber.js) libraries, this obtains speeds, on average **2-3 times faster**, than those, making **BigDecimal.js** a good choice if speed is of more importance.

---

This library is very new and is not yet complete. The inspiration for this came for obtaining infinite move and zoom distance on InfiniteChess.org, while being very optimized! Feel free to use this in your own projects! If you find a use for this, I'd love to hear about it! Also, feel free to suggest changes that increase speed or compatibility! 