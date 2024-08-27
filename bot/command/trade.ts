import { Telegraf } from "telegraf";
import { USDT, WHITE_LIST_TOKENS_TRADE } from "../utils/config";
import { getSymbolCandles } from "../helper/okx-candles";
import { findEMACrossovers } from "../signals/ema-cross";
import { decodeSymbol, decodeTimestamp, decodeTimestampAgo, zerofy } from "../utils";
import { ICandles, ImgnMode, IPosSide } from "../type";
import { decode } from "punycode";
import {
  closeFuturePosition,
  openFuturePosition,
  placeOrder,
  setLeveragePair,
  setPositionMode,
} from "../helper/okx-trade";

export const botAutoTrading = ({
  bot,
  intervalId,
  bar,
  leverage = 7,
  mgnMode = "isolated",
  size = 100,
}: {
  bot: Telegraf;
  intervalId: NodeJS.Timeout | null;
  bar: string;
  leverage?: number;
  mgnMode?: ImgnMode;
  size?: number;
}) => {
  bot.command("start", async (ctx) => {
    const messageText = ctx.message.text;
    const barOverride = messageText.split(" ").slice(1).join(" ") || bar;
    await ctx.reply(`Bot has started! Messages will be sent at intervals with bar ${barOverride}.`);
    let lastestCandles: { [key: string]: ICandles } = {};
    let lastestSignalTs: {[instId: string]: number} = {}
    intervalId = setInterval(async () => {
      try {
        const BASE_SYMBOL = WHITE_LIST_TOKENS_TRADE[0];
        const baseCandles = await getSymbolCandles({
          instID: `${BASE_SYMBOL}`,
          before: 0,
          bar: barOverride,
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
                bar: barOverride,
                limit: 10000,
              });
              const candles = _candles.filter((candle) => candle.confirm === 1);
              const emaCross = findEMACrossovers(candles, 9, 21);
              const latestCross = emaCross[emaCross.length - 1];
              const currentCandle = candles[candles.length - 1];
              if (SYMBOL === BASE_SYMBOL) {
                console.log(
                  SYMBOL,
                  "Lastest Candle:",
                  decodeTimestamp(currentCandle.ts),
                  "|",
                  decodeTimestamp(latestCross.ts)
                );
                // console.log(SYMBOL, 'Lastest Cross:',
                //    emaCross.slice(-3).map(e => {
                //     return {...e, ts: decodeTimestamp(e.ts)}
                //   }))
              }
              if (
                latestCross.ts === currentCandle.ts &&
                lastestSignalTs[SYMBOL] !== latestCross.ts &&
                currentCandle.confirm === 1
              ) {
                lastestSignalTs[SYMBOL] = latestCross.ts
                const openPositionParams = {
                  instId: SYMBOL,
                  leverage,
                  mgnMode,
                  posSide: latestCross.type === "bullish" ? 'long' : 'short' as IPosSide,
                  size,
                };
                const closePositionParams = {
                  instId: SYMBOL,
                  mgnMode,
                  posSide: latestCross.type === "bullish" ? 'short' : 'long' as IPosSide,
                };
                const {msg: closeMsg} = await closeFuturePosition(closePositionParams);
                const {msg: openMsg} =  await openFuturePosition(openPositionParams);
                let notificationMessage = "";
                notificationMessage += `🔔 <b>EMA Crossover Alert!</b>\n`;
                notificationMessage += `${
                  latestCross.type === "bullish" ? "📈" : "📉"
                } <b>Type:</b> <code>${
                  latestCross.type === "bullish" ? "Bullish" : "Bearish"
                }</code>\n`;
                notificationMessage += `💰 <b>Price:</b> <code>${zerofy(latestCross.c) + USDT}</code>\n`;
                notificationMessage += `⏰ <b>Time:</b> <code>${decodeTimestamp(
                  Math.round(latestCross.ts)
                )}</code>\n`;
                notificationMessage += `🔍 <b>Symbol:</b> <code>${SYMBOL}</code>\n`;
                notificationMessage += `📊 <b>Short EMA:</b> <code>${zerofy(
                  latestCross.shortEMA
                )}</code> | <b>Long EMA:</b> <code>${zerofy(
                  latestCross.longEMA
                )}</code>\n`;
                notificationMessage += `<code>-------------------------------</code>\n`;
                notificationMessage += `<code>${openMsg === '' ? `🟢 O: ${openPositionParams.posSide.toUpperCase()} ${decodeSymbol(openPositionParams.instId)}` : '🔴 O:' + openMsg}</code> | <code>${closeMsg === '' ? `🟢 C: ${closePositionParams.posSide.toUpperCase()} ${decodeSymbol(closePositionParams.instId)}` : '🔴 C: ' + closeMsg}</code>\n`;
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
