import { setTimeout } from "timers/promises";
import { expect } from "chai";
import { wsTicks } from "../bot/helper/okx.socket";
import { getSymbolCandles } from "../bot/helper/okx.candles";
import { calculateATR } from "../bot/signals/atr";

describe("OKX socket test ticker", () => {
  const { instID, bar } = {
    bar: "1m",
    instID: "BTC-USDT-SWAP",
  };
  it("OKX new candles socket test", async () => {
    let count = 0
    let candles = await getSymbolCandles({
      instID,
      bar,
      before: 0,
      limit: 3000,
    });
    const atrs = calculateATR(candles, 14);
    let currentATR = atrs[atrs.length - 1].atr;
    const ws = wsTicks({
      subscribeMessage: {
        op: "subscribe",
        args: [
          {
            channel: `mark-price`,
            instId: instID,
          },
        ],
      },
      subcribedCallBack(param) {
        console.log(param);
      },
      messageCallBack(mark) {
        const markPrice = Number(mark.data[0].markPx);
        count++
        // if(markPrice < candles[candles.length - 1].l) candles[candles.length - 1].l = markPrice
        // if(markPrice > candles[candles.length - 1].h) candles[candles.length - 1].h = markPrice
        // candles[candles.length - 1].c = markPrice
        // currentATR =  calculateATR(candles, 14).slice(-1)[0].atr
      },
      errorCallBack(e) {
        console.log(e);
      },
    });
    await setTimeout(10000);
    ws.close();
    expect(count).greaterThanOrEqual(10)
  });
});
