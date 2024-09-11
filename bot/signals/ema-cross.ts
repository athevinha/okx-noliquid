import { decode } from "punycode";
import { ICandles, ICandlesEMACrossovers } from "../type";
import { decodeTimestamp, decodeTimestampAgo } from "../utils";

/**
 * Calculate EMA for each candle's closing price.
 * @param candles - Array of candle data.
 * @param periods - The number of periods to calculate the EMA.
 * @returns Array of EMA values corresponding to each timestamp.
 */
export function calculateEMA(
  candles: ICandles,
  periods: number,
): Array<{ ts: number; ema: number; crossPercentFilter?: number }> {
  const multiplier = 2 / (periods + 1);
  let ema = 0;
  let initialSMA = 0;

  return candles
    .map((candle, index) => {
      const { c: closePrice, ts } = candle;

      if (index < periods) {
        initialSMA += closePrice;
        if (index === periods - 1) {
          initialSMA /= periods;
          ema = initialSMA;
        }
        return { ts, ema: index === periods - 1 ? ema : 0 }; // No EMA until we have enough periods
      } else {
        ema = (closePrice - ema) * multiplier + ema;
        return { ts, ema };
      }
    })
    .filter((candle) => candle.ema !== 0); // Remove entries without EMA values
}

/**
 * Calculate the slope between two EMA points.
 * @param prevShortEMA - Previous short EMA.
 * @param prevLongEMA - Previous long EMA.
 * @param currentShortEMA - Current short EMA.
 * @param currentLongEMA - Current long EMA.
 * @returns The slope between the short and long EMAs.
 */
export function calculateSlope(
  prevShortEMA: number,
  prevLongEMA: number,
  currentShortEMA: number,
  currentLongEMA: number,
): number {
  const deltaShortEMA = currentShortEMA - prevShortEMA;
  const deltaLongEMA = currentLongEMA - prevLongEMA;
  return Math.abs(
    (deltaShortEMA - deltaLongEMA) / (prevLongEMA + deltaLongEMA),
  ); // Normalized slope
}
/**
 * Detect EMA crossovers and return crossover points.
 * @param candles - Array of candle data.
 * @param shortPeriods - Periods for the short-term EMA.
 * @param longPeriods - Periods for the long-term EMA.
 * @param crossPercentFilter - Minimum percentage change between EMAs to consider a valid crossover.
 * @returns Array of crossover points with their type (bullish or bearish).
 */

/**
 * Find a good slope threshold based on historical data volatility.
 * @param candles - Array of candle data.
 * @returns A calculated slope threshold for detecting trends.
 */
export function calculateGoodSlopeThreshold(candles: ICandles): number {
  const priceChanges: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const priceChange = candles[i].c - candles[i - 1].c;
    priceChanges.push(priceChange);
  }

  const mean = priceChanges.reduce((a, b) => a + b, 0) / priceChanges.length;
  const variance =
    priceChanges.reduce((a, b) => a + (b - mean) ** 2, 0) / priceChanges.length;
  const stdDev = Math.sqrt(variance);

  // Define the slope threshold as 1x standard deviation
  const slopeThreshold = stdDev;

  return slopeThreshold;
}

/**
 * Detect EMA crossovers and return crossover points while filtering based on slope.
 * @param candles - Array of candle data.
 * @param shortPeriods - Periods for the short-term EMA.
 * @param longPeriods - Periods for the long-term EMA.
 * @param slope - Minimum slope difference between short and long EMAs to consider a valid crossover.
 * @returns Array of crossover points with their type (bullish or bearish).
 */
export function findEMACrossovers(
  candles: ICandles,
  shortPeriods: number,
  longPeriods: number,
): ICandlesEMACrossovers {
  const longEMA = calculateEMA(candles, longPeriods);
  const shortEMA = calculateEMA(candles, shortPeriods).filter(
    (ema) => ema?.ts >= longEMA[0]?.ts,
  );
  const crossovers: ICandlesEMACrossovers = [];

  for (let i = 2; i < shortEMA.length && i < longEMA.length; i++) {
    const prev2ShortEMA = shortEMA[i - 2]?.ema;
    const prev2LongEMA = longEMA[i - 2]?.ema;
    const prevShortEMA = shortEMA[i - 1].ema;
    const prevLongEMA = longEMA[i - 1].ema;
    const currentShortEMA = shortEMA[i].ema;
    const currentLongEMA = longEMA[i].ema;

    // Calculate the slope between the previous and current EMAs
    const calculatedSlope = calculateSlope(
      prevShortEMA,
      prevLongEMA,
      currentShortEMA,
      currentLongEMA,
    );
    const calculatedSlopePre = calculateSlope(
      prev2ShortEMA,
      prev2LongEMA,
      prevShortEMA,
      prevLongEMA,
    );
    const slopeThreshold = calculatedSlopePre / calculatedSlope;
    // Check for a valid bullish crossover
    if (prevShortEMA <= prevLongEMA && currentShortEMA > currentLongEMA) {
      crossovers.push({
        ...candles.filter((candle) => shortEMA[i].ts === candle.ts)[0],
        type: "bullish",
        calculatedSlope: [calculatedSlopePre, calculatedSlope],
        slopeThreshold,
        shortEMA: currentShortEMA,
        longEMA: currentLongEMA,
      });
    }

    // Check for a valid bearish crossover
    if (prevShortEMA >= prevLongEMA && currentShortEMA < currentLongEMA) {
      crossovers.push({
        ...candles.filter((candle) => longEMA[i].ts === candle.ts)[0],
        type: "bearish",
        calculatedSlope: [calculatedSlopePre, calculatedSlope],
        slopeThreshold,
        shortEMA: currentShortEMA,
        longEMA: currentLongEMA,
      });
    }
  }

  return crossovers;
}

type Position = {
  type: "long" | "short";
  entryPrice: number;
  entryTime: number;
  baseTokenAmount: number; // Amount of tokens bought/sold using the USD volume
  usdVolume: number; // USD used for the trade
};

type HistoryTrade = {
  ts: number;
  positionType: "long" | "short";
  action: "open" | "close";
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  slopeThreshold?: number;
  usdVolume: number;
};

export function simulateTradesEmaCross(
  emaCrossovers: ICandlesEMACrossovers,
  usdVolume: number,
  currentPrice: number,
  slopeThresholdUnder?: number,
  slopeThresholdUp?: number,
) {
  let positions: Position[] = [];
  let historyTrades: HistoryTrade[] = [];
  let totalTransactions = 0;
  let totalVolumeInUSD = 0;
  let loss = 0;
  let win = 0;
  let avgPositiveSlope = 0;
  let avgNegativeSlope = 0;

  emaCrossovers.map((crossover) => {
    const { ts, c, type, calculatedSlope, slopeThreshold } = crossover;
    if (type === "bullish") {
      positions = positions.filter((position) => {
        if (position.type === "short") {
          const pnl = (position.entryPrice - c) * position.baseTokenAmount; // Short PnL = (entry price - exit price) * base token amount
          const openPositionSlope =
            historyTrades[historyTrades.length - 1].slopeThreshold || 0;
          if (pnl > 0) {
            avgPositiveSlope += openPositionSlope;
            win++;
          } else {
            avgNegativeSlope += openPositionSlope;
            loss++;
          }
          historyTrades.push({
            ts,
            positionType: `${position.type}`,
            action: "close",
            entryPrice: position.entryPrice,
            exitPrice: c,
            pnl,
            slopeThreshold,
            usdVolume: position.usdVolume,
          });
          totalVolumeInUSD += position.usdVolume;
          totalTransactions++;
          // console.log(`[C-SHORT] at ${c} on ${decodeTimestamp(ts)} | PnL: ${pnl}`);
          return false;
        }
        return true;
      });

      const baseTokenAmount = usdVolume / c; // Calculate how much base token is bought with the given USD
      if (
        (!slopeThresholdUnder || slopeThreshold <= slopeThresholdUnder) &&
        (!slopeThresholdUp || slopeThreshold >= slopeThresholdUp)
      ) {
        positions.push({
          type: "long",
          entryPrice: c,
          entryTime: ts,
          baseTokenAmount,
          usdVolume,
        });
        historyTrades.push({
          ts,
          positionType: `long`,
          action: "open",
          entryPrice: c,
          exitPrice: 0,
          pnl: 0,
          slopeThreshold,
          usdVolume: usdVolume,
        });
      }
    } else if (type === "bearish") {
      // Close any open long positions and calculate PnL
      positions = positions.filter((position) => {
        if (position.type === "long") {
          const pnl = (c - position.entryPrice) * position.baseTokenAmount; // Long PnL = (exit price - entry price) * base token amount
          const openPositionSlope =
            historyTrades[historyTrades.length - 1].slopeThreshold || 0;
          if (pnl > 0) {
            avgPositiveSlope += openPositionSlope;
            win++;
          } else {
            avgNegativeSlope += openPositionSlope;
            loss++;
          }
          historyTrades.push({
            ts,
            positionType: `${position.type}`,
            action: "close",
            entryPrice: position.entryPrice,
            exitPrice: c,
            pnl,
            slopeThreshold,
            usdVolume: position.usdVolume,
          });
          totalVolumeInUSD += position.usdVolume;
          totalTransactions++;
          // console.log(`[C-LONG] at ${c} on ${decodeTimestamp(ts)} | PnL: ${pnl}`);
          return false;
        }
        return true;
      });

      // Open a new short position
      const baseTokenAmount = usdVolume / c; // Calculate how much base token is sold with the given USD
      if (
        (!slopeThresholdUnder || slopeThreshold <= slopeThresholdUnder) &&
        (!slopeThresholdUp || slopeThreshold >= slopeThresholdUp)
      ) {
        positions.push({
          type: "short",
          entryPrice: c,
          entryTime: ts,
          baseTokenAmount,
          usdVolume,
        });
        historyTrades.push({
          ts,
          positionType: `short`,
          action: "open",
          entryPrice: c,
          exitPrice: 0,
          pnl: 0,
          slopeThreshold,
          usdVolume: usdVolume,
        });
      }
    }
  });

  positions.forEach((position) => {
    const pnl =
      position.type === "long"
        ? (currentPrice - position.entryPrice) * position.baseTokenAmount // Long PnL
        : (position.entryPrice - currentPrice) * position.baseTokenAmount; // Short PnL

    const openPositionSlope =
      historyTrades[historyTrades.length - 1].slopeThreshold || 0;
    if (pnl > 0) {
      avgPositiveSlope += openPositionSlope;
      win++;
    } else {
      avgNegativeSlope += openPositionSlope;
      loss++;
    }

    historyTrades.push({
      ts: Date.now(), // Use the last timestamp for consistency
      positionType: position.type,
      action: "close",
      entryPrice: position.entryPrice,
      exitPrice: currentPrice,
      pnl,
      slopeThreshold: emaCrossovers[emaCrossovers.length - 1].slopeThreshold,
      usdVolume: position.usdVolume,
    });
    totalVolumeInUSD += position.usdVolume;
    totalTransactions++;
  });

  // Calculate total PnL
  const totalPnL = historyTrades.reduce((acc, trade) => acc + trade.pnl, 0);
  const positivePnLTrades = historyTrades.filter(
    (trade) => trade.pnl > 0 && trade.slopeThreshold !== undefined,
  );
  const negativePnLTrades = historyTrades.filter(
    (trade) => trade.pnl < 0 && trade.slopeThreshold !== undefined,
  );

  avgPositiveSlope =
    positivePnLTrades.length > 0
      ? avgPositiveSlope / positivePnLTrades.length
      : 0;
  avgNegativeSlope =
    negativePnLTrades.length > 0
      ? avgNegativeSlope / negativePnLTrades.length
      : 0;
  return {
    totalPnL: totalPnL,
    totalTransactions,
    historyTrades,
    totalVolumeInUSD,
    avgPositiveSlope,
    avgNegativeSlope,
    activePositions: positions,
    win,
    loss,
  };
}
