import dotenv from "dotenv";
import { Context, NarrowedContext, Telegraf } from "telegraf";
import { Message, Update } from "telegraf/typings/core/types/typegram";
import { getSymbolCandles } from "../../helper/okx.candles";
import {
  closeFuturePosition,
  openFuturePosition,
} from "../../helper/okx.trade";
import { findEMACrossovers } from "../../signals/ema-cross";
import {
  ICandles,
  CampaignConfig,
  IPosSide,
  IWsCandlesReponse,
  IWsTickerReponse,
  IOKXFunding,
} from "../../type";
import {
  axiosErrorDecode,
  decodeSymbol,
  decodeTimestamp,
  decodeTimestampAgo,
  estimatePnl,
  getTradeAbleCrypto,
  zerofy,
} from "../../utils";
import {
  parseConfigInterval,
  USDT,
  WHITE_LIST_TOKENS_TRADE,
} from "../../utils/config";
import { formatReportInterval } from "../../utils/message";
import { calculateATR } from "../../signals/atr";
import { wsCandles, wsTicks } from "../../helper/okx.socket";
import { setTimeout } from "timers/promises";
import { botTrailingLossByATR } from "./trailing";
import WebSocket from "ws";
import { getAccountPositions, getUSDTBalance, getUSDTEquity } from "../../helper/okx.account";
import {getOKXFunding} from "../../helper/okx.funding";
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
const _fowardTrading = async ({
  ctx,
  config,
  tradeAbleCrypto,
  lastestSignalTs,
  wsCandles,
  campaignId,
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
  wsCandles: IWsTickerReponse;
  config: CampaignConfig;
  tradeAbleCrypto: string[];
  lastestSignalTs: { [instId: string]: number }; // Lastest EmaCross bot make Tx
  campaignId?: string;
  campaigns: Map<string, CampaignConfig>;
}) => {
  const {
    bar,
    mgnMode,
    leve,
    sz,
    slopeThresholdUp,
    equityPercent,
    tradeDirection,
    slopeThresholdUnder,
  } = config;
  let variance = config.variance;
  try {
    // const wsCandle = wsCandles?.data?.[0];
    // if (wsCandle.confirm !== "1") return;
    // console.log(`[${campaignId}] new epoch`);
    // const positions = await getAccountPositions("SWAP");
    // const usdtEquity = await getUSDTEquity();
    // const posSz =
    //   ((usdtEquity * (equityPercent / 100)) / tradeAbleCrypto.length) * leve;
    // console.log("#posSz", posSz, "|", "#usdtEquity", usdtEquity);
    // console.log(positions.map((e) => [e.instId, e.notionalUsd]));
    
    console.log("abc",wsCandles.data)
  } catch (err: any) {
    await ctx.replyWithHTML(`Error: <code>${axiosErrorDecode(err)}</code>`);
  }
};

function forwardTradingWithWs({
  ctx,
  id,
  config,
  tradeAbleCrypto,
  lastestSignalTs,
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
  lastestSignalTs: { [instId: string]: number };
  campaigns: Map<string, CampaignConfig>;
}) {
  const WS = wsTicks({
    subscribeMessage: {
      op: "subscribe",
      args: tradeAbleCrypto.map(e => {
        return {
          channel: `mark-price`,
          instId: e,
        };
      })
    },
    messageCallBack(wsCandles) {
      _fowardTrading({
        ctx,
        config: { ...config, WS },
        tradeAbleCrypto,
        wsCandles,
        lastestSignalTs,
        campaignId: id,
        campaigns,
      });
    },
    closeCallBack(code) {
      console.error(`[TRADING] WebSocket closed with code: ${code}`);
      if (code === 1005) {
        ctx.replyWithHTML(
          `🔗 [TRADING] WebSocket connection terminated for <b><code>${id}</code>.</b>`,
        );
        // campaigns.delete(id);
      } else {
        forwardTradingWithWs({
          ctx,
          id,
          config,
          tradeAbleCrypto,
          lastestSignalTs,
          campaigns,
        });

        ctx.replyWithHTML(
          `⛓️ [TRADING] [${code}] WebSocket disconnected for <b><code>${id}</code>.</b> Attempting reconnection.`,
        );
      }
    },
    subcribedCallBack(param) {
      console.log("Subscribed:", param);
    },
  });

  campaigns.set(id, { ...(campaigns.get(id) || config), tradeAbleCrypto, WS });
}
export const botAutoTrading = ({
  bot,
  campaigns,
}: {
  bot: Telegraf;
  campaigns: Map<string, CampaignConfig>;
}) => {
  let lastestSignalTs: { [instId: string]: number } = {};
  bot.command("start", async (ctx) => {
    const [id, ...configStrings] = ctx.message.text.split(" ").slice(1);
    const config = parseConfigInterval(configStrings.join(" "));

    if (campaigns.has(id)) {
      ctx.replyWithHTML(
        `🚫 Trading interval with ID <code>${id}</code> is already active.`,
      );
      return;
    }
    // const _OKXFundingList = await getOKXFunding()
    // const OKXFundingList = _OKXFundingList.filter(e => Number(e.fundingRate) < -0.001 && Number(e.fundingRate) > -0.04 && e.buyInstType === "SWAP")
    // console.log(OKXFundingList)
    let tradeAbleCrypto = await getTradeAbleCrypto(config.tokenTradingMode);
    await ctx.reply(
      `Interval ${config.bar} | trade with ${tradeAbleCrypto.length} Ccy.`,
    );
    if (tradeAbleCrypto.length === 0) {
      ctx.replyWithHTML("🛑 No currency to trade.");
      return;
    }
    forwardTradingWithWs({
      ctx,
      id,
      config,
      tradeAbleCrypto,
      // OKXFundingList,
      lastestSignalTs,
      campaigns,
    });

    const startReport = formatReportInterval(
      id,
      { ...config },
      true,
      tradeAbleCrypto,
    );
    ctx.replyWithHTML(startReport);
    // await setTimeout(5000);
    // WS?.close();
  });

  bot.command("stop", (ctx) => {
    const id = ctx.message.text.split(" ")[1];

    if (!campaigns.has(id)) {
      ctx.replyWithHTML(
        `🚫 No active trading interval found with ID <code>${id}</code>.`,
      );
      return;
    }

    const CampaignConfig = campaigns.get(id);
    CampaignConfig?.WS?.close();
    CampaignConfig?.WSTicker?.close();
    CampaignConfig?.WSTrailing?.close();
    campaigns.delete(id);
  });

  bot.command("tasks", (ctx) => {
    if (campaigns.size === 0) {
      ctx.replyWithHTML("📭 No trading campaigns are currently active.");
      return;
    }

    let report = "<b>Current Trading campaigns:</b>\n";
    campaigns.forEach((CampaignConfig, id) => {
      report +=
        formatReportInterval(
          id,
          CampaignConfig,
          false,
          CampaignConfig?.tradeAbleCrypto,
        ) + "\n";
    });

    ctx.replyWithHTML(report);
  });

  bot.command("stops", (ctx) => {
    campaigns.forEach((CampaignConfig) => {
      try {
        CampaignConfig?.WS?.close();
        CampaignConfig?.WSTicker?.close();
        CampaignConfig?.WSTrailing?.close();
      } catch (error) {
        console.log(error);
      }
    });
    campaigns.clear();
    ctx.replyWithHTML("🛑 All trading campaigns have been stopped.");
  });
};
