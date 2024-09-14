import { ICandle } from "../type";

type CandleWithATR = ICandle & { atr: number; fluctuationsPercent: number };

export function calculateATR(
  candles: ICandle[],
  period: number,
  method?: string,
): CandleWithATR[] {
  const trValues: number[] = [];
  // Calculate True Range (TR)
  for (let i = 1; i < candles.length; i++) {
    const prevClose = candles[i - 1].c;
    const high = candles[i].h;
    const low = candles[i].l;
    const currentTR = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose),
    );
    trValues.push(currentTR);
  }

  // Function to calculate different moving averages
  const movingAverage = (
    values: number[],
    period: number,
    method: string,
  ): number[] => {
    const result: number[] = [];
    if (method === "RMA") {
      let avg =
        values.slice(0, period).reduce((acc, val) => acc + val, 0) / period;
      result.push(avg);
      for (let i = period; i < values.length; i++) {
        avg = (avg * (period - 1) + values[i]) / period;
        result.push(avg);
      }
    } else if (method === "SMA") {
      for (let i = 0; i <= values.length - period; i++) {
        const sma =
          values.slice(i, i + period).reduce((acc, val) => acc + val, 0) /
          period;
        result.push(sma);
      }
    } else if (method === "EMA") {
      const multiplier = 2 / (period + 1);
      let ema =
        values.slice(0, period).reduce((acc, val) => acc + val, 0) / period;
      result.push(ema);
      for (let i = period; i < values.length; i++) {
        ema = (values[i] - ema) * multiplier + ema;
        result.push(ema);
      }
    } else if (method === "WMA") {
      for (let i = 0; i <= values.length - period; i++) {
        const wma =
          values
            .slice(i, i + period)
            .reduce((acc, val, index) => acc + val * (index + 1), 0) /
          ((period * (period + 1)) / 2);
        result.push(wma);
      }
    }
    return result;
  };

  // Calculate ATR values using RMA
  const atrValues = movingAverage(trValues, period, method || "RMA");
  // Attach ATR values to the corresponding candles (starting from period)
  const candlesWithATR: CandleWithATR[] = atrValues.map((atr, i) => {
    const candle = candles[i + period];
    return {
      ...candle,
      atr: atr || 0,
      fluctuationsPercent:
        Math.abs(atr / candle.c),
    };
  });
  candlesWithATR.sort((a,b) => a.ts - b.ts)
  return candlesWithATR;
}
