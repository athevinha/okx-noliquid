import {expect} from "chai";
import {closeAllTrailingStopWithInstId, openTrailingStopOrder} from "../bot/helper/okx.trade.algo";
import {IInstrumentsData, ImgnMode,IPosSide} from "../bot/type";
import {closeFuturePosition, openFuturePosition} from "../bot/helper/okx.trade";
import {getAccountPendingAlgoOrders} from "../bot/helper/okx.account";
import {getSupportCrypto} from "../bot/helper/okx.candles";

describe("OKX trailing stoploss test", () => {
  let supportFutureCryptosByInstId: string[] = []
  let supportFutureCryptos: IInstrumentsData[] = []
  before(async () => {
      supportFutureCryptos = [...(await getSupportCrypto({}))]
      supportFutureCryptosByInstId = supportFutureCryptos.map(e => e.instId)
  })
  const TEST_CONFIG = {
    instId: "PEPE-USDT-SWAP",
    leverage: 5,
    size: 100,
    mgnMode: "isolated" as ImgnMode,
    posSide: "long" as IPosSide,
    intervalId: "test" + Math.random().toFixed(4).replaceAll(".", ""),
    callbackRatioLoss: 0.3 
  };
  const { callbackRatioLoss, intervalId, instId, mgnMode, size, posSide, leverage } = TEST_CONFIG;
  it("open position with trailing loss", async () => {
    let statuss = await Promise.all(supportFutureCryptosByInstId.map(async spCrypto => {
      const status = await openFuturePosition({
        intervalId,
        instId: spCrypto,
        size: size,
        mgnMode: mgnMode as ImgnMode,
        posSide: posSide as IPosSide,
        leverage: leverage,
        callbackRatio: callbackRatioLoss.toString() // trailing percent ratio
      });
      return status
  }))
    expect(statuss.filter(s => s.msg === '').length).eq(supportFutureCryptosByInstId.length);
  });

  it("Fetch open pending trailing loss orders", async () => {
    const algoOrders = await getAccountPendingAlgoOrders({})
    expect(algoOrders.length).greaterThanOrEqual(supportFutureCryptosByInstId.length)
  });

  it("closes all pending trailing loss orders", async () => {
    let statuss = await Promise.all(supportFutureCryptosByInstId.map(async spCrypto => {
      const status = await closeFuturePosition({instId: spCrypto, mgnMode, posSide, isCloseAlgoOrders:true})
      return status
   }))
    expect(statuss.filter(s => s.msg === '').length).eq(supportFutureCryptosByInstId.length);
   
    const algoOrders = await getAccountPendingAlgoOrders({instId})
    expect(algoOrders.length).eq(0)
  });

});
