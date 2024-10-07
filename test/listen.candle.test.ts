import { setTimeout } from "timers/promises";
import { wsCandles } from "../bot/helper/okx.socket";
import { decodeTimestampAgo } from "../bot/utils";
import { expect } from "chai";

describe("OKX socket test", () => {
  const { bar, instId } = {
    bar: "1m",
    instId: "BTC-USDT-SWAP",
  };
  it("OKX new candles socket test", async () => {
    let count = 0;
    const ws = wsCandles({
      subscribeMessage: {
        op: "subscribe",
        args: [
          {
            channel: `mark-price-candle${bar}`,
            instId,
          },
        ],
      },
      messageCallBack(candles) {
        count++;
      },
    });
    await setTimeout(10000);
    ws.close();
    expect(count).greaterThanOrEqual(10);
  });
});
