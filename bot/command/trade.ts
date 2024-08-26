import { Telegraf } from "telegraf";
import { WHITE_LIST_TOKENS_TRADE } from "../utils/config";
import { getSymbolCandles } from "../helper/okx-candles";
import { findEMACrossovers } from "../signals/ema-cross";
import { decodeTimestamp, decodeTimestampAgo } from "../utils";
import { ICandles } from "../type";
import {decode} from "punycode";

export const botWatchingInterval = ({
  bot,
  intervalId,
}: {
  bot: Telegraf;
  intervalId: NodeJS.Timeout | null;
}) => {
  bot.command("start", async (ctx) => {
    await ctx.reply("Bot has started! Messages will be sent at intervals.");
    let lastestCandles: { [key: string]: ICandles } = {};
    const bar: string = "1m";
    intervalId = setInterval(async () => {
      try {
        const BASE_SYMBOL = WHITE_LIST_TOKENS_TRADE[0];
        const baseCandles = await getSymbolCandles({
          instID: `${BASE_SYMBOL}`,
          before: 0,
          bar: bar,
          limit: 10000,
        });
        const [pendingCandle] = baseCandles.filter(
          (baseCandles) => baseCandles.confirm === 0
        );
        const lastestCandle = lastestCandles?.[BASE_SYMBOL]?.[0];
        if (lastestCandle && pendingCandle.ts !== lastestCandle.ts) {
          await Promise.all(
            WHITE_LIST_TOKENS_TRADE.map(async (SYMBOL) => {
              const _candles = await getSymbolCandles({
                instID: `${SYMBOL}`,
                before: 0,
                bar: bar,
                limit: 10000,
              });
              const candles = _candles.filter(candle => candle.confirm === 1)
              const emaCross = findEMACrossovers(candles, 9, 21);
              const latestCross = emaCross[emaCross.length - 1];
              const currentCandle = candles[candles.length - 1];
              if(SYMBOL === BASE_SYMBOL) {
                console.log(SYMBOL, 'Lastest Candle:', decodeTimestamp(currentCandle.ts), '|', decodeTimestamp(latestCross.ts))
                // console.log(SYMBOL, 'Lastest Cross:',
                //    emaCross.slice(-3).map(e => {
                //     return {...e, ts: decodeTimestamp(e.ts)}
                //   }))
              }
              if (
                latestCross.ts === currentCandle.ts &&
                currentCandle.confirm === 1
              ) {
                let notificationMessage = "";
                notificationMessage += `🔔 <b>EMA Crossover Alert!</b>\n`;
                notificationMessage += `${
                  latestCross.type === "bullish" ? "📈" : "📉"
                } <b>Type:</b> <code>${
                  latestCross.type === "bullish" ? "Bullish" : "Bearish"
                }</code>\n`;
                notificationMessage += `💰 <b>Price:</b> <code>${latestCross.c.toFixed(
                  2
                )}</code>\n`;
                notificationMessage += `⏰ <b>Time:</b> <code>${decodeTimestamp(
                  Math.round(latestCross.ts)
                )}</code>\n`;
                notificationMessage += `🔍 <b>Symbol:</b> <code>${SYMBOL}</code>\n`;
                notificationMessage += `📊 <b>Short EMA:</b> <code>${latestCross.shortEMA}</code> | <b>Long EMA:</b> <code>${latestCross.longEMA}</code>\n`;

                await ctx.reply(notificationMessage, { parse_mode: "HTML" });
              }
            })
          );
        }
        lastestCandles[BASE_SYMBOL] = [pendingCandle];
      } catch (err: any) {
        console.log(err);
        console.error("Interval error: ", err.message || err);
        if (intervalId) clearInterval(intervalId);
      }
      //   console.log(lastPendingCandles)
    }, 1000 * 5);
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
