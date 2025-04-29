import { Context, NarrowedContext, Telegraf } from "telegraf";
import { Message, Update } from "telegraf/typings/core/types/typegram";
import { getAccountPositions } from "../../helper/okx.account";
import { getOKXFundingObject } from "../../helper/okx.funding";
import { wsCandles } from "../../helper/okx.socket";
import { closeFuturePosition, openFuturePosition } from "../../helper/okx.trade";
import {
  CampaignConfig,
  IOKXFunding,
  IPositionOpen,
  IPosSide,
  IWsCandlesReponse,
  OKXResponse
} from "../../type";
import { axiosErrorDecode, zerofy } from "../../utils";
import { parseConfigInterval } from "../../utils/config";
import { formatReportInterval } from "../../utils/message";
import { botPositions } from "./positions";

// Environment configuration
const MODE = process.env.ENV;
const isDev = MODE === "dev";

// Constants for trading parameters
const BEFORE_FUNDING_TO_ORDER = isDev ? 2 : 10 * 60;
const FUNDING_DOWNTO = isDev ? -0.1 : -2;
const FUNDING_UPTO = isDev ? 0.1 : -0.05;
const MIN_MAX_TP: [number, number] = [0.6, 0.8];
const MIN_MAX_SL: [number, number] = [1.5, 2];
const INTERVAL_TO_LOAD_FUNDING_ARBITRAGE = 15;
const RESTART_STRATEGY_AFTER_FUNDING = isDev ? 40 : 60 * 60;
const TIM_CLOSE_TO_FUNDING_MINUTES = isDev ? 1 : 15
export const DELAY_FOR_DCA_ORDER = isDev ? 20 : 45;
export const PX_CHANGE_TO_DCA = isDev ? 0.2 : 0.5;
// {
  // code: '1',
  // data: [
  //   {
  //     algoClOrdId: '',
  //     algoId: '2460351951473942528',
  //     reqId: '',
  //     sCode: '51279',
  //     sMsg: 'TP trigger price cannot be lower than the last price '
  //   }
  // ],
  // msg
/**
 * Calculates take profit and stop loss levels based on funding rate
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

/**
 * Calculates breakeven price for a position
 */
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

/**
 * Core trading logic implementation
 */
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
  const { mgnMode, leve, sz } = config;
  let variance = config.variance;
  
  try {
    const wsCandle = wsCandles?.data?.[0];
    const fundingData = fundingArbitrage[wsCandle.instId];
    const fundingRate = Number(fundingData?.fundingRate);
    
    if (!fundingRate) return;
    
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
      const openParams = {
        instId: wsCandle.instId,
        leverage: leve,
        mgnMode: mgnMode,
        size: sz,
        posSide: posSide as IPosSide,
        tpTriggerPx,
        slTriggerPx,
      };

      console.log(`Opening position for:`, openParams.instId);

      const { openPositionRes, openAlgoOrderRes } =
        await openFuturePosition(openParams);

      if (openPositionRes.code === "0" && openAlgoOrderRes.code === "0") {
        if (ctx) {
          await ctx.replyWithHTML(
            `🚀 <b>Position Opened Successfully</b> 🚀\n\n` +
            `📊 <b>Instrument:</b> ${openParams.instId}\n` +
            `💰 <b>Position Size:</b> ${openParams.size}\n` +
            `📈 <b>Direction:</b> ${posSide === "long" ? "🟢 Long" : "🔴 Short"}\n` +
            `⚡ <b>Funding Rate:</b> ${zerofy(fundingRate * 100)}%\n` +
            `🎯 <b>Take Profit:</b> ${zerofy(Number(tpTriggerPx))}\n` +
            `🛑 <b>Stop Loss:</b> ${zerofy(Number(slTriggerPx))}\n` +
            `⚙️ <b>Leverage:</b> ${leve}x\n` +
            `📝 <b>Margin Mode:</b> ${mgnMode}\n\n` +
            `⏱️ <b>Funding Time:</b> ${new Date(Number(fundingData.fundingTime)).toLocaleString()}`
          );
        }
      } else {
        if (ctx) {
          await ctx.replyWithHTML(
            `❌ <b>Failed to Open Position</b> ❌\n\n` +
            `📊 <b>Instrument:</b> ${openParams.instId}\n` +
            `📈 <b>Direction:</b> ${posSide === "long" ? "🟢 Long" : "🔴 Short"}\n\n` +
            `🚨 <b>Position Error:</b> <code>${openPositionRes.code}</code>\n` +
            `📄 <b>Position Message:</b> <code>${openPositionRes.msg}</code>\n\n` +
            `🚨 <b>Algo Order Error:</b> <code>${openAlgoOrderRes.code}</code>\n` +
            `📄 <b>Algo Order Message:</b> <code>${openAlgoOrderRes.msg}</code>`
          );
        }
      }
    }
  } catch (err: any) {
    await ctx.replyWithHTML(
      `❌ <b>Trading Error</b> ❌\n\n` +
      `📝 <b>Details:</b> <code>${axiosErrorDecode(err)}</code>\n\n` +
      `Please check your API connection and parameters.`
    );
  }
};

/**
 * WebSocket management for trading strategy
 */
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
        // Normal close
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
      }
    },
    subcribedCallBack(param) {
      console.log("Subscribed:", param);
    },
  });

  campaigns.set(id, { ...(campaigns.get(id) || config), tradeAbleCrypto, WS });
}

/**
 * Main bot trading initialization function
 */
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

  // Check if any pairs are close to funding time
  const isCloseToFundingTime = (fundingData: {
    [instId: string]: IOKXFunding;
  }): {[instId: string]: number } => {
    const now = Date.now();
    const closeToFundingList: {[instId: string]: number } = {}
    for (const instId in fundingData) {
      const fundingTimeMs = Number(fundingData[instId].fundingTime);
      const minutesLeft = (fundingTimeMs - now) / (60 * 1000);
      if (minutesLeft < TIM_CLOSE_TO_FUNDING_MINUTES && minutesLeft > 0) {
        closeToFundingList[instId] = Number(minutesLeft)
      }
    }
    return closeToFundingList
  };

  // Start funding update monitoring
  const startFundingUpdate = async (
    ctx: NarrowedContext<
      Context<Update>,
      {
        message:
          | (Update.New & Update.NonChannel & Message.AnimationMessage)
          | (Update.New & Update.NonChannel & Message.TextMessage);
        update_id: number;
      }
    >,
    id: string,
    config: CampaignConfig,
    // tradeAbleCrypto: string[],
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
        const pairsCloseToFunding = isCloseToFundingTime(fundingArbitrage)
        const pairsCloseToFundingInstIds = Object.keys(pairsCloseToFunding)
        if (pairsCloseToFundingInstIds.length > 0) {
          await ctx.replyWithHTML(
            `🏹 <b>Funding Time Approaching</b> 🏹\n\n` +
            `⚡ <b>Executing trading strategy with ${pairsCloseToFundingInstIds.length} pairs:</b>\n` +
            `<code>${pairsCloseToFundingInstIds.join(', ')}</code>\n\n` +
            `🕐 <b>Left:</b> ${pairsCloseToFunding[pairsCloseToFundingInstIds[0]]} minutes`
          );
          // const _tradeAbleCrypto =pairsCloseToFundingInstIds
          if (fundingUpdateInterval) clearInterval(fundingUpdateInterval);
          fundingUpdateInterval = null;

          // Execute trading strategy
          console.log("Execute trading strategy");
          forwardTradingWithWs({
            ctx,
            id,
            config,
            tradeAbleCrypto: pairsCloseToFundingInstIds,
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
            tradeAbleCrypto: pairsCloseToFundingInstIds,
            campaigns,
          });

          // Set timer to restart after funding time
          const campaignConfig = campaigns.get(id);
          if (campaignConfig) {
            setTimeout(async () => {
              // Stop all strategies
              if (campaignConfig.WS) campaignConfig.WS.close();
              if (campaignConfig.WSTicker) campaignConfig.WSTicker.close();
              if (campaignConfig.WSPositions) campaignConfig.WSPositions.close();
              
              const _position = await getAccountPositions("SWAP");
              console.log("Stop trading strategy | positions to close:", _position.length);
              
              const closeRes: { [instId: string]: OKXResponse } = {};
              await Promise.all(_position.map(async (pos) => {
                const { posSide, instId } = pos;
                const { closePositionRes } = await closeFuturePosition({
                  instId,
                  mgnMode: "isolated",
                  posSide: posSide as IPosSide,
                });
                flashPositions[instId] = false;
                closeRes[instId] = closePositionRes;
              }));
              
              if (ctx && Object.keys(closeRes).filter(cRes => closeRes[cRes].code === "0").length === _position.length) {
                await ctx.replyWithHTML(
                  `💫 <b>All Positions Closed Successfully</b> 💫\n\n` +
                  `✅ <b>Total Positions:</b> ${_position.length}\n` +
                  `⏱️ <b>Time:</b> ${new Date().toLocaleString()}\n\n` +
                  `📊 <b>Strategy Cycle Complete</b>`
                );
              } else {
                const successfulCloses = Object.keys(closeRes).filter(cRes => closeRes[cRes].code === "0").length;
                const failedCloses = _position.length - successfulCloses;
                
                await ctx.replyWithHTML(
                  `⚠️ <b>Position Closure Status</b> ⚠️\n\n` +
                  `✅ <b>Successful:</b> ${successfulCloses}/${_position.length}\n` +
                  `❌ <b>Failed:</b> ${failedCloses}\n\n` +
                  `📝 <b>Details:</b>\n<code>${JSON.stringify(closeRes, null, 2)}</code>`
                );
              }
              
              // Restart funding update
              startFundingUpdate(ctx, id, config, campaigns);
              await ctx.replyWithHTML(
                `🔄 <b>Restarting Funding Arbitrage Monitor</b> 🔄\n\n` +
                `📊 <b>Campaign ID:</b> <code>${id}</code>\n` +
                `🕐 <b>Time:</b> ${new Date().toLocaleString()}\n\n` +
                `⏳ <b>Monitoring for next funding opportunity...</b>`
              );
            }, TIM_CLOSE_TO_FUNDING_MINUTES * 60 * 1000 + RESTART_STRATEGY_AFTER_FUNDING * 1000);
          }
        }
      } catch (error) {
        console.error("Error updating funding arbitrage:", error);
        await ctx.replyWithHTML(
          `❌ <b>Funding Update Error</b> ❌\n\n` +
          `📝 <b>Details:</b> <code>${error}</code>\n\n` +
          `System will attempt to continue monitoring.`
        );
      }
    }, INTERVAL_TO_LOAD_FUNDING_ARBITRAGE * 1000);
  };

  // Bot command handlers
  bot.command("start", async (ctx) => {
    const [id, ...configStrings] = ctx.message.text.split(" ").slice(1);
    const config = parseConfigInterval(configStrings.join(" "));
    
    if (campaigns.has(id)) {
      await ctx.replyWithHTML(
        `🚫 <b>Campaign Already Active</b> 🚫\n\n` +
        `Trading campaign with ID <code>${id}</code> is already running.\n` +
        `Use /tasks to see active campaigns or /stop ${id} to stop this one.`
      );
      return;
    }
    
    campaigns.set(id, config);

    // Initial fetch of funding arbitrage
    // fundingArbitrage = await getOKXFundingObject({
    //   fundingDownTo: FUNDING_DOWNTO,
    //   fundingUpTo: FUNDING_UPTO,
    // });

    // let tradeAbleCrypto = Object.keys(fundingArbitrage);

    await ctx.replyWithHTML(
      `📊 <b>Campaign Initialized</b> 📊\n` +
      `⚙️ <b>Mode:</b> ${isDev ? "Development" : "Production"}`
    );

    // if (tradeAbleCrypto.length === 0) {
    //   await ctx.replyWithHTML(
    //     `🛑 <b>No Trading Pairs Available</b> 🛑\n\n` +
    //     `Could not find any currency pairs matching the funding criteria:\n` +
    //     `• Funding Down To: ${FUNDING_DOWNTO}%\n` +
    //     `• Funding Up To: ${FUNDING_UPTO}%\n\n` +
    //     `Please adjust parameters or try again later.`
    //   );
    //   return;
    // }

    // Start the funding update interval
    startFundingUpdate(ctx, id, config, campaigns);

    const startReport = formatReportInterval(
      id,
      { ...config },
      true,
      // tradeAbleCrypto
    );
    
    await ctx.replyWithHTML(startReport);
  });

  bot.command("stop", async (ctx) => {
    const id = ctx.message.text.split(" ")[1];

    if (!campaigns.has(id)) {
      await ctx.replyWithHTML(
        `🚫 <b>Campaign Not Found</b> 🚫\n\n` +
        `No active trading campaign found with ID <code>${id}</code>.\n` +
        `Use /tasks to see active campaigns.`
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
    
    await ctx.replyWithHTML(
      `✅ <b>Campaign Stopped Successfully</b> ✅\n\n` +
      `Campaign with ID <code>${id}</code> has been terminated.\n` +
      `All WebSocket connections closed and monitoring stopped.\n\n` +
      `🕐 <b>Time:</b> ${new Date().toLocaleString()}`
    );
  });

  bot.command("tasks", async (ctx) => {
    if (campaigns.size === 0) {
      await ctx.replyWithHTML(
        `📭 <b>No Active Campaigns</b> 📭\n\n` +
        `There are currently no running trading campaigns.\n` +
        `Use /start [id] [config] to initialize a new campaign.`
      );
      return;
    }

    let report = `🔍 <b>Active Trading Campaigns</b> 🔍\n\n`;
    campaigns.forEach((campaignConfig, id) => {
      report += formatReportInterval(
        id,
        campaignConfig,
        false,
        campaignConfig?.tradeAbleCrypto
      ) + "\n\n";
    });
    
    report += `📝 <b>Total Campaigns:</b> ${campaigns.size}\n` +
              `🕐 <b>Time:</b> ${new Date().toLocaleString()}`;

    await ctx.replyWithHTML(report);
  });

  bot.command("stops", async (ctx) => {
    if (campaigns.size === 0) {
      await ctx.replyWithHTML(
        `📭 <b>No Active Campaigns</b> 📭\n\n` +
        `There are currently no running trading campaigns to stop.`
      );
      return;
    }
    
    const campaignCount = campaigns.size;
    
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
    
    await ctx.replyWithHTML(
      `🛑 <b>All Campaigns Stopped</b> 🛑\n\n` +
      `✅ <b>Terminated:</b> ${campaignCount} campaigns\n` +
      `🔌 <b>Connections:</b> All WebSockets closed\n` +
      `⏱️ <b>Monitoring:</b> All intervals cleared\n\n` +
      `🕐 <b>Time:</b> ${new Date().toLocaleString()}`
    );
  });
  bot.command("funding", async (ctx) => {
    try {
      // Check if there's funding data available
      if (Object.keys(fundingArbitrage).length === 0) {
        await ctx.replyWithHTML(
          `🔍 <b>No Funding Data Available</b> 🔍\n\n` +
          `⚠️ Funding data hasn't been loaded yet or no pairs match the criteria.\n` +
          `• 📉 Funding Down To: ${FUNDING_DOWNTO}%\n` +
          `• 📈 Funding Up To: ${FUNDING_UPTO}%\n\n` +
          `💡 Start a campaign first or try again later.`
        );
        return;
      }
  
      // Check for close to funding time pairs
      const pairsCloseToFunding = isCloseToFundingTime(fundingArbitrage);
      const pairsCloseToFundingInstIds = Object.keys(pairsCloseToFunding);
      
      // Sort pairs by funding rate (highest to lowest)
      const sortedPairs = Object.entries(fundingArbitrage)
        .sort((a, b) => parseFloat(b[1].fundingRate) - parseFloat(a[1].fundingRate));
      
      // Take top 10 pairs for display
      const topPairs = sortedPairs.slice(0, 10);
      
      // Format funding data
      let fundingReport = `💰 <b>Funding Arbitrage Report</b> 💰\n\n`;
      
      // Add close to funding time alert if applicable
      if (pairsCloseToFundingInstIds.length > 0) {
        fundingReport += `⏰ <b>Pairs Close to Funding Time:</b> ${pairsCloseToFundingInstIds.length}\n`;
        pairsCloseToFundingInstIds.forEach(instId => {
          const minutesLeft = pairsCloseToFunding[instId];
          fundingReport += `  • ${minutesLeft < 10 ? '🟣' : '🟡'} <code>${instId}</code>: ${zerofy(minutesLeft)} minutes left\n`;
        });
        fundingReport += `\n`;
      }
      
      // Add top funding rates
      fundingReport += `🏆 <b>Top Funding Opportunities:</b>\n`;
      topPairs.forEach(([instId, data], index) => {
        const fundingTime = new Date(Number(data.fundingTime)).toLocaleString();
        const fundingRate = zerofy((parseFloat(data.fundingRate) * 100));
        const nextRate = zerofy((parseFloat(data.nextFundingRate) * 100));
        const rateIcon = parseFloat(data.fundingRate) > 0 ? '📈' : '📉';
        
        // Medal emojis for top 3
        let rankEmoji = '   ';
        if (index === 0) rankEmoji = '🥇 ';
        else if (index === 1) rankEmoji = '🥈 ';
        else if (index === 2) rankEmoji = '🥉 ';
        
        fundingReport += `${rankEmoji}<code>${instId}</code> ${rateIcon} <b>${fundingRate}%</b>\n`;
        fundingReport += `   ┣ 📊 <i>APY:</i> ${zerofy(parseFloat(data.apy))}%\n`;
        fundingReport += `   ┣ 🔮 <i>Next Rate:</i> ${nextRate}%\n`;
        fundingReport += `   ┗ 🕒 <i>Funding:</i> ${fundingTime}\n`;
      });
      
      // Add summary statistics
      const totalPairs = Object.keys(fundingArbitrage).length;
      const avgFundingRate = sortedPairs.reduce((sum, [_, data]) => sum + parseFloat(data.fundingRate), 0) / totalPairs;
      const positiveRatePairs = sortedPairs.filter(([_, data]) => parseFloat(data.fundingRate) > 0).length;
      const negativeRatePairs = sortedPairs.filter(([_, data]) => parseFloat(data.fundingRate) < 0).length;
      
      fundingReport += `\n📊 <b>Market Overview:</b>\n`;
      fundingReport += `┣ 🔢 <b>Total Pairs:</b> ${totalPairs}\n`;
      fundingReport += `┣ 📈 <b>Positive Rates:</b> ${positiveRatePairs}\n`;
      fundingReport += `┣ 📉 <b>Negative Rates:</b> ${negativeRatePairs}\n`;
      fundingReport += `┣ 🔍 <b>Avg Rate:</b> ${zerofy((avgFundingRate * 100))}%\n`;
      fundingReport += `┗ 🕰️ <b>Updated:</b> ${new Date().toLocaleString()}\n\n`;
      
      fundingReport += `💡 <i>Use /tasks to view active campaigns</i>`;
      
      await ctx.replyWithHTML(fundingReport);
    } catch (error: any) {
      console.error("Error in funding command:", error);
      await ctx.replyWithHTML(
        `❌ <b>Funding Data Error</b> ❌\n\n` +
        `🚫 An error occurred while processing funding information.\n\n` +
        `📝 <b>Details:</b>\n<code>${error.message || error}</code>\n\n` +
        `🔄 Please try again later or check the system logs.`
      );
    }
  });
};