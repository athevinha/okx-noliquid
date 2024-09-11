import { expect } from "chai";
import {
  getCandlesWithLimit,
  getSupportCrypto,
  getSymbolCandles,
} from "../bot/helper/okx.candles";
import { calculateEMA, findEMACrossovers } from "../bot/signals/ema-cross";
import { decodeTimestamp } from "../bot/utils";

describe("Candles EMA cross test", () => {
  const TEST_CONFIG = {
    SYMBOL: "AAVE-USDT-SWAP",
    SHORT_PERIOD: 9,
    LONG_PERIOD: 21,
  };
  it("True EMA cross with single symbol", async () => {
    const candles = await getSymbolCandles({
      before: 0,
      instID: TEST_CONFIG.SYMBOL,
      bar: "2H",
      limit: 300,
    });
    const shortEma = calculateEMA(candles, 9);
    const longEma = calculateEMA(candles, 21);
    const emaCross = findEMACrossovers(candles, 9, 21);
    emaCross.map((ec) => {
      const L = longEma.filter((l) => l.ts === ec.ts)?.[0];
      const S = shortEma.filter((s) => s.ts === ec.ts)?.[0];
      const candle = candles.filter((c) => c.ts === ec.ts)?.[0];
      expect(L?.ts).greaterThan(0);
      expect(S?.ts).greaterThan(0);
      expect(L.ema).eq(ec.longEMA);
      expect(S.ema).eq(ec.shortEMA);
      expect(candle.o).eq(ec.o);
    });
  });
  it("True EMA cross with multiple symbol", async () => {
    const supportFutureCryptos = await getSupportCrypto({});
    const supportFutureCryptosByInstId = supportFutureCryptos.map(
      (e) => e.instId,
    );
    await Promise.all(
      supportFutureCryptosByInstId.map(async (spCrypto) => {
        const candles = await getSymbolCandles({
          before: 0,
          instID: spCrypto,
          bar: "2H",
          limit: 300,
        });
        const shortEma = calculateEMA(candles, 9);
        const longEma = calculateEMA(candles, 21);
        const emaCross = findEMACrossovers(candles, 9, 21);
        emaCross.map((ec) => {
          const L = longEma.filter((l) => l.ts === ec.ts)?.[0];
          const S = shortEma.filter((s) => s.ts === ec.ts)?.[0];
          const candle = candles.filter((c) => c.ts === ec.ts)?.[0];
          expect(L?.ts).greaterThan(0);
          expect(S?.ts).greaterThan(0);
          expect(L.ema).eq(ec.longEMA);
          expect(S.ema).eq(ec.shortEMA);
          expect(candle.o).eq(ec.o);
        });
      }),
    );
  });
});
