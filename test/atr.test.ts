import { expect } from "chai";
import {
  getCandlesWithLimit,
  getSupportCrypto,
  getSymbolCandles,
} from "../bot/helper/okx.candles";
import { calculateEMA, findEMACrossovers } from "../bot/signals/ema-cross";
import { decodeTimestamp, zerofy } from "../bot/utils";
import { calculateATR } from "../bot/signals/atr";
import { ICandles, ImgnMode, IPosSide } from "../bot/type";
import {
  closeFuturePosition,
  openFuturePosition,
} from "../bot/helper/okx.trade";
import { getAccountPendingAlgoOrders } from "../bot/helper/okx.account";

describe("Candles ATR test", () => {
  const TEST_CONFIG = {
    BAR: "1Dutc",
    SYMBOL: "OP-USDT-SWAP",
    LIMIT: 1000,
    ATR_PERIOD: 14,
    LOG_DETAILS: true,
  };
  let candles: ICandles = [];
  before(async () => {
    candles = await getCandlesWithLimit({
      instID: TEST_CONFIG.SYMBOL,
      bar: TEST_CONFIG.BAR,
      limit: TEST_CONFIG.LIMIT,
    });
  });
  it("True ATR with single symbol", async () => {
    const atrs = calculateATR(candles, TEST_CONFIG.ATR_PERIOD);
    if (TEST_CONFIG.LOG_DETAILS) {
      const tableData = atrs.slice(-30, TEST_CONFIG.LIMIT).map((atr) => ({
        ts: decodeTimestamp(atr.ts),
        atr: zerofy(atr.atr),
        "Per. fluct": zerofy(atr.fluctuationsPercent * 100) + "%",
        o: zerofy(atr.o),
        h: zerofy(atr.h),
        l: zerofy(atr.l),
        c: zerofy(atr.c),
      }));
      console.table(tableData);
    }
    // Validate results
    expect(atrs).to.be.an("array");
    expect(atrs.length).equal(candles.length - TEST_CONFIG.ATR_PERIOD);
    expect(atrs.length).to.be.at.least(TEST_CONFIG.ATR_PERIOD); // Ensure there are enough data points
  });

  // it("Open positions and trailing loss with current ATR in single symbol", async () => {
  //   const atrs = calculateATR(candles, TEST_CONFIG.ATR_PERIOD);
  //   const currentAtr = atrs[atrs.length - 1];
  //   const { leverage, size, mgnMode, posSide } = {
  //     leverage: 5,
  //     size: 100,
  //     mgnMode: "isolated" as ImgnMode,
  //     posSide: "long" as IPosSide,
  //   };

  //   const { openAlgoOrderRes, openPositionRes } = await openFuturePosition({
  //     instId: TEST_CONFIG.SYMBOL,
  //     size: size,
  //     mgnMode: mgnMode as ImgnMode,
  //     posSide: posSide as IPosSide,
  //     leverage: leverage,
  //     callbackRatio: currentAtr.fluctuationsPercent.toFixed(4), // trailing percent ratio
  //   });
  //   expect(openAlgoOrderRes.msg).eq("");
  //   expect(openPositionRes.msg).eq("");
  //   const { closeAlgoOrderRes, closePositionRes } = await closeFuturePosition({
  //     instId: TEST_CONFIG.SYMBOL,
  //     mgnMode,
  //     posSide,
  //     isCloseAlgoOrders: true,
  //   });
  //   expect(closeAlgoOrderRes.msg).eq("");
  //   expect(closePositionRes.msg).eq("");
  // });
});
