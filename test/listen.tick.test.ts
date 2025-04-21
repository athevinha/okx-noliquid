import { setTimeout } from "timers/promises";
import { expect } from "chai";
import { wsTicks } from "../bot/helper/okx.socket";
import { getSymbolCandles } from "../bot/helper/okx.candles";
import { calculateATR } from "../bot/signals/atr";
import {getOKXFunding} from "../bot/helper/okx.funding";

describe("OKX socket test ticker", () => {
  const { instID, bar } = {
    bar: "1s",
    instID: "BTC-USDT-SWAP",
  };
  it("OKX new candles socket test", async () => {
    let count = 0;
    const fundingArbitrage = await getOKXFunding({})
    const ws = wsTicks({
      subscribeMessage: {
        op: "subscribe",
        args: fundingArbitrage.filter(e => e.buyInstType === "SWAP").map(e => {
          return {
              instId: e.buyInstId,
              channel: `mark-price`
          }}),
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
