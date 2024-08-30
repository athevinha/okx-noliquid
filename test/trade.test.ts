import {expect} from 'chai';
import {getSupportCrypto,getSymbolCandles} from '../bot/helper/okx-candles';
import {findEMACrossovers, simulateTrades} from '../bot/signals/ema-cross';
import {decodeSymbol, decodeTimestamp, decodeTimestampAgo, zerofy} from '../bot/utils';

const EMA_CROSS_BACK_TEST_CONFIG = {
    FEE_PERCENTAGE: 0.18, // Open & Close Fee
    BAR: "1H",
    SHORT_EMA: 9,
    LONG_EMA: 21,
    LEVERAGE: 5,
    SZ_USD: 500,
  };
describe('OKX EMA Cross backtest', () => {
    it('Trade multi contract (Future)', async () => {
        let totalPnL = 0;
        let earliestTradeTimestamp = 0;
        let totalTradeVolume = 0;
        const supportFutureCryptos = (await getSupportCrypto({}))
        const supportFutureCryptosByInstId = supportFutureCryptos.map(e => e.instId)
        let lostCount = 0
        let winCount = 0
      
        const results = (await Promise.all(
          supportFutureCryptosByInstId.map(async (symbol) => {
            const candles = await getSymbolCandles({
              instID: `${symbol}`,
              before: 0,
              bar: EMA_CROSS_BACK_TEST_CONFIG.BAR,
              limit: 300,
            });
            const emaCrossovers = findEMACrossovers(
              candles,
              EMA_CROSS_BACK_TEST_CONFIG.SHORT_EMA,
              EMA_CROSS_BACK_TEST_CONFIG.LONG_EMA
            );
            // console.log(symbol, {...emaCrossovers[emaCrossovers.length - 1], ts: decodeTimestamp(emaCrossovers[emaCrossovers.length - 1].ts)})
            const tradeResults = simulateTrades(
              emaCrossovers,
              EMA_CROSS_BACK_TEST_CONFIG.SZ_USD,
              candles[candles.length - 1].c
            );
            totalPnL += tradeResults.totalPnL;
            if(tradeResults.totalPnL <= 0) lostCount++;
            else winCount++;
            totalTradeVolume += tradeResults.totalVolumeInUSD;
            earliestTradeTimestamp = Number(candles[0]?.ts);
      
            return {
              symbol,
              totalPnL: tradeResults.totalPnL,
              volume: tradeResults.totalVolumeInUSD,
              totalTransactions: tradeResults.totalTransactions,
              startTradeTime: tradeResults.closedTrades[0]?.ts,
              endTradeTime:
                tradeResults.closedTrades[tradeResults.closedTrades.length - 1]?.ts,
            };
          })
        )).filter(res => res);
      
        // Rank symbols by PnL
        const rankedResults = results.sort((a, b) => a.totalPnL - b.totalPnL);
    
        console.table(
          rankedResults.map((result, index) => ({
            Symbol: result.symbol.split('-')[0],
            "PnL ($)": zerofy(result.totalPnL),
            "Volume ($)": zerofy(result.volume),
            Transactions: result.totalTransactions,
            "Est. Trade Time:": decodeTimestampAgo(result.startTradeTime),
          }))
        );
        console.log(`------------------------SUMMARY----------------------------`);
        const Fee = (totalTradeVolume * EMA_CROSS_BACK_TEST_CONFIG.FEE_PERCENTAGE) / 100
        const PercentPnl = ((totalPnL - Fee) / ((EMA_CROSS_BACK_TEST_CONFIG.SZ_USD / EMA_CROSS_BACK_TEST_CONFIG.LEVERAGE) * supportFutureCryptos.length)) * 100
        console.log("Est. Lost/Win:", `${lostCount}/${winCount}`);
        console.log("Est. Trade Time:", decodeTimestampAgo(earliestTradeTimestamp));
        console.log("Est. Total Volume ($):", zerofy(totalTradeVolume));
        console.log("Est. Total Fee ($):",zerofy(Fee));
        console.log("Est. Total PnL ($):", zerofy(totalPnL));
        console.log("Est. Realized PnL ($):",zerofy(totalPnL - Fee));
        console.log("Est. Percent Realized PnL :", zerofy(PercentPnl) + '%');
        expect(supportFutureCryptos.length).eq(rankedResults.length)
    });
});
