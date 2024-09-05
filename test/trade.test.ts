import {expect} from "chai";
import {
  getCandlesWithLimit,
  getSupportCrypto
} from "../bot/helper/okx-candles";
import {
  findEMACrossovers,
  simulateTradesEmaCross
} from "../bot/signals/ema-cross";
import {
  decodeTimestamp,
  decodeTimestampAgo,
  zerofy
} from "../bot/utils";
import {WHITE_LIST_TOKENS_TRADE} from "../bot/utils/config";
// 1D 9 21
// 4H 9 21
const TEST_CONFIG = {
  FEE_PERCENTAGE: 0.18, // Open & Close Fee
  BAR: "4H",
  SHORT_EMA: 9,
  LONG_EMA: 21,
  LEVERAGE: 5,
  SZ_USD: 1000,
  WHITE_LIST_TRADING: true,
  SLOPE_THRESHOLD_UP: undefined,
  SLOPE_THRESHOLD_UNDER: 1.5,
  LOG_HISTORY_TRADE: true,
  LOG_PNL_DETAILS: true,
};
describe("OKX EMA Cross backtest", () => {
  it("Trade whitelist contract (Future)", async () => {
    let totalPnL = 0;
    let earliestTradeTimestamp = 0;
    let totalTradeVolume = 0;

    let supportFutureCryptosByInstId = WHITE_LIST_TOKENS_TRADE;
    if (!TEST_CONFIG.WHITE_LIST_TRADING) {
      const supportFutureCryptos = await getSupportCrypto({});
      supportFutureCryptosByInstId = supportFutureCryptos.map((e) => e.instId);
    }
    let lostCount = 0;
    let winCount = 0;
    const results = (
      await Promise.all(
        supportFutureCryptosByInstId.map(async (symbol) => {
          const candles = await getCandlesWithLimit({
            instID: `${symbol}`,
            bar: TEST_CONFIG.BAR,
            limit: 300,
          });
          const emaCrossovers = findEMACrossovers(
            candles,
            TEST_CONFIG.SHORT_EMA,
            TEST_CONFIG.LONG_EMA
          );
          const tradeResults = simulateTradesEmaCross(
            emaCrossovers,
            TEST_CONFIG.SZ_USD,
            candles[candles.length - 1].c,
            TEST_CONFIG.SLOPE_THRESHOLD_UNDER,
            TEST_CONFIG.SLOPE_THRESHOLD_UP
          );
          if (TEST_CONFIG.LOG_HISTORY_TRADE)
            console.table(
              tradeResults.historyTrades.map((result, index) => ({
                Time: decodeTimestamp(result.ts),
                "PnL ($)": zerofy(result.pnl),
                Exit: zerofy(result.exitPrice || 0),
                Entry: zerofy(result.entryPrice || 0),
                "Slope Diveder": zerofy(result.slopeThreshold || 0),
                Type: result.positionType,
                Action: result.action,
              }))
            );
          totalPnL += tradeResults.totalPnL;
          if (tradeResults.totalPnL <= 0) lostCount++;
          else winCount++;
          totalTradeVolume += tradeResults.totalVolumeInUSD;
          earliestTradeTimestamp = Number(candles[0]?.ts);

          return {
            symbol,
            totalPnL: tradeResults.totalPnL,
            volume: tradeResults.totalVolumeInUSD,
            totalTransactions: tradeResults.totalTransactions,
            startTradeTime: tradeResults.historyTrades[0]?.ts,
            endTradeTime:
              tradeResults.historyTrades[tradeResults.historyTrades.length - 1]
                ?.ts,
          };
        })
      )
    ).filter((res) => res);

    // Rank symbols by PnL
    const rankedResults = results.sort(
      (a, b) => Number(a.totalPnL) - Number(b.totalPnL)
    );

    if (TEST_CONFIG.LOG_PNL_DETAILS)
      console.table(
        rankedResults.map((result, index) => ({
          Symbol: result.symbol.split("-")[0],
          "PnL ($)": zerofy(result.totalPnL),
          "Volume ($)": zerofy(result.volume),
          Transactions: result.totalTransactions,
          "Est. Trade Time:": decodeTimestampAgo(result.startTradeTime),
        }))
      );
    console.log(`------------------------SUMMARY----------------------------`);
    const Fee = (totalTradeVolume * TEST_CONFIG.FEE_PERCENTAGE) / 100;
    const PercentPnl =
      ((totalPnL - Fee) /
        ((TEST_CONFIG.SZ_USD / TEST_CONFIG.LEVERAGE) *
          supportFutureCryptosByInstId.length)) *
      100;
    console.log("Est. Lost/Win:", `${lostCount}/${winCount}`);
    console.log("Est. Trade Time:", decodeTimestampAgo(earliestTradeTimestamp));
    console.log("Est. Total Volume ($):", zerofy(totalTradeVolume));
    console.log("Est. Total Fee ($):", zerofy(Fee));
    console.log("Est. Total PnL ($):", zerofy(totalPnL));
    console.log("Est. Realized PnL ($):", zerofy(totalPnL - Fee));
    console.log("Est. Percent Realized PnL :", zerofy(PercentPnl) + "%");
    expect(supportFutureCryptosByInstId.length).eq(rankedResults.length);
  });
});
