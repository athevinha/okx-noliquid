import dotenv from "dotenv";
import {Context,NarrowedContext,Telegraf} from "telegraf";
import {Message,Update} from "telegraf/typings/core/types/typegram";
import {getSymbolCandles} from "../helper/okx.candles";
import {closeFuturePosition,openFuturePosition} from "../helper/okx.trade";
import {
  findEMACrossovers
} from "../signals/ema-cross";
import {ICandles,IntervalConfig,IPosSide} from "../type";
import {
  axiosErrorDecode,
  decodeSymbol,
  decodeTimestamp,
  estimatePnl,
  getTradeAbleCrypto,
  zerofy,
} from "../utils";
import {
  parseConfigInterval,
  USDT,
  WHITE_LIST_TOKENS_TRADE,
} from "../utils/config";
import {formatReportInterval} from "../utils/message";
import {calculateATR} from "../signals/atr";
dotenv.config();
/**
 * Executes trading logic for the given interval configuration.
 *
 * @param {Object} ctx - The context from the Telegram bot, used to send messages to the user.
 * @param {IntervalConfig} config - Configuration object for the trading interval, including:
 *    - bar: Time period for each candle (e.g., 1m, 5m, 15m).
 *    - mgnMode: Margin mode, either "isolated" or "cross".
 *    - leve: Leverage used for trading.
 *    - sz: Position size for trades.
 *    - slopeThresholdUp: Maximum allowed slope for opening a position.
 *    - slopeThresholdUnder: Minimum allowed slope for opening a position.
 * @param {string[]} tradeAbleCrypto - List of cryptocurrencies that are available for trading.
 * @param {Object} lastestCandles - A record of the latest confirmed candles for each symbol.
 *    Format: { [key: string]: ICandles[] } where `key` is the symbol (e.g., BTC-USDT) and `ICandles[]` represents the candles data.
 * @param {Object} lastestSignalTs - A record of the last confirmed signal bot make tx timestamps for each symbol.
 *    Format: { [instId: string]: number } where `instId` is the symbol and `number` is the timestamp of the last executed signal.
 * @param {string} [intervalId] - Optional ID of the trading interval for logging and tracking purposes.
 *
 * @returns {Promise<void>} - Sends trade signals via the Telegram bot if an EMA crossover occurs, and opens or closes positions based on the type of crossover (bullish or bearish).
 * Handles both opening and closing positions based on EMA crossovers and applies slope filtering if configured.
 * Sends notifications of trade actions to the user via the Telegram bot context.
 *
 * @throws {Error} - If any error occurs during the trading logic execution, it is logged, and an error message is sent to the user via the Telegram bot.
 */
export const fowardTrading = async ({
  ctx,
  config,
  tradeAbleCrypto,
  lastestCandles,
  lastestSignalTs,
  intervalId,
}: {
  ctx: NarrowedContext<
    Context<Update>,
    {
      message:
        | (Update.New & Update.NonChannel & Message.AnimationMessage)
        | (Update.New & Update.NonChannel & Message.TextMessage);
      update_id: number;
    }
  >;
  config: IntervalConfig;
  tradeAbleCrypto: string[];
  lastestCandles: { [key: string]: ICandles }; // lastest Candle has confirm
  lastestSignalTs: { [instId: string]: number }; // Lastest EmaCross bot make Tx
  intervalId?: string;
}) => {
  const { bar, mgnMode, leve, sz, slopeThresholdUp, slopeThresholdUnder} =
    config;
  let variance = config.variance
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
    ); // Pending candles in current
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
            limit: 300,
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

            const closePositionParams = {
              instId: SYMBOL,
              mgnMode,
              posSide:
                latestCross.type === "bullish" ? "short" : ("long" as IPosSide),
              isCloseAlgoOrders: true
            };
            const { msg: closeMsg } = await closeFuturePosition(
              closePositionParams
            );
            let openMsg = "";
            if(variance === 'auto'){
              const atrs = calculateATR(candles, 14)
              _variance = atrs[atrs.length - 1]?.fluctuationsPercent.toFixed(4)
            }
            const openPositionParams = {
              instId: SYMBOL,
              leverage: leve,
              mgnMode,
              posSide:
                latestCross.type === "bullish" ? "long" : ("short" as IPosSide),
              size: sz,
              callbackRatio: variance
            };
            if (
              (!slopeThresholdUnder ||
                latestCross.slopeThreshold <= slopeThresholdUnder) &&
              (!slopeThresholdUp ||
                latestCross.slopeThreshold >= slopeThresholdUp)
            ) {
              const openPosition = await openFuturePosition(openPositionParams);
              openMsg = openPosition.msg;
            } else {
              openMsg = "Slope out of range";
            }
            let estimateMoveTrigglePrice = 0
            if(openPositionParams?.posSide === 'long' && variance) estimateMoveTrigglePrice = latestCross.c - latestCross.c * Number(variance) 
            else if (openPositionParams?.posSide === 'short' && variance) estimateMoveTrigglePrice = latestCross.c + latestCross.c * Number(variance) 
            
            const {
              estPnlStopLoss,
              estPnlStopLossPercent,
              estPnlStopLossIcon,
            } = estimatePnl({
              posSide: openPositionParams.posSide as IPosSide,
              sz,
              e: latestCross.c,
              c: estimateMoveTrigglePrice,
            });

            let notificationMessage = "";
            notificationMessage += `🔔 <b>[${decodeSymbol(
              SYMBOL
            )}]</b> | <code>${intervalId}</code> crossover Alert \n`;
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
            notificationMessage += `⛓️ <b>Slope:</b> <code>${zerofy(
              latestCross.slopeThreshold
            )}</code>\n`;
            notificationMessage += `📊 <b>Short | Long EMA:</b> <code>${zerofy(
              latestCross.shortEMA
            )}</code> | <code>${zerofy(latestCross.longEMA)}</code>\n`;
            if (openMsg === "") {
              notificationMessage += `🩸 <b>Sz | Leve:</b> <code>${zerofy(
                openPositionParams.size
              )}${USDT}</code> | <code>${
                openPositionParams.leverage
              }x</code>\n`;
              notificationMessage+= `🚨 <b>Trailing Loss:</b> <code>${zerofy(estPnlStopLoss)}${USDT}</code> (<code>${zerofy(estPnlStopLossPercent * 100)}</code>%)\n`
            }
            notificationMessage += `<code>-------------------------------</code>\n`;
            notificationMessage += `<code>${
              openMsg === ""
                ? `🟢 O: ${openPositionParams.posSide.toUpperCase()} ${decodeSymbol(
                    openPositionParams.instId
                  )}`
                : "🔴 O: " + openMsg
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
    await ctx.replyWithHTML(`Error: <code>${axiosErrorDecode(err)}</code>`);
  }
};

export const botAutoTrading = ({
  bot,
  intervals,
}: {
  bot: Telegraf;
  intervals: Map<string, IntervalConfig>;
}) => {
  bot.command("start", async (ctx) => {
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

    let tradeAbleCrypto = await getTradeAbleCrypto(config.tokenTradingMode);
    await ctx.reply(
      `Interval ${config.bar} | trade with ${tradeAbleCrypto.length} Ccy.`
    );
    if (tradeAbleCrypto.length === 0) {
      ctx.replyWithHTML("🛑 No currency to trade.");
      return;
    }
    const interval = setInterval(async () => {
      await fowardTrading({
        ctx,
        config: { ...config, interval },
        tradeAbleCrypto,
        lastestCandles,
        lastestSignalTs,
        intervalId: id,
      });
    }, config.intervalDelay);

    intervals.set(id, { ...config, tradeAbleCrypto, interval });

    const startReport = formatReportInterval(
      id,
      { ...config, interval },
      true,
      tradeAbleCrypto
    );
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
      report +=
        formatReportInterval(
          id,
          intervalConfig,
          false,
          intervalConfig?.tradeAbleCrypto
        ) + "\n";
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
