import {getSymbolCandles} from "./helper/okx-candles";
import {findEMACrossovers} from "./signals/ema-cross";
import {decodeTimestamp} from "./utils";
import {WHITE_LIST_TOKENS_TRADE} from "./utils/config";

const main = async () => {
        const candles = await getSymbolCandles({
          instID: `${WHITE_LIST_TOKENS_TRADE[0]}`,
          before: 0,
          bar: "1m",
          limit: 10000,
        });
        // console.log(SYMBOL, candles[candles.length - 1].c);
        const emaCross = findEMACrossovers(candles, 9, 21);
        console.log(emaCross.map(a => {return {...a, ts: decodeTimestamp(Math.round(a.ts))}}).slice(-3))
        // console.log(candles.map(a => {return {...a, ts: decodeTimestamp(Math.round(a.ts))}}).slice(-1))
  
        // const trades = simulateTrades(emaCross, 500);
        // console.log(
        //   `-----------------------${SYMBOL}-----------------------------`
        // );
        // console.log("Total PNL ($):", trades.totalPnL);
        // console.log("Volume ($):", trades.totalVolumeInUSD);
        // console.log("Total Tx:", trades.totalTransactions);
        // console.log(
        //   "Trade time:",
        //   trades.closedTrades[0].ts,
        //   "->",
        //   trades.closedTrades[trades.closedTrades.length - 1].ts
        // );
}
main()