import {getAccountPositions} from "../helper/okx-account";
import {getSymbolCandles} from "../helper/okx-candles";
import {findEMACrossovers, simulateTrades} from "../signals/ema-cross";
import {decodeTimestamp, decodeTimestampAgo, zerofy} from "../utils";
import {WHITE_LIST_TOKENS_TRADE} from "../utils/config";

const main = async () => {
  let estTotalPnl = 0
  let startTime = 0
  let totalVolume = 0
  const FEE = 0.02 // open & close
  await Promise.all(
    WHITE_LIST_TOKENS_TRADE.map(async (SYMBOL) => {
      const candles = await getSymbolCandles({
        instID: `${SYMBOL}`,
        before: 0,
        bar: "15m",
        limit: 10000,
      });

      const emaCross = findEMACrossovers(candles, 9, 21);
      console.log(emaCross.slice(-3).map(e => {
        return {
          ...e,
          ts: decodeTimestamp(e.ts)
        }
      }))
      const trades = simulateTrades(emaCross, 500, candles[candles.length - 1].c);
      console.log(
        `-----------------------${SYMBOL}-----------------------------`
      );
      console.log("Total PNL ($):", trades.totalPnL);
      estTotalPnl += trades.totalPnL
      console.log("Volume ($):", trades.totalVolumeInUSD);
      console.log("Total Tx:", trades.totalTransactions);
      startTime = Number(candles[0].ts)
      totalVolume += trades.totalVolumeInUSD

      console.log(
        "Trade time:",
        trades.closedTrades[0].ts,
        "->",
        trades.closedTrades[trades.closedTrades.length - 1].ts
      );
    })
  );
  console.log(
    `----------------------------------------------------`
  );
  console.log("Est. Trade time:", decodeTimestampAgo(startTime));
  console.log("Est. Volume ($):", zerofy(totalVolume));
  console.log("Est. Fee ($):", zerofy(totalVolume * FEE / 100));
  console.log("Est. All total Pnl ($):", zerofy(estTotalPnl));
  console.log("Est. All realize Pnl ($):", zerofy(estTotalPnl - (totalVolume * FEE / 100)));

}
main()