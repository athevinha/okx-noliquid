import {setTimeout} from "timers/promises";
import {wsCandles} from "../bot/helper/okx.socket";
import { decodeTimestampAgo} from "../bot/utils";

describe("OKX socket test", () => {
  const {bar, instId} = {
    bar: '1m',
    instId: 'BTC-USDT-SWAP'
  }
  it("OKX new candles socket test", async () => {
   const ws = wsCandles({
    subscribeMessage: {
      op: 'subscribe',
      args: [{
        channel: `mark-price-candle${bar}`,
        instId,
      }]
    },
    messageCallBack(candles) {
        console.log('message 1m:', decodeTimestampAgo(Number(candles.data[0].ts)), candles.data[0].c, candles.data[0].confirm)
    },
    closeCallBack(code, reason) {
        console.log('close:', code, reason.toString())
    },
    subcribedCallBack(param) {
        console.log('subcribed:', param)
    },
   })
   await setTimeout(10000)
   ws.close()
  });
  
});
