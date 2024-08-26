import { Telegraf } from "telegraf";
import { WHITE_LIST_TOKENS_TRADE } from "../utils/config";
import { getSymbolCandles } from "../helper/okx-candles";
import { findEMACrossovers } from "../signals/ema-cross";
import { decodeTimestamp } from "../utils";

export const botWatchingInterval = ({
  bot,
  intervalId,
}: {
  bot: Telegraf;
  intervalId: NodeJS.Timeout | null;
}) => {
  bot.command("start", async (ctx) => {
    await ctx.reply("Bot has started! Messages will be sent at intervals.");
    intervalId = setInterval(async () => {
      try {
        await Promise.all(
          WHITE_LIST_TOKENS_TRADE.map(async (SYMBOL) => {
            const candles = await getSymbolCandles({
              instID: `${SYMBOL}`,
              before: 0,
              bar: "1m",
              limit: 10000,
            });
            const emaCross = findEMACrossovers(candles, 9, 21);
            const latestCross = emaCross[emaCross.length - 1];
            const currentCandle = candles[candles.length - 1];
            if (
              latestCross.ts === currentCandle.ts &&
              currentCandle.confirm === 1
            ) {
                const notificationMessage = `
                🔔 *EMA Crossover Alert!*
                ${latestCross.type === 'bullish' ? '📈' : '📉'} *Type:* ${latestCross.type === 'bullish' ? 'Bullish' : 'Bearish'}
                💰 *Price:* ${latestCross.c.toFixed(2)}
                ⏰ *Time:* ${decodeTimestamp(Math.round(latestCross.ts))}
                🔍 *Symbol:* ${SYMBOL}
                              
                📊 *Short EMA:* ${latestCross.shortEMA.toFixed(2)} | *Long EMA:* ${latestCross.longEMA.toFixed(2)}
                              `;
                
                 await ctx.reply(notificationMessage, { parse_mode: 'Markdown' });
            }
          })
        );
      } catch (err: any) {
        console.error("Interval error: ", err.message || err);
        if (intervalId) clearInterval(intervalId);
      }
    }, 10000);
  });

  bot.command("stop", async (ctx) => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
      await ctx.reply("Bot has stopped sending periodic messages.");
    } else {
      await ctx.reply("No interval is currently running.");
    }
  });
};
