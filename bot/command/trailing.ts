import dotenv from "dotenv";
import { Context, NarrowedContext, Telegraf } from "telegraf";
import { Message, Update } from "telegraf/typings/core/types/typegram";
import { getSymbolCandles } from "../helper/okx.candles";
import { closeFuturePosition, openFuturePosition } from "../helper/okx.trade";
import { findEMACrossovers } from "../signals/ema-cross";
import { ICandles, CampaignConfig, IPosSide, IWsCandlesReponse, IPositionOpen, CandleWithATR } from "../type";
import {
  axiosErrorDecode,
  decodeSymbol,
  decodeTimestamp,
  decodeTimestampAgo,
  estimatePnl,
  getTradeAbleCrypto,
  zerofy,
} from "../utils";
import {
  parseConfigInterval,
  USDT,
  WHITE_LIST_TOKENS_TRADE,
} from "../utils/config";
import { formatReportInterval } from "../utils/message";
import { calculateATR } from "../signals/atr";
import { wsCandles, wsPositions } from "../helper/okx.socket";
import { setTimeout } from "timers/promises";
import {getAccountPendingAlgoOrders} from "../helper/okx.account";
dotenv.config();
/**
 * Executes trading logic for the given interval configuration.
 *
 * @param {Object} ctx - The context from the Telegram bot, used to send messages to the user.
 * @param {CampaignConfig} config - Configuration object for the trading interval, including:
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
 * @param {string} [campaignId] - Optional ID of the trading interval for logging and tracking purposes.
 *
 * @returns {Promise<void>} - Sends trade signals via the Telegram bot if an EMA crossover occurs, and opens or closes positions based on the type of crossover (bullish or bearish).
 * Handles both opening and closing positions based on EMA crossovers and applies slope filtering if configured.
 * Sends notifications of trade actions to the user via the Telegram bot context.
 *
 * @throws {Error} - If any error occurs during the trading logic execution, it is logged, and an error message is sent to the user via the Telegram bot.
 */
const _fowardTrailing = async ({
  ctx,
  config,
  tradeAbleCrypto,
  wsPositions
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
  wsPositions: IPositionOpen[];
  config: CampaignConfig;
  tradeAbleCrypto: string[];
}) => {
  const { bar, mgnMode, leve, variance, sz, slopeThresholdUp, slopeThresholdUnder } = config;
  try {
    const algoOrders = await getAccountPendingAlgoOrders({});
    const _wsPositions =  wsPositions.filter((pos) => {
      if(!tradeAbleCrypto.includes(pos.instId)) return false;
      const algoOrder = algoOrders.filter(
        (aOrd) => aOrd.instId === pos.instId
      )?.[0];
      if (algoOrder?.moveTriggerPx || algoOrder?.callbackRatio) return false; // Already set a trailing loss orders
      return true
    });
    // console.log(_wsPositions.map(i => i.instId))

  } catch (err: any) {
    await ctx.replyWithHTML(`Error: <code>${axiosErrorDecode(err)}</code>`);
  }
};

function forwardTrailingWithWs({
  ctx,
  id,
  config,
  tradeAbleCrypto,
  campaigns,
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
  id: string;
  config: CampaignConfig;
  tradeAbleCrypto: string[];
  campaigns: Map<string, CampaignConfig>;
}) {
    let tradeAbleCryptoCandles: { [instId: string]: ICandles } = {};
    let tradeAbleCryptoATRs: { [instId: string]: CandleWithATR[] } = {};
  
  const WSTrailing = wsPositions({
    authCallBack(config) {console.log(config)},
    subcribedCallBack(param) {console.log(param)},
    messageCallBack(pos) {
        _fowardTrailing({
            config,
            ctx,
            wsPositions: pos.data,
            tradeAbleCrypto
        })    
    },
    errorCallBack(e) {console.log(e)},
    closeCallBack(code, reason) {
        console.error("WS Trailing closed with code: ", code);
      if (code === 1005) {
        ctx.replyWithHTML(
          `🛑 Stopped trailing position <b><code>${id}</code>.</b>`
        );
        campaigns.delete(id);
      } else {
        forwardTrailingWithWs({
          ctx,
          id,
          config,
          tradeAbleCrypto,
          campaigns,
        });
        ctx.replyWithHTML(
          `⛓️ [${code}] Trailing socket disconnected for <b><code>${id}</code>.</b> Reconnected`
        );
      }
    },
  });

  campaigns.set(id, { ...config, tradeAbleCrypto, WSTrailing });
}
export const botTrailingLossByATR = ({
  ctx,
  id,
  config,
  tradeAbleCrypto,
  campaigns,
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
  id: string;
  config: CampaignConfig;
  tradeAbleCrypto: string[];
  campaigns: Map<string, CampaignConfig>;
}) => {
  forwardTrailingWithWs({
    ctx,
    id,
    config,
    tradeAbleCrypto,
    campaigns,
  });
};
