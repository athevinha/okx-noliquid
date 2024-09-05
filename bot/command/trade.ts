import dotenv from "dotenv";
import {Context,NarrowedContext,Telegraf} from "telegraf";
import {Message,Update} from "telegraf/typings/core/types/typegram";
import {getSupportCrypto,getSymbolCandles} from "../helper/okx-candles";
import {closeFuturePosition,openFuturePosition} from "../helper/okx-trade";
import {findEMACrossovers} from "../signals/ema-cross";
import {ICandles,IntervalConfig,IPosSide} from "../type";
import {decodeSymbol,decodeTimestamp,zerofy} from "../utils";
import {parseConfigInterval, USDT,WHITE_LIST_TOKENS_TRADE} from "../utils/config";
import {formatReportInterval} from "../utils/message";
dotenv.config();

export const fowardTrading = async (
  ctx: NarrowedContext<
    Context<Update>,
    {
      message:
        | (Update.New & Update.NonChannel & Message.AnimationMessage)
        | (Update.New & Update.NonChannel & Message.TextMessage);
      update_id: number;
    }
  >,
  config: IntervalConfig,
  lastestCandles: { [key: string]: ICandles },
  lastestSignalTs: { [instId: string]: number },
) => {
  const {
    bar,
    mgnMode,
    tokenTradingMode,
    leve,
    sz,
    slopeThreshAverageMode,
    slopeThresholdUp,
    slopeThresholdUnder,
  } = config;

  let tradeAbleCrypto = WHITE_LIST_TOKENS_TRADE;
  if (tokenTradingMode === "whitelist")
    tradeAbleCrypto = WHITE_LIST_TOKENS_TRADE;
  else if (tokenTradingMode === "all") {
    const supportFutureCryptos = await getSupportCrypto({});
    const supportFutureCryptosByInstId = supportFutureCryptos.map(
      (e) => e.instId
    );
    tradeAbleCrypto = supportFutureCryptosByInstId;
  } else {
    tradeAbleCrypto = tokenTradingMode?.split("/") || [];
  }
  console.log(
    `Interval ${bar} | trade with ${tradeAbleCrypto.length} Ccy.`,
  );
  if (tradeAbleCrypto.length === 0) {
    ctx.replyWithHTML("🛑 No currency to trade.");
    return;
  }

  try {
    const BASE_SYMBOL = WHITE_LIST_TOKENS_TRADE[0];
    const baseCandles = await getSymbolCandles({
      instID: `${BASE_SYMBOL}`,
      before: 0,
      bar,
      limit: 50,
    });

    const [pendingCandle] = baseCandles.filter(
      (baseCandles) => baseCandles.confirm === 0
    );
    const lastestCandle = lastestCandles?.[BASE_SYMBOL]?.[0];
    if (
      pendingCandle &&
      lastestCandle &&
      pendingCandle?.ts !== lastestCandle?.ts
    ) {
      await Promise.all(
        tradeAbleCrypto.map(async (SYMBOL) => {
          let _candles = await getSymbolCandles({
            instID: `${SYMBOL}`,
            before: 0,
            bar,
            limit: 50,
          });

          const candles = _candles.filter((candle) => candle.confirm === 1);
          const emaCross = findEMACrossovers(candles, 9, 21);
          const latestCross = emaCross[emaCross.length - 1];
          const currentCandle = candles[candles.length - 1];
          if (SYMBOL === BASE_SYMBOL) {
            console.log(
              SYMBOL,
              "Lastest Candle:",
              decodeTimestamp(currentCandle?.ts),
              "|",
              decodeTimestamp(latestCross?.ts)
            );
          }
          if (
            latestCross?.ts === currentCandle?.ts &&
            lastestSignalTs[SYMBOL] !== latestCross?.ts &&
            currentCandle.confirm === 1
          ) {
            lastestSignalTs[SYMBOL] = latestCross.ts;
            const openPositionParams = {
              instId: SYMBOL,
              leverage: leve,
              mgnMode,
              posSide:
                latestCross.type === "bullish" ? "long" : ("short" as IPosSide),
              size: sz,
            };
            const closePositionParams = {
              instId: SYMBOL,
              mgnMode,
              posSide:
                latestCross.type === "bullish" ? "short" : ("long" as IPosSide),
            };
            const { msg: closeMsg } = await closeFuturePosition(
              closePositionParams
            );
            const { msg: openMsg } = await openFuturePosition(
              openPositionParams
            );
            let notificationMessage = "";
            notificationMessage += `🔔 <b>EMA Crossover Alert!</b>\n`;
            notificationMessage += `${
              latestCross.type === "bullish" ? "📈" : "📉"
            } <b>Type:</b> <code>${
              latestCross.type === "bullish" ? "Bullish" : "Bearish"
            }</code>\n`;
            notificationMessage += `💰 <b>Price:</b> <code>${
              zerofy(latestCross.c) + USDT
            }</code>\n`;
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
            notificationMessage += `<code>${
              openMsg === ""
                ? `🟢 O: ${openPositionParams.posSide.toUpperCase()} ${decodeSymbol(
                    openPositionParams.instId
                  )}`
                : "🔴 O:" + openMsg
            }</code>\n`;
            notificationMessage += `<code>${
              closeMsg === ""
                ? `🟢 C: ${closePositionParams.posSide.toUpperCase()} ${decodeSymbol(
                    closePositionParams.instId
                  )}`
                : "🔴 C: " + closeMsg
            }</code>\n`;
            await ctx.reply(notificationMessage, { parse_mode: "HTML" });
          }
        })
      );
    }
    lastestCandles[BASE_SYMBOL] = [pendingCandle];
  } catch (err: any) {
    console.log(err);
    console.error("Interval error: ", err.message || err);
    await ctx.replyWithHTML(
      `<code>${err.message || err.reason || err.code}</code>`
    );
  }
};

export const botAutoTrading = ({ bot }: { bot: Telegraf }) => {
  const intervals = new Map<string, IntervalConfig>();

  bot.command("start", (ctx) => {
    const [id, ...configStrings] = ctx.message.text.split(" ").slice(1);
    const config = parseConfigInterval(configStrings.join(" "));

    if (intervals.has(id)) {
      ctx.replyWithHTML(
        `🚫 Trading interval with ID <code>${id}</code> is already active.`
      );
      return;
    }
    let lastestCandles: { [key: string]: ICandles } = {};
    let lastestSignalTs: { [instId: string]: number } = {};
    const interval = setInterval(async() => {
      await fowardTrading(ctx, { ...config, interval }, lastestCandles, lastestSignalTs);
    }, config.intervalDelay);

    intervals.set(id, { ...config, interval });

    const startReport = formatReportInterval(id, { ...config, interval }, true);
    ctx.replyWithHTML(startReport);
  });

  bot.command("stop", (ctx) => {
    const id = ctx.message.text.split(" ")[1];

    if (!intervals.has(id)) {
      ctx.replyWithHTML(
        `🚫 No active trading interval found with ID <code>${id}</code>.`
      );
      return;
    }

    const intervalConfig = intervals.get(id);
    clearInterval(intervalConfig!.interval);
    intervals.delete(id);

    ctx.replyWithHTML(`🛑 Stopped trading interval <b><code>${id}</code>.</b>`);
  });

  bot.command("tasks", (ctx) => {
    if (intervals.size === 0) {
      ctx.replyWithHTML("📭 No trading intervals are currently active.");
      return;
    }

    let report = "<b>Current Trading Intervals:</b>\n";
    intervals.forEach((intervalConfig, id) => {
      report += formatReportInterval(id, intervalConfig, false) + "\n";
    });

    ctx.replyWithHTML(report);
  });

  bot.command("stops", (ctx) => {
    intervals.forEach((intervalConfig) => {
      clearInterval(intervalConfig.interval);
    });
    intervals.clear();

    ctx.replyWithHTML("🛑 All trading intervals have been stopped.");
  });
};
