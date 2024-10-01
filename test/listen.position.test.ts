import { setTimeout } from "timers/promises";
import { expect } from "chai";
import { wsPositions, wsTicks } from "../bot/helper/okx.socket";
import { getSymbolCandles } from "../bot/helper/okx.candles";
import { calculateATR } from "../bot/signals/atr";
import { makeWsAuth } from "../bot/helper/auth";
import { getAccountPendingAlgoOrders } from "../bot/helper/okx.account";
import { IPositionOpen } from "../bot/type";

// describe("OKX socket test ticker", () => {
//   const { instID, bar } = {
//     bar: "1m",
//     instID: "BTC-USDT-SWAP",
//   };
//   it("OKX new candles socket test", async () => {

//     ws.close();
//   });
// });

const calculateATRWithWs = async ({instIds, bar}: {instIds:string[], bar:string}) => {

  let candles = await getSymbolCandles({
    instID: instIds[0],
    bar,
    before: 0,
    limit: 3000,
  });
  const atrs = calculateATR(candles, 14);
  let currentATR = atrs[atrs.length - 1].atr;
  
  const ws = wsTicks({
    subscribeMessage: {
      op: "subscribe",
      args: instIds.map((instId) => ({
          channel: 'mark-price',
          instId: instId,
        }))
    },
    subcribedCallBack(param) {console.log(param)},
    messageCallBack(mark) {
      const markPrice = Number(mark.data[0].markPx);
      if(markPrice < candles[candles.length - 1].l) candles[candles.length - 1].l = markPrice
      if(markPrice > candles[candles.length - 1].h) candles[candles.length - 1].h = markPrice
      candles[candles.length - 1].c = markPrice
      currentATR =  calculateATR(candles, 14).slice(-1)[0].atr
    },
    errorCallBack(e) {console.log(e)},
  });
}

const trailingWithWs = async (openPos: IPositionOpen[]) => {
  try {
    const algoOrders = await getAccountPendingAlgoOrders({});
    openPos.filter((pos) => {
      // const isClosed = !pos.avgPx;
      const algoOrder = algoOrders.filter(
        (aOrd) => aOrd.instId === pos.instId
      )?.[0];
      if (algoOrder?.moveTriggerPx || algoOrder?.callbackRatio) return false; // Already set a trailing loss orders
      return true
    });
    calculateATRWithWs({instIds: openPos.map(pos => pos.instId), bar: '1H'})
  } catch (error) {
    console.log(error);
  }
};

const ws = wsPositions({
  authCallBack(config) {
    console.log(config);
  },
  subcribedCallBack(param) {
    console.log(param);
  },
  messageCallBack(pos) {
    console.log("------------------------");
    trailingWithWs(pos.data);
  },
  errorCallBack(e) {
    console.log(e);
  },
});
