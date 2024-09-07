import { expect } from "chai";
import { setTimeout } from "timers/promises";
import {
  getAccountOrder,
  getAccountPositionsHistory,
} from "../bot/helper/okx-account";
import {
  closeFuturePosition,
  openFuturePosition,
} from "../bot/helper/okx-trade";
import { ImgnMode, IPosSide } from "../bot/type";
import { decodeClOrdId, decodeTag, decodeTimestampAgo } from "../bot/utils";

describe("OKX positions with test", () => {
  const TEST_CONFIG = {
    instId: "PEPE-USDT-SWAP",
    leverage: 5,
    size: 100,
    mgnMode: "isolated",
    posSide: "long" as IPosSide,
    intervalId: "test" + Math.random().toFixed(4).replaceAll(".", ""),
  };
  let ordId = "";
  const { intervalId, instId, mgnMode, size, posSide, leverage } = TEST_CONFIG;
  const clOrdId = decodeClOrdId({
    intervalId,
    instId,
    leverage,
    posSide,
    size,
  });
  const tag = decodeTag({ intervalId, instId, leverage, posSide, size });
  it("open position OKX", async () => {
    const status = await openFuturePosition({
      intervalId,
      instId: instId,
      size: size,
      mgnMode: mgnMode as ImgnMode,
      posSide: posSide as IPosSide,
      leverage: leverage,
    });
    expect(status.msg).eq("");
    ordId = status.data[0].ordId;
    expect(status.data[0].clOrdId).eq(clOrdId);
    const order = await getAccountOrder({ instId, ordId });
    expect(order.length).greaterThan(0);
    await setTimeout(1000);
  });
  it("open position test with proxy and retry OKX", async () => {
    await Promise.all(
      [1, 2, 3, 4, 5, 6, 7].map(async (e) => {
        const status = await openFuturePosition({
          intervalId,
          instId: instId,
          size: size,
          mgnMode: mgnMode as ImgnMode,
          posSide: posSide as IPosSide,
          leverage: leverage,
        });
        if (status.msg !== "") console.log(e);
        expect(status.msg).eq("");
        ordId = status.data[0].ordId;
        expect(status.data[0].clOrdId).eq(clOrdId);
        const order = await getAccountOrder({ instId, ordId });
        expect(order.length).greaterThan(0);
      })
    );
    await setTimeout(1000);
  });
  it("Close position OKX", async () => {
    const status = await closeFuturePosition({
      instId: instId,
      mgnMode: mgnMode as ImgnMode,
      posSide: posSide as IPosSide,
      tag,
    });
    expect(status.msg).eq("");
    expect(status.data.length).greaterThan(0);
  });

  it("get history positions OKX", async () => {
    await setTimeout(3000);
    const positions = await getAccountPositionsHistory("SWAP");
    const position = positions[0];
    expect(position.instId).eq(instId);
  });
});
