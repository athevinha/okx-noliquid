import { expect } from "chai";
import {
  closeAlgoWithInstId,
  openTrailingStopOrder,
} from "../bot/helper/okx.trade.algo";
import { IInstrumentsData, ImgnMode, IPosSide } from "../bot/type";
import {
  closeFuturePosition,
  openFuturePosition,
} from "../bot/helper/okx.trade";
import { getAccountPendingAlgoOrders } from "../bot/helper/okx.account";
import { getSupportCrypto } from "../bot/helper/okx.candles";

describe("OKX trailing stoploss test", () => {
  let supportFutureCryptosByInstId: string[] = [];
  let supportFutureCryptos: IInstrumentsData[] = [];
  before(async () => {
    supportFutureCryptos = [...(await getSupportCrypto({}))];
    supportFutureCryptosByInstId = supportFutureCryptos.map((e) => e.instId);
  });
  const TEST_CONFIG = {
    instId: "PEPE-USDT-SWAP",
    leverage: 5,
    size: 1520,
    mgnMode: "isolated" as ImgnMode,
    posSide: "long" as IPosSide,
    campaignId: "test" + Math.random().toFixed(4).replaceAll(".", ""),
    callbackRatioLoss: 0.01,
  };
  const {
    callbackRatioLoss,
    campaignId,
    instId,
    mgnMode,
    size,
    posSide,
    leverage,
  } = TEST_CONFIG;
  it("open position with trailing loss", async () => {
    const res = await openFuturePosition({
      campaignId,
      instId: "BTC-USDT-SWAP",
      size: size,
      mgnMode: mgnMode as ImgnMode,
      posSide: posSide as IPosSide,
      leverage: leverage,
      callbackRatio: callbackRatioLoss.toString(), // trailing percent ratio
      trailActiveAvgPx: '100000'
    });
    // let statuss = await Promise.all(
    //   supportFutureCryptosByInstId.map(async (spCrypto) => {
    //     const res = await openFuturePosition({
    //       campaignId,
    //       instId: spCrypto,
    //       size: size,
    //       mgnMode: mgnMode as ImgnMode,
    //       posSide: posSide as IPosSide,
    //       leverage: leverage,
    //       callbackRatio: callbackRatioLoss.toString(), // trailing percent ratio
    //     });
    //     return res;
    //   }),
    // );
    // expect(statuss.filter((s) => s.openAlgoOrderRes.msg === "").length).eq(
    //   supportFutureCryptosByInstId.length,
    // );
    // expect(statuss.filter((s) => s.openPositionRes.msg === "").length).eq(
    //   supportFutureCryptosByInstId.length,
    // );
  });

  it("Fetch open pending trailing loss orders", async () => {
    await Promise.all(
      [1].map(async (e) => {
        const algo = await getAccountPendingAlgoOrders({});
        console.log(algo)
        expect(algo.length).greaterThanOrEqual(1);
      }),
    );
  });

  it("closes all pending trailing loss orders", async () => {
    let statuss = await Promise.all(
      supportFutureCryptosByInstId.map(async (spCrypto) => {
        const res = await closeFuturePosition({
          instId: spCrypto,
          mgnMode,
          posSide,
          isCloseAlgoOrders: true,
        });
        return res;
      }),
    );
    const algoOrders = await getAccountPendingAlgoOrders({ instId });
    expect(algoOrders.length).eq(0);
  });
});
