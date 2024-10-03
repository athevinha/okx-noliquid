import { expect } from "chai";
import { setTimeout } from "timers/promises";
import {
    getAccountBalance,
  getAccountOrder,
  getAccountPositions,
  getAccountPositionsHistory,
} from "../bot/helper/okx.account";
import {
  closeFuturePosition,
  openFuturePosition,
} from "../bot/helper/okx.trade";
import { ImgnMode, IPosSide } from "../bot/type";
import { decodeClOrdId, decodeTag, decodeTimestampAgo } from "../bot/utils";

describe("OKX balance fetch test", () => {
  const TEST_CONFIG = {
    symbol: "USDT",
   
  };
  
  it("Fetch test balance OKX", async () => {
    await Promise.all([1,2,3,4,5,6,7,8].map(async e => {
        const [balances] = await getAccountBalance()
        const usdtBal = balances.details.filter(bal => bal.ccy === TEST_CONFIG.symbol)[0]?.availBal
        expect(Number(usdtBal)).greaterThan(0)
    }))
 
  });
 
});

