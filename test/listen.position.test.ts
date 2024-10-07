import {expect} from "chai";
import {setTimeout} from "timers/promises";
import {
  getAccountOrder
} from "../bot/helper/okx.account";
import {wsPositions} from "../bot/helper/okx.socket";
import {closeFuturePosition,openFuturePosition} from "../bot/helper/okx.trade";
import {ImgnMode,IPosSide} from "../bot/type";
import {decodeTag} from "../bot/utils";

describe("OKX positions with test", () => {
  const TEST_CONFIG = {
    instId: "PEPE-USDT-SWAP",
    leverage: 5,
    size: 100,
    mgnMode: "isolated",
    posSide: "long" as IPosSide,
    campaignId: "test" + Math.random().toFixed(4).replaceAll(".", ""),
  };
  let ordId = "";
  const { campaignId, instId, mgnMode, size, posSide, leverage } = TEST_CONFIG;
  const tag = decodeTag({ campaignId, instId, leverage, posSide, size });
  it("open position OKX", async () => {
    const { openAlgoOrderRes, openPositionRes } = await openFuturePosition({
      campaignId,
      instId: instId,
      size: size,
      mgnMode: mgnMode as ImgnMode,
      posSide: posSide as IPosSide,
      leverage: leverage,
    });
    expect(openAlgoOrderRes.msg).eq("");
    expect(openPositionRes.msg).eq("");

    ordId = openPositionRes.data[0].ordId;
    const order = await getAccountOrder({ instId, ordId });
    expect(order.length).greaterThan(0);
    await setTimeout(1000);
  });
    it("OKX new candles socket test", async () => {
      const ws = wsPositions({
        authCallBack(config) {
        },
        subcribedCallBack(param) {
        },
        messageCallBack(pos) {
          expect(pos.data.length).greaterThan(0)
        },
        errorCallBack(e) {
        },
      });
      await setTimeout(3000)
      ws.close();
    });
  it("Close position OKX", async () => {
    const { closeAlgoOrderRes, closePositionRes } = await closeFuturePosition({
      instId: instId,
      mgnMode: mgnMode as ImgnMode,
      posSide: posSide as IPosSide,
      tag,
      isCloseAlgoOrders: false,
    });
    expect(closeAlgoOrderRes.msg).eq("");
    expect(closePositionRes.msg).eq("");
  });
});
