import {decode} from "punycode";
import {ICandles, ICandlesEMACrossovers} from "../type";
import {decodeTimestamp} from "../utils";

/**
 * Calculate EMA for each candle's closing price.
 * @param candles - Array of candle data.
 * @param periods - The number of periods to calculate the EMA.
 * @returns Array of EMA values corresponding to each timestamp.
 */
export function calculateEMA(candles: ICandles, periods: number): Array<{ ts: number; ema: number }> {
  const multiplier = 2 / (periods + 1);
  let ema = 0;
  let initialSMA = 0;

  return (candles.map((candle, index) => {
    const { c: closePrice, ts } = candle;

    if (index < periods) {
      initialSMA += closePrice;
      if (index === periods - 1) {
        initialSMA /= periods;
        ema = initialSMA;
      }
      return { ts, ema: index === periods - 1 ? ema : 0 };  // No EMA until we have enough periods
    } else {
      ema = (closePrice - ema) * multiplier + ema;
      return { ts, ema };
    }
  }).filter(candle => candle.ema !== 0));  // Remove entries without EMA values
}

/**
 * Detect EMA crossovers and return crossover points.
 * @param candles - Array of candle data.
 * @param shortPeriods - Periods for the short-term EMA.
 * @param longPeriods - Periods for the long-term EMA.
 * @returns Array of crossover points with their type (bullish or bearish).
 */
export function findEMACrossovers(candles: ICandles, shortPeriods: number, longPeriods: number): ICandlesEMACrossovers {
  const longEMA = calculateEMA(candles, longPeriods);
  const shortEMA = calculateEMA(candles, shortPeriods).filter(ema => ema.ts >= longEMA[0].ts);
  const crossovers: ICandlesEMACrossovers = [];
  // We start comparing only after both shortEMA and longEMA have valid values
  for (let i = 0; i < shortEMA.length && i < longEMA.length; i++) {
    const prevShortEMA = shortEMA[i - 1]?.ema;
    const prevLongEMA = longEMA[i - 1]?.ema;
    const currentShortEMA = shortEMA[i].ema;
    const currentLongEMA = longEMA[i].ema;

    // Detect a bullish crossover (short EMA crosses above long EMA)
    if (prevShortEMA <= prevLongEMA && currentShortEMA > currentLongEMA) {
      
      crossovers.push({
        ...candles.filter((candle) => shortEMA[i].ts === candle.ts)[0],
        type: 'bullish',  // Buy signal
        shortEMA: currentShortEMA,
        longEMA: currentLongEMA
      });
    }

    // Detect a bearish crossover (short EMA crosses below long EMA)
    if (prevShortEMA >= prevLongEMA && currentShortEMA < currentLongEMA) {
      crossovers.push({
        ...candles.filter((candle) => longEMA[i].ts === candle.ts)[0],
        type: 'bearish',  // Sell signal
        shortEMA: currentShortEMA,
        longEMA: currentLongEMA
      });
    }
  }

  return crossovers;
}

type Position = {
  type: 'long' | 'short';
  entryPrice: number;
  entryTime: number;
  baseTokenAmount: number; // Amount of tokens bought/sold using the USD volume
  usdVolume: number; // USD used for the trade
};

type TradeResult = {
  ts:string,
  positionType: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  usdVolume: number;
};

export function simulateTrades(emaCrossovers: ICandlesEMACrossovers, usdVolume: number, currentPrice: number) {
  let positions: Position[] = [];
  let closedTrades: TradeResult[] = [];
  let totalTransactions = 0;
  let totalVolumeInUSD = 0;

  emaCrossovers.forEach((crossover) => {
    const { ts, c, type } = crossover;

    if (type === 'bullish') {
      // Close any open short positions and calculate PnL
      positions = positions.filter((position) => {
        if (position.type === 'short') {
          const pnl = (position.entryPrice - c) * position.baseTokenAmount; // Short PnL = (entry price - exit price) * base token amount
          closedTrades.push({
            ts: decodeTimestamp(ts),
            positionType: position.type,
            entryPrice: position.entryPrice,
            exitPrice: c,
            pnl,
            usdVolume: position.usdVolume,
          });
          totalVolumeInUSD += position.usdVolume;
          totalTransactions++;
          // console.log(`Closing SHORT position at ${c} on ${new Date(ts * 1000)} with PnL: ${pnl}`);
          return false;
        }
        return true;
      });

      // Open a new long position
      const baseTokenAmount = usdVolume / c; // Calculate how much base token is bought with the given USD
      positions.push({ type: 'long', entryPrice: c, entryTime: ts, baseTokenAmount, usdVolume });
      // console.log(`Opening LONG position at ${c} on ${new Date(ts * 1000)}, buying ${baseTokenAmount} tokens`);
    } else if (type === 'bearish') {
      // Close any open long positions and calculate PnL
      positions = positions.filter((position) => {
        if (position.type === 'long') {
          const pnl = (c - position.entryPrice) * position.baseTokenAmount; // Long PnL = (exit price - entry price) * base token amount
          closedTrades.push({
            ts: decodeTimestamp(ts),
            positionType: position.type,
            entryPrice: position.entryPrice,
            exitPrice: c,
            pnl,
            usdVolume: position.usdVolume,
          });
          totalVolumeInUSD += position.usdVolume;
          totalTransactions++;
          // console.log(`Closing LONG position at ${c} on ${new Date(ts * 1000)} with PnL: ${pnl}`);
          return false;
        }
        return true;
      });

      // Open a new short position
      const baseTokenAmount = usdVolume / c; // Calculate how much base token is sold with the given USD
      positions.push({ type: 'short', entryPrice: c, entryTime: ts, baseTokenAmount, usdVolume });
      // console.log(`Opening SHORT position at ${c} on ${new Date(ts * 1000)}, selling ${baseTokenAmount} tokens`);
    }
  });
  
  positions.forEach((position) => {
    const pnl = position.type === 'long' 
      ? (currentPrice - position.entryPrice) * position.baseTokenAmount // Long PnL
      : (position.entryPrice - currentPrice) * position.baseTokenAmount; // Short PnL

    closedTrades.push({
      ts: decodeTimestamp(emaCrossovers[emaCrossovers.length - 1].ts), // Use the last timestamp for consistency
      positionType: position.type,
      entryPrice: position.entryPrice,
      exitPrice: currentPrice,
      pnl,
      usdVolume: position.usdVolume,
    });
    totalVolumeInUSD += position.usdVolume;
    totalTransactions++;
  });

  // Calculate total PnL
  const totalPnL = closedTrades.reduce((acc, trade) => acc + trade.pnl, 0);

  return {
    totalPnL: totalPnL,
    totalTransactions,
    totalVolumeInUSD,
    closedTrades,
    activePositions: positions,
  };
}