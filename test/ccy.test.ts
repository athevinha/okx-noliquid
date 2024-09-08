import { expect } from "chai";
import { WHITE_LIST_TOKENS_TRADE } from "../bot/utils/config";
import { getSupportCrypto, getSymbolCandles } from "../bot/helper/okx.candles";
import {getCurrencyInfo} from "../bot/helper/okx.ccy";

describe("OKX crypto test fetch infor", () => {
  it("Can fetch multi CCY info", async () => {
    const supportFutureCryptos = await getSupportCrypto({});
    const supportFutureCryptosByInstId = supportFutureCryptos.map(
      (e) => e.instId
    );
    const ccyDatas = await Promise.all(
      supportFutureCryptosByInstId.map(async (spCrypto) => {
        return await getCurrencyInfo(spCrypto.split('-')[0])
      })
    );
    expect(supportFutureCryptos.length).eq(
        ccyDatas.filter((c) => c?.marketCap).length
      );
  });
});
