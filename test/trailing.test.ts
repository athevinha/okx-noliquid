import {expect} from "chai";
import {closeAllTrailingStopWithInstId, openTrailingStopOrder} from "../bot/helper/okx.trade.algo";
import {ImgnMode,IPosSide} from "../bot/type";
import {closeFuturePosition, openFuturePosition} from "../bot/helper/okx.trade";
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
  it("open position with trailing loss", async () => {
    const status = await openFuturePosition({
      intervalId,
      instId: instId,
      size: size,
      mgnMode: mgnMode as ImgnMode,
      posSide: posSide as IPosSide,
      leverage: leverage,
      callbackRatio: callbackRatioLoss.toString() // trailing percent ratio
    });
    expect(status.msg).eq("");
  });

  it("Fetch open pending trailing loss orders", async () => {
    const algoOrders = await getAccountPendingAlgoOrders({instId})
    expect(algoOrders.length).greaterThan(0)
  });

  it("closes all pending trailing loss orders", async () => {
    const status = await closeFuturePosition({instId, mgnMode, posSide, isCloseAlgoOrders:true})
    expect(status.msg).eq('')
    const algoOrders = await getAccountPendingAlgoOrders({instId})
    expect(algoOrders.length).eq(0)
  });

});
