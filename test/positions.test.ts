import {expect} from "chai";
import {closeFuturePosition, openFuturePosition} from "../bot/helper/okx-trade";
import {ImgnMode, IPosSide} from "../bot/type";
import {getAccountOrder, getAccountPosition, getAccountPositions} from "../bot/helper/okx-account";
import {setTimeout} from "timers/promises";
import {decodeClOrdId} from "../bot";

describe("OKX positions test", () => {
  const TEST_CONFIG = {
    instId: 'PEPE-USDT-SWAP',
    leverage: 5,
    size: 100,
    mgnMode: 'isolated',
    posSide: 'long' as IPosSide,
    intervalId: 'test_positions_okx'
  };
  let ordId= ''
  const {intervalId, instId, mgnMode, size, posSide, leverage} = TEST_CONFIG
  const clOrdId = decodeClOrdId({intervalId, instId, leverage, posSide, size})
  it("Open position OKX", async () => {
    const status = await openFuturePosition({
      intervalId,
      instId: instId,
      size: size,
      mgnMode: mgnMode as ImgnMode,
      posSide: posSide as IPosSide,
      leverage: leverage
    })
    expect(status.msg).eq("")
    ordId = status.data[0].ordId
    expect(status.data[0].clOrdId).eq(clOrdId)
    const order = await getAccountOrder(instId,ordId)
    expect(order.length).greaterThan(0)
    await setTimeout(1000)
  });
  it("Close position OKX", async () => {
    const status = await closeFuturePosition({
      instId: instId,
      mgnMode: mgnMode as ImgnMode,
      posSide: posSide as IPosSide,
    })
    expect(status.msg).eq("")
    expect(status.data.length).greaterThan(0)
  });

  it("Close all position OKX", async () => {
  
  });
});
