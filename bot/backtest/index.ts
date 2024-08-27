import {getAccountPositions} from "../helper/okx-account";
import {getSymbolCandles} from "../helper/okx-candles";
import {findEMACrossovers, simulateTrades} from "../signals/ema-cross";
import {WHITE_LIST_TOKENS_TRADE} from "../utils/config";

const main = async () => {
  await Promise.all(
    WHITE_LIST_TOKENS_TRADE.map(async (SYMBOL) => {
      const candles = await getSymbolCandles({
        instID: `${SYMBOL}`,
        before: 0,
        bar: "15m",
        limit: 10000,
      });
      const emaCross = findEMACrossovers(candles, 9, 21);
      const trades = simulateTrades(emaCross, 500);
      console.log(
        `-----------------------${SYMBOL}-----------------------------`
      );
      console.log("Total PNL ($):", trades.totalPnL);
      console.log("Volume ($):", trades.totalVolumeInUSD);
      console.log("Total Tx:", trades.totalTransactions);
      console.log(
        "Trade time:",
        trades.closedTrades[0].ts,
        "->",
        trades.closedTrades[trades.closedTrades.length - 1].ts
      );
    })
  );
}
main()