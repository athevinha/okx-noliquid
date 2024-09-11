import { expect } from "chai";
import { getSupportCrypto } from "../bot/helper/okx.candles";
import { convertUSDToContractOrderSize } from "../bot/helper/okx.trade";
import { IInstrumentsData } from "../bot/type";

describe("OKX convert size to contract", () => {
  let supportFutureCryptosByInstId: string[] = [];
  let supportFutureCryptos: IInstrumentsData[] = [];
  before(async () => {
    supportFutureCryptos = [
      ...(await getSupportCrypto({})),
      ...(await getSupportCrypto({})),
      ...(await getSupportCrypto({})),
    ];
    supportFutureCryptosByInstId = supportFutureCryptos.map((e) => e.instId);
  });
  it("Can fetch multi contract (Future) size", async () => {
    let contract = await Promise.all(
      supportFutureCryptosByInstId.map(async (spCrypto) => {
        return await convertUSDToContractOrderSize({
          instId: spCrypto,
          sz: 100,
        });
      }),
    );
    expect(contract.length).eq(supportFutureCryptosByInstId.length);
    expect(contract.filter((sz) => sz.length === 0).length).eq(0);
  });
});
