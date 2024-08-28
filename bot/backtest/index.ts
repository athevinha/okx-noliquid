import { getAccountPositions } from "../helper/okx-account";
import { getSymbolCandles } from "../helper/okx-candles";
import { findEMACrossovers, simulateTrades } from "../signals/ema-cross";
import { decodeTimestamp, decodeTimestampAgo, zerofy } from "../utils";
import { WHITE_LIST_TOKENS_TRADE } from "../utils/config";

const EMA_CROSS_BACK_TEST_CONFIG = {
  FEE_PERCENTAGE: 0.18, // Open & Close Fee
  BAR: "15m",
  SHORT_EMA: 9,
  LONG_EMA: 21,
};
const main = async () => {
  let totalPnL = 0;
  let earliestTradeTimestamp = 0;
  let totalTradeVolume = 0;

  const results = await Promise.all(
    WHITE_LIST_TOKENS_TRADE.map(async (symbol) => {
      const candles = await getSymbolCandles({
        instID: `${symbol}`,
        before: 0,
        bar: EMA_CROSS_BACK_TEST_CONFIG.BAR,
        limit: 1000,
      });
      
      const emaCrossovers = findEMACrossovers(
        candles,
        EMA_CROSS_BACK_TEST_CONFIG.SHORT_EMA,
        EMA_CROSS_BACK_TEST_CONFIG.LONG_EMA
      );
      const tradeResults = simulateTrades(
        emaCrossovers,
        500,
        candles[candles.length - 1].c
      );

      totalPnL += tradeResults.totalPnL;
      totalTradeVolume += tradeResults.totalVolumeInUSD;
      earliestTradeTimestamp = Number(candles[0].ts);

      return {
        symbol,
        totalPnL: tradeResults.totalPnL,
        volume: tradeResults.totalVolumeInUSD,
        totalTransactions: tradeResults.totalTransactions,
        startTradeTime: tradeResults.closedTrades[0].ts,
        endTradeTime:
          tradeResults.closedTrades[tradeResults.closedTrades.length - 1].ts,
      };
    })
  );

  // Rank symbols by PnL
  const rankedResults = results.sort((a, b) => b.totalPnL - a.totalPnL);

  console.log(`----------------------------------------------------`);
  console.table(
    rankedResults.map((result, index) => ({
      Rank: index + 1,
      Symbol: result.symbol,
      "PnL ($)": zerofy(result.totalPnL),
      "Volume ($)": zerofy(result.volume),
      Transactions: result.totalTransactions,
      "Start Trade Time": result.startTradeTime,
      "End Trade Time": result.endTradeTime,
    }))
  );

  console.log("Est. Trade Time:", decodeTimestampAgo(earliestTradeTimestamp));
  console.log("Est. Total Volume ($):", zerofy(totalTradeVolume));
  console.log(
    "Est. Total Fee ($):",
    zerofy((totalTradeVolume * EMA_CROSS_BACK_TEST_CONFIG.FEE_PERCENTAGE) / 100)
  );
  console.log("Est. Total PnL ($):", zerofy(totalPnL));
  console.log(
    "Est. Realized PnL ($):",
    zerofy(
      totalPnL -
        (totalTradeVolume * EMA_CROSS_BACK_TEST_CONFIG.FEE_PERCENTAGE) / 100
    )
  );
};

main();
