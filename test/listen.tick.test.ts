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
    let count = 0;
    let candles = await getSymbolCandles({
      instID,
      bar,
      before: 0,
      limit: 3000,
    });
    const atrs = calculateATR(candles, 14);
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
      subcribedCallBack(param) {},
      messageCallBack(mark) {
        count++;
      },
      errorCallBack(e) {},
    });
    await setTimeout(2000);
    ws.close();
    expect(count).greaterThanOrEqual(10);
  });
});
