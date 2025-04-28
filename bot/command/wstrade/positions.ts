import dotenv from "dotenv";
import { Context, NarrowedContext } from "telegraf";
import { Message, Update } from "telegraf/typings/core/types/typegram";
import { wsPositions } from "../../helper/okx.socket";
import { closeFuturePosition, openFuturePosition } from "../../helper/okx.trade";
import { editLimitAlgoOrders } from "../../helper/okx.trade.algo";
import {
  CampaignConfig,
  CandleWithATR,
  ICandles,
  ImgnMode,
  IOKXFunding,
  IPositionOpen,
  IPosSide
} from "../../type";
import {
  axiosErrorDecode,
  okxReponseChecker,
  zerofy
} from "../../utils";
import { USDT } from "../../utils/config";
import { calcBreakEvenPx, calcTpSL, DELAY_FOR_DCA_ORDER, PX_CHANGE_TO_DCA } from "./trade";

dotenv.config();

/**
 * Core position management logic implementation
 * Handles position monitoring, DCA, and limit order adjustments
 */
const _fowardPositions = async ({
  ctx,
  config,
  wsPositions,
  fundingArbitrage,
  lastTimeDCAPositions,
  lastTimeAmendLimitPositions,
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
  fundingArbitrage: { [instId: string]: IOKXFunding };
  positions: { [instId: string]: IPositionOpen };
  id: string;
  campaigns: Map<string, CampaignConfig>;
  wsPositions: IPositionOpen[];
  config: CampaignConfig;
  tradeAbleCrypto: string[];
  tradeAbleCryptoCandles: { [instId: string]: ICandles };
  tradeAbleCryptoATRs: { [instId: string]: CandleWithATR[] };
  trablePositions: { [instId: string]: IPositionOpen | undefined };
  lastTimeDCAPositions: { [instId: string]: number };
  lastTimeAmendLimitPositions: { [instId: string]: number };
}) => {
  try {
    // Skip if no positions or invalid data
    if (!wsPositions[0]?.avgPx || wsPositions.length === 0) {
      return;
    }
    
    const wsInstIds = wsPositions.map((pos) => pos.instId);
    
    await Promise.all(
      wsPositions.map(async (pos) => {
        const {
          realizedPnl,
          uplRatio,
          avgPx,
          notionalUsd,
          closeOrderAlgo,
          instId,
          mgnMode,
          lever,
          posSide,
          fundingFee,
          markPx,
        } = pos;
        
        if (!closeOrderAlgo[0]) return;
        
        const breakevenPx = calcBreakEvenPx({
          posSide: posSide as IPosSide,
          avgPx,
          notionalUsd,
          realizedPnl
        });
        
        const fundingRate = fundingArbitrage?.[instId]?.fundingRate;
        if (!fundingRate) {
          console.log(`Missing funding rate for ${instId}`);
          return;
        }
        
        const pxChange = (Number(uplRatio) * 100) / Number(lever);
        const openParams = {
          instId: instId,
          leverage: config.leve,
          mgnMode: config.mgnMode,
          size: config.sz,
          posSide: posSide as IPosSide,
        };
        
        const { tpTriggerPx: newTpTriggerPx, slTriggerPx: newSlTriggerPx } = calcTpSL({
          fundingRate: Number(fundingRate),
          posSide: openParams.posSide,
          px: breakevenPx,
          tpMinMax: [0.2, 0.4]
        });
        
        const lastTimeDCA = lastTimeDCAPositions[instId];
        const lastTimeAmendLimit = lastTimeAmendLimitPositions[instId];
        
        // Handle DCA (Dollar-Cost Averaging) logic when price moves against position
        if (
          pxChange < -PX_CHANGE_TO_DCA &&
          (!lastTimeDCA || Date.now() - lastTimeDCA > DELAY_FOR_DCA_ORDER * 1000) &&
          closeOrderAlgo[0].algoId
        ) {
          lastTimeDCAPositions[instId] = Date.now();
          
          // Calculate estimated new average price and size after DCA
          const estNewAvgPx = String(
            (Number(avgPx) * Number(notionalUsd) + Number(markPx) * openParams.size) / 
            (Number(notionalUsd) + openParams.size)
          );
          
          const estNewSz = String(Number(notionalUsd) + openParams.size);
          
          // Open additional position for DCA
          const { openPositionRes } = await openFuturePosition(openParams);
          
          // Calculate new breakeven and TP/SL levels
          const estBreakevenPx = calcBreakEvenPx({
            posSide: posSide as IPosSide,
            avgPx: estNewAvgPx,
            notionalUsd: estNewSz,
            realizedPnl
          });
          
          const { tpTriggerPx, slTriggerPx } = Number(fundingFee) <= 0 ?
            calcTpSL({
              fundingRate: Number(fundingRate),
              posSide: openParams.posSide,
              px: estNewAvgPx
            }) :
            calcTpSL({
              fundingRate: Number(fundingRate),
              posSide: openParams.posSide,
              px: estBreakevenPx,
              tpMinMax: [0.2, 0.4]
            });
          
          // Update algorithm order with new TP/SL levels
          const editAlgoRes = await editLimitAlgoOrders({
            instId: instId,
            algoId: closeOrderAlgo[0].algoId,
            newSlTriggerPx: slTriggerPx,
            newTpTriggerPx: tpTriggerPx
          });
          
          // Notify user about DCA results
          if (okxReponseChecker(openPositionRes) && okxReponseChecker(editAlgoRes)) {
            const percentChange = ((Number(estNewAvgPx) - Number(avgPx)) / Number(avgPx) * 100).toFixed(2);
            const directionArrow = posSide === "long" ? "📈" : "📉";
            
            const txt = `🔄 <b>DCA Position Updated</b> ${directionArrow}\n\n` +
              `🪙 <b>Instrument:</b> ${pos.instId}\n` +
              `📊 <b>Direction:</b> ${posSide === "long" ? "🟢 Long" : "🔴 Short"}\n\n` +
              `📌 <b>Average Price:</b>\n` +
              `   ⬥ Before: <code>${zerofy(avgPx)} ${USDT}</code>\n` +
              `   ⬥ After:  <code>${zerofy(estNewAvgPx)} ${USDT}</code> (${percentChange}%)\n\n` +
              `💰 <b>Position Size:</b>\n` +
              `   ⬥ Before: <code>${zerofy(pos.notionalUsd)} ${USDT}</code>\n` +
              `   ⬥ After:  <code>${zerofy(estNewSz)} ${USDT}</code>\n\n` +
              `⚖️ <b>Breakeven Point:</b>\n` +
              `   ⬥ Before: <code>${zerofy(breakevenPx)} ${USDT}</code>\n` +
              `   ⬥ After:  <code>${zerofy(estBreakevenPx)} ${USDT}</code>\n\n` +
              `🎯 <b>New Exit Levels:</b>\n` +
              `   ⬥ Take Profit: <code>${zerofy(tpTriggerPx)} ${USDT}</code>\n` +
              `   ⬥ Stop Loss:   <code>${zerofy(slTriggerPx)} ${USDT}</code>\n\n` +
              `⏱️ <b>Time:</b> ${new Date().toLocaleString()}`;
            
            await ctx.replyWithHTML(txt);
          } else {
            await ctx.replyWithHTML(
              `❌ <b>DCA Order Failed</b> ❌\n\n` +
              `🪙 <b>Instrument:</b> ${instId}\n` +
              `🚨 <b>Error Code:</b> <code>${openPositionRes.code}</code>\n` +
              `📄 <b>Message:</b> <code>${openPositionRes.msg}</code>\n\n` +
              `Please check your API connection and parameters.`
            );
          }
        }

        // Handle TP/SL adjustment when position has positive funding fee
        if (
          Number(fundingFee) > 0 && 
          (!lastTimeAmendLimit || Date.now() - lastTimeAmendLimit > DELAY_FOR_DCA_ORDER * 1000)
        ) {
          lastTimeAmendLimitPositions[instId] = Date.now();
          
          // Update limit orders
          const editAlgoRes = await editLimitAlgoOrders({
            instId: instId,
            algoId: closeOrderAlgo[0]?.algoId,
            newSlTriggerPx,
            newTpTriggerPx
          });
          
          // Notify user about limit order updates
          if (okxReponseChecker(editAlgoRes)) {
            const txt = `📊 <b>Exit Order Updated</b> 📊\n\n` +
              `🪙 <b>Instrument:</b> ${pos.instId}\n` +
              `📈 <b>Direction:</b> ${posSide === "long" ? "🟢 Long" : "🔴 Short"}\n` +
              `💸 <b>Funding Fee:</b> <code>${zerofy(fundingFee)} ${USDT}</code>\n\n` +
              `🎯 <b>New Exit Levels:</b>\n` +
              `   ⬥ Take Profit: <code>${zerofy(newTpTriggerPx)} ${USDT}</code>\n` +
              `   ⬥ Stop Loss:   <code>${zerofy(newSlTriggerPx)} ${USDT}</code>\n\n` +
              `⏱️ <b>Time:</b> ${new Date().toLocaleString()}`;
              
            await ctx.replyWithHTML(txt);
          } else {
            if(editAlgoRes.data?.[0]?.sCode === "51279") { // TP trigger price cannot be lower than the last price
              const {closePositionRes, closeAlgoOrderRes} = await closeFuturePosition({
                instId,
                mgnMode: mgnMode as ImgnMode,
                posSide: posSide as IPosSide,
              })
              if(closePositionRes.code === "0" && closeAlgoOrderRes.code === "0") {
                await ctx.replyWithHTML(
                  `🚨 <b>Position Closed Automatically</b> 🚨\n\n` +
                  `🪙 <b>Instrument:</b> ${instId}\n` +
                  `📈 <b>Direction:</b> ${posSide === "long" ? "🟢 Long" : "🔴 Short"}\n` +
                  `⚠️ <b>Reason:</b> TP trigger price incompatible with market conditions\n\n` +
                  `✅ <b>Position Status:</b> Successfully closed\n` +
                  `✅ <b>Algo Orders:</b> Successfully canceled\n\n` +
                  `⏱️ <b>Time:</b> ${new Date().toLocaleString()}`
                );
              } else {
                await ctx.replyWithHTML(
                  `⚠️ <b>Position Close Operation Failed</b> ⚠️\n\n` +
                  `🪙 <b>Instrument:</b> ${instId}\n` +
                  `📈 <b>Direction:</b> ${posSide === "long" ? "🟢 Long" : "🔴 Short"}\n` +
                  `🚨 <b>Position Close:</b> ${closePositionRes.code === "0" ? "✅ Success" : "❌ Failed"}\n` +
                  `🚨 <b>Algo Cancel:</b> ${closeAlgoOrderRes.code === "0" ? "✅ Success" : "❌ Failed"}\n\n` +
                  `📄 <b>Details:</b>\n` +
                  `<code>Position: ${closePositionRes.msg}</code>\n` +
                  `<code>Algo: ${closeAlgoOrderRes.msg}</code>\n\n` +
                  `⏱️ <b>Time:</b> ${new Date().toLocaleString()}`
                );
              }
            } else
              await ctx.replyWithHTML(
                `⚠️ <b>Limit Order Update Failed</b> ⚠️\n\n` +
                `🪙 <b>Instrument:</b> ${instId}\n` +
                `🚨 <b>Error Code:</b> <code>${editAlgoRes.code}</code>\n` +
                `📄 <b>Message:</b> <code>${editAlgoRes.msg}</code>\n\n` +
                `Please check your API connection and parameters.`
              );
          }
        }
      })
    );
  } catch (err: any) {
    await ctx.replyWithHTML(
      `❌ <b>Position Management Error</b> ❌\n\n` +
      `📝 <b>Details:</b> <code>${axiosErrorDecode(err)}</code>\n\n` +
      `Please check your connection and API settings.`
    );
  }
};

/**
 * WebSocket management for position monitoring
 */
async function forwardPositionsWithWs({
  ctx,
  id,
  config,
  tradeAbleCrypto,
  campaigns,
  fundingArbitrage,
  positions
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
  fundingArbitrage: { [instId: string]: IOKXFunding };
  positions: { [instId: string]: IPositionOpen };
  config: CampaignConfig;
  tradeAbleCrypto: string[];
  campaigns: Map<string, CampaignConfig>;
}) {
  // Initialize state objects
  let tradeAbleCryptoCandles: { [instId: string]: ICandles } = {};
  let tradeAbleCryptoATRs: { [instId: string]: CandleWithATR[] } = {};
  let trablePositions: { [instId: string]: IPositionOpen | undefined } = {};
  let lastTimeDCAPositions: { [instId: string]: number } = {};
  let lastTimeAmendLimitPositions: { [instId: string]: number } = {};
  
  // Initialize WebSocket for position monitoring
  const WSPositions = wsPositions({
    authCallBack(config) {
      console.log("Authentication successful:", config);
    },
    subcribedCallBack(param) {
      console.log("Subscribed to positions:", param);
    },
    messageCallBack(pos) {
      _fowardPositions({
        config,
        ctx,
        wsPositions: pos.data,
        tradeAbleCrypto,
        tradeAbleCryptoATRs,
        fundingArbitrage,
        positions,
        tradeAbleCryptoCandles,
        trablePositions,
        lastTimeDCAPositions,
        lastTimeAmendLimitPositions,
        id,
        campaigns,
      });
    },
    errorCallBack(e) {
      console.log("WebSocket error:", e);
    },
    closeCallBack(code, reason) {
      if (code === 1005) {
        // Normal close - reset DCA timers
        Object.keys(lastTimeDCAPositions).forEach((instId) => {
          delete lastTimeDCAPositions[instId];
        });
      } else {
        // Abnormal close - attempt reconnection
        forwardPositionsWithWs({
          ctx,
          id,
          config,
          tradeAbleCrypto,
          fundingArbitrage,
          positions,
          campaigns,
        });
      }
    },
  });

  // Update campaign config with WebSocket reference
  campaigns.set(id, { ...(campaigns.get(id) || config), WSPositions });
}

/**
 * Initialize position monitoring for a bot campaign
 */
export const botPositions = ({
  ctx,
  id,
  config,
  tradeAbleCrypto,
  fundingArbitrage,
  positions,
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
  fundingArbitrage: { [instId: string]: IOKXFunding };
  positions: { [instId: string]: IPositionOpen };
  config: CampaignConfig;
  tradeAbleCrypto: string[];
  campaigns: Map<string, CampaignConfig>;
}) => {
  // Start position monitoring WebSocket
  forwardPositionsWithWs({
    ctx,
    id,
    config,
    fundingArbitrage,
    positions,
    tradeAbleCrypto,
    campaigns,
  });
};