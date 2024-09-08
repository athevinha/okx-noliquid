import {expect} from "chai";
import {openTrailingStopOrder} from "../bot/helper/okx.trade.algo";
import {ImgnMode,IPosSide} from "../bot/type";
import {openFuturePosition} from "../bot/helper/okx.trade";
import {getAccountPendingAlgoOrders} from "../bot/helper/okx.account";

describe("OKX trailing stoploss test", () => {
  const TEST_CONFIG = {
    instId: "PEPE-USDT-SWAP",
    leverage: 5,
    size: 100,
    mgnMode: "isolated" as ImgnMode,
    posSide: "long" as IPosSide,
    intervalId: "test" + Math.random().toFixed(4).replaceAll(".", ""),
    callbackRatioLoss: 0.04 
  };
  const { callbackRatioLoss, intervalId, instId, mgnMode, size, posSide, leverage } = TEST_CONFIG;
  // it("Open Position", async () => {
  //   const status = await openFuturePosition({
  //     intervalId,
  //     instId: instId,
  //     size: size,
  //     mgnMode: mgnMode as ImgnMode,
  //     posSide: posSide as IPosSide,
  //     leverage: leverage,
  //   });
  //   expect(status.msg).eq("");
  // });

  // it("Fill Trailing SL", async () => {
  //   const status = await openTrailingStopOrder({
  //     instId,
  //     mgnMode,
  //     posSide,
  //     callbackRatio: callbackRatioLoss.toString(),
  //     size: size
  //   })
  //   console.log(status)
  //   expect(status.msg).eq("");
  // });
 
  it("Open position and trailing loss", async () => {
    const status = await openFuturePosition({
      intervalId,
      instId: instId,
      size: size,
      mgnMode: mgnMode as ImgnMode,
      posSide: posSide as IPosSide,
      leverage: leverage,
      callbackRatio: callbackRatioLoss.toString()
    });
    expect(status.msg).eq("");
  });

  it("Fetch open pending trailing loss orders", async () => {
    const algoOrders = await getAccountPendingAlgoOrders({})
    console.log(algoOrders)
  });
  
  
  // it("Close position with trailing loss fill", async () => {
  //   const status = await closeFuturePosition({
  //     instId: instId,
  //     mgnMode: mgnMode as ImgnMode,
  //     posSide: posSide as IPosSide,
  //   });
  //   expect(status.msg).eq("");
  //   expect(status.data.length).greaterThan(0);
  // });
 

});
