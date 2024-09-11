import { expect } from "chai";
import {
  getCandlesWithLimit,
  getSupportCrypto,
  getSymbolCandles,
} from "../bot/helper/okx.candles";
import { setTimeout } from "timers/promises";
import { IInstrumentsData } from "../bot/type";

describe("OKX candles test fetch", () => {
  let supportFutureCryptosByInstId: string[] = [];
  let supportFutureCryptos: IInstrumentsData[] = [];
  before(async () => {
    supportFutureCryptos = [
      ...(await getSupportCrypto({})),
      ...(await getSupportCrypto({})),
    ];
    supportFutureCryptosByInstId = supportFutureCryptos.map((e) => e.instId);
  });
  it("Can fetch multi contract (Future) candles", async () => {
    let candles = await Promise.all(
      supportFutureCryptosByInstId.map(async (spCrypto) => {
        return await getSymbolCandles({
          before: 0,
          instID: spCrypto,
          bar: "15m",
          limit: 300,
        });
      }),
    );
    expect(supportFutureCryptos.length).eq(
      candles.filter((c) => c.length >= 200).length,
    );
    expect(candles.filter((c) => c.length === 0).length).eq(0);
  });
  it("Can fetch more candles candles", async () => {
    const LIMIT = 1000;
    let candles = await Promise.all(
      supportFutureCryptosByInstId.map(async (spCrypto) => {
        return await getCandlesWithLimit({
          instID: spCrypto,
          bar: "1m",
          limit: LIMIT,
        });
      }),
    );
    expect(candles.filter((c) => c.length === 1000).length).eq(candles.length);
    expect(supportFutureCryptos.length).eq(
      candles.filter((c) => c.length >= 200).length,
    );
    expect(candles.filter((c) => c.length === 0).length).eq(0);
  });
});
