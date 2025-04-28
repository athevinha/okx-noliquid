import {Context,NarrowedContext,Telegraf} from "telegraf";
import {Message,Update} from "telegraf/typings/core/types/typegram";
import {
  getAccountPositions
} from "../../helper/okx.account";
import {getOKXFundingObject} from "../../helper/okx.funding";
import {wsCandles} from "../../helper/okx.socket";
import {
  closeFuturePosition,
  openFuturePosition,
} from "../../helper/okx.trade";
import {
  CampaignConfig,
  IOKXFunding,
  IPositionOpen,
  IPosSide,
  IWsCandlesReponse,
  OKXResponse
} from "../../type";
import {
  axiosErrorDecode,
  zerofy
} from "../../utils";
import {
  parseConfigInterval
} from "../../utils/config";
import {formatReportInterval} from "../../utils/message";
import {botPositions} from "./positions";
const MODE = process.env.ENV;
const isDev = MODE === "dev";
const BEFORE_FUNDING_TO_ORDER = isDev ? 2 : 10 * 60;
const FUNDING_DOWNTO = isDev ? -0.1 : -2;
const FUNDING_UPTO = isDev ? 0.1 : -0.05;
const MIN_MAX_TP: [number, number] = [0.6, 0.8];
const MIN_MAX_SL: [number, number] = [1.5, 2];
const INTERVAL_TO_LOAD_FUNDING_ARBITRAGE = 5;
const RESTART_STRATEGY_AFTER_FUNDING = isDev ? 40 : 60 * 60;
export const DELAY_FOR_DCA_ORDER = isDev ? 20 : 45;
export const PX_CHANGE_TO_DCA = isDev ? 0.2 : 0.5;
// const env = process.env.ENV || "dev"; // fallback to 'dev' mode
// const envPath = `.env.${env}`;
// if (existsSync(envPath)) {
//   config({ path: envPath });
//   console.log(`✅ Loaded ${envPath}`);
// } else {
//   console.warn(`⚠️ Environment file ${envPath} not found.`);
// }
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

export const calcTpSL = ({
  px,
  fundingRate,
  posSide,
  tpMinMax = MIN_MAX_TP,
  slMinMax = MIN_MAX_SL,
}: {
  px: string;
  fundingRate: number;
  posSide: IPosSide;
  tpMinMax?: [number, number];
  slMinMax?: [number, number];
}) => {
  const tpPercent = Math.min(
    Math.max(Math.abs(fundingRate) * 2, tpMinMax[0] / 100),
    tpMinMax[1] / 100
  );
  const slPercent = Math.min(
    Math.max(Math.abs(fundingRate) * 2, slMinMax[0] / 100),
    slMinMax[1] / 100
  );
  return {
    tpTriggerPx: String(
      posSide === "long"
        ? Number(px) * (1 + tpPercent)
        : Number(px) * (1 - tpPercent)
    ),
    slTriggerPx: String(
      posSide === "long"
        ? Number(px) * (1 - slPercent)
        : Number(px) * (1 + slPercent)
    ),
  };
};

export const calcBreakEvenPx = ({
  posSide,
  avgPx,
  realizedPnl,
  notionalUsd,
}: {
  posSide: IPosSide;
  avgPx: string;
  realizedPnl: string;
  notionalUsd: string;
}) => {
  let breakevenPx;
  if (posSide === "long") {
    breakevenPx =
      Number(avgPx) -
      (Number(realizedPnl) * Number(avgPx)) / Number(notionalUsd);
  } else if (posSide === "short") {
    breakevenPx =
      Number(avgPx) +
      (Number(realizedPnl) * Number(avgPx)) / Number(notionalUsd);
  }
  return String(breakevenPx);
};
const _fowardTrading = async ({
  ctx,
  config,
  tradeAbleCrypto,
  lastestSignalTs,
  wsCandles,
  flashPositions,
  fundingArbitrage,
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
  wsCandles: IWsCandlesReponse;
  config: CampaignConfig;
  tradeAbleCrypto: string[];
  lastestSignalTs: { [instId: string]: number };
  fundingArbitrage: { [instId: string]: IOKXFunding };
  flashPositions: { [instId: string]: boolean };
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
    const wsCandle = wsCandles?.data?.[0];
    const fundingData = fundingArbitrage[wsCandle.instId];
    const fundingRate = Number(fundingData?.fundingRate);
    if(!fundingRate) return;
    const now = Date.now();
    const fundingTimeLeftMs = Number(fundingData.fundingTime) - now;
    const fundingTimeLeftSec = fundingTimeLeftMs / 1000;
    const timeToOpen = BEFORE_FUNDING_TO_ORDER;
    const posSide = fundingRate < 0 ? "long" : "short";

    console.log(
      `${wsCandle.instId} | ${fundingTimeLeftSec}s | ${wsCandle.c} | ${zerofy(fundingRate * 100)}%`
    );

    if (
      fundingTimeLeftSec <= timeToOpen &&
      fundingTimeLeftSec > timeToOpen - 1 &&
      !flashPositions[wsCandle.instId]
    ) {
      const { tpTriggerPx, slTriggerPx } = calcTpSL({
        fundingRate: Number(fundingRate),
        posSide,
        px: wsCandle.c,
      });

      flashPositions[wsCandle.instId] = true;
      const openParams: any = {
        instId: wsCandle.instId,
        leverage: config.leve,
        mgnMode: config.mgnMode,
        size: config.sz,
        posSide,
        tpTriggerPx,
        slTriggerPx,
      };

      console.log(`Opening position with params:`, openParams);

      const { openPositionRes, openAlgoOrderRes } =
        await openFuturePosition(openParams);

      if (openPositionRes.code === "0" && openAlgoOrderRes.code === "0") {
        if (ctx) {
          await ctx.replyWithHTML(
            `🚀 Successfully opened position for <b>${openParams.instId}</b>\n` +
              `- Size: <b>${openParams.size}</b>\n` +
              `- Side: <b>${openParams.posSide}</b>\n` +
              `- TP %: <b>${zerofy(openParams.tpTriggerPx)}</b>\n` +
              `- SL %: <b>${zerofy(openParams.slTriggerPx)}</b>`
          );
        }
      } else {
        if (ctx) {
          await ctx.replyWithHTML(
            `❌ Failed to open position for <b>${openParams.instId}</b>\n` +
              `- Error Code: <code>${openPositionRes.code} | ${openAlgoOrderRes.code}</code>\n ` +
              `- Error Message: <code>${openPositionRes.msg} | ${openAlgoOrderRes.msg}</code>`
          );
        }
      }
    }
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
  fundingArbitrage,
  flashPositions,
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
  flashPositions: { [instId: string]: boolean };
  fundingArbitrage: { [instId: string]: IOKXFunding };
  campaigns: Map<string, CampaignConfig>;
}) {
  const WS = wsCandles({
    subscribeMessage: {
      op: "subscribe",
      args: tradeAbleCrypto.map((e) => {
        return {
          channel: `mark-price-candle1m`,
          instId: e,
        };
      }),
    },
    messageCallBack(wsCandles) {
      _fowardTrading({
        ctx,
        config: { ...config, WS },
        tradeAbleCrypto,
        wsCandles,
        lastestSignalTs,
        fundingArbitrage,
        flashPositions,
        campaignId: id,
        campaigns,
      });
    },
    closeCallBack(code) {
      console.error(`[TRADING] WebSocket closed with code: ${code}`);
      if (code === 1005) {
        ctx.replyWithHTML(
          `🔗 [TRADING] WebSocket connection terminated for <b><code>${id}</code>.</b>`
        );
        // campaigns.delete(id);
      } else {
        forwardTradingWithWs({
          ctx,
          id,
          config,
          fundingArbitrage,
          tradeAbleCrypto,
          flashPositions,
          lastestSignalTs,
          campaigns,
        });

        ctx.replyWithHTML(
          `⛓️ [TRADING] [${code}] WebSocket disconnected for <b><code>${id}</code>.</b> Attempting reconnection.`
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
  let fundingArbitrage: { [instId: string]: IOKXFunding } = {};
  let flashPositions: { [instId: string]: boolean } = {};
  let positions: { [instId: string]: IPositionOpen } = {};
  let fundingUpdateInterval: NodeJS.Timeout | null = null;

  // Function to check if any pairs are close to funding time
  const isCloseToFundingTime = (fundingData: {
    [instId: string]: IOKXFunding;
  }): boolean => {
    const now = Date.now();
    for (const instId in fundingData) {
      const fundingTimeMs = Number(fundingData[instId].fundingTime);
      const minutesLeft = (fundingTimeMs - now) / (60 * 1000);
      if (minutesLeft < 30 && minutesLeft > 0) {
        return true;
      }
    }
    return false;
  };

  // Function to restart funding arbitrage update
  const startFundingUpdate = async (
    ctx: any,
    id: string,
    config: any,
    tradeAbleCrypto: string[],
    campaigns: Map<string, CampaignConfig>
  ) => {
    // Clear any existing interval
    if (fundingUpdateInterval) {
      clearInterval(fundingUpdateInterval);
    }

    // Initial fetch
    fundingArbitrage = await getOKXFundingObject({
      fundingDownTo: FUNDING_DOWNTO,
      fundingUpTo: FUNDING_UPTO,
    });

    // Start interval for updating funding arbitrage
    fundingUpdateInterval = setInterval(async () => {
      try {
        // Update funding arbitrage data
        fundingArbitrage = await getOKXFundingObject({
          fundingDownTo: FUNDING_DOWNTO,
          fundingUpTo: FUNDING_UPTO,
        });
        console.log(
          "Load funding arbitrage",
          Object.keys(fundingArbitrage).length
        );
        // Check if any pairs are close to funding time
        if (isCloseToFundingTime(fundingArbitrage)) {
          console.log("Close to funding time, executing trading strategy");
          if (fundingUpdateInterval) clearInterval(fundingUpdateInterval);
          fundingUpdateInterval = null;

          // Execute trading strategy

          console.log("Execute trading strategy");
          forwardTradingWithWs({
            ctx,
            id,
            config,
            tradeAbleCrypto,
            fundingArbitrage,
            flashPositions,
            lastestSignalTs,
            campaigns,
          });

          botPositions({
            ctx,
            id,
            config,
            positions,
            fundingArbitrage,
            tradeAbleCrypto,
            campaigns,
          });

          // Set timer to restart after funding time (60 minutes after funding)
          const campaignConfig = campaigns.get(id);
          if (campaignConfig) {
            setTimeout(async () => {
              // Stop all strategies
              if (campaignConfig.WS) campaignConfig.WS.close();
              if (campaignConfig.WSTicker) campaignConfig.WSTicker.close();
              if (campaignConfig.WSPositions)
              campaignConfig.WSPositions.close();
              const _position = await getAccountPositions("SWAP")
              console.log("Stop trading strategy | stop:", _position.length);
              const closeRes: {[instId: string] : OKXResponse} =  {}
              await Promise.all(_position.map(async (pos) => {
                const { posSide, instId} = pos;
                const { closePositionRes } = await closeFuturePosition({
                  instId,
                  mgnMode: "isolated",
                  posSide: posSide as IPosSide,
                })
                flashPositions[instId] = false;
                closeRes[instId] = closePositionRes
              }));
              if(ctx && Object.keys(closeRes).filter(cRes => closeRes[cRes].code === "0").length === _position.length) {
                ctx.replyWithHTML("💀 Close all positions!")
              } else {
                ctx.replyWithHTML(`🐧 Close missing positions! <code>${JSON.stringify(closeRes)}</code>`)
              }
              // Restart funding update
              startFundingUpdate(ctx, id, config, tradeAbleCrypto, campaigns);
              ctx.replyWithHTML(
                `Restarting funding arbitrage update for <code>${id}</code>`
              );
            }, RESTART_STRATEGY_AFTER_FUNDING * 1000); // 60 minutes
          }
        }
      } catch (error) {
        console.error("Error updating funding arbitrage:", error);
      }
    }, INTERVAL_TO_LOAD_FUNDING_ARBITRAGE * 1000);
  };

  bot.command("start", async (ctx) => {
    const [id, ...configStrings] = ctx.message.text.split(" ").slice(1);
    const config = parseConfigInterval(configStrings.join(" "));
    if (campaigns.has(id)) {
      ctx.replyWithHTML(
        `🚫 Trading interval with ID <code>${id}</code> is already active.`
      );
      return;
    }
    campaigns.set(id, config);

    // Initial fetch of funding arbitrage
    fundingArbitrage = await getOKXFundingObject({
      fundingDownTo: FUNDING_DOWNTO,
      fundingUpTo: FUNDING_UPTO,
    });

    let tradeAbleCrypto = Object.keys(fundingArbitrage);

    await ctx.reply(
      `Interval ${config.bar} | trade with ${tradeAbleCrypto.length} Ccy.`
    );

    if (tradeAbleCrypto.length === 0) {
      ctx.replyWithHTML("🛑 No currency to trade.");
      return;
    }

    // Start the funding update interval
    startFundingUpdate(ctx, id, config, tradeAbleCrypto, campaigns);

    const startReport = formatReportInterval(
      id,
      { ...config },
      true,
      tradeAbleCrypto
    );
    ctx.replyWithHTML(startReport);
  });

  bot.command("stop", (ctx) => {
    const id = ctx.message.text.split(" ")[1];

    if (!campaigns.has(id)) {
      ctx.replyWithHTML(
        `🚫 No active trading interval found with ID <code>${id}</code>.`
      );
      return;
    }

    const campaignConfig = campaigns.get(id);

    if (campaignConfig?.WS) campaignConfig.WS.close();
    if (campaignConfig?.WSTicker) campaignConfig.WSTicker.close();
    if (campaignConfig?.WSPositions) campaignConfig.WSPositions.close();

    // Clear funding update interval if it exists
    if (fundingUpdateInterval) {
      clearInterval(fundingUpdateInterval);
      fundingUpdateInterval = null;
    }

    campaigns.delete(id);
  });

  bot.command("tasks", (ctx) => {
    if (campaigns.size === 0) {
      ctx.replyWithHTML("📭 No trading campaigns are currently active.");
      return;
    }

    let report = "<b>Current Trading campaigns:</b>\n";
    campaigns.forEach((campaignConfig, id) => {
      report +=
        formatReportInterval(
          id,
          campaignConfig,
          false,
          campaignConfig?.tradeAbleCrypto
        ) + "\n";
    });

    ctx.replyWithHTML(report);
  });

  bot.command("stops", (ctx) => {
    campaigns.forEach((campaignConfig) => {
      try {
        if (campaignConfig?.WS) campaignConfig.WS.close();
        if (campaignConfig?.WSTicker) campaignConfig.WSTicker.close();
        if (campaignConfig?.WSPositions) campaignConfig.WSPositions.close();
      } catch (error) {
        console.log(error);
      }
    });

    // Clear funding update interval if it exists
    if (fundingUpdateInterval) {
      clearInterval(fundingUpdateInterval);
      fundingUpdateInterval = null;
    }

    campaigns.clear();
    ctx.replyWithHTML("🛑 All trading campaigns have been stopped.");
  });
};
