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
  IPositionOpen,
  CandleWithATR,
  IOKXFunding,
} from "../../type";
import {
  axiosErrorDecode,
  decodeSymbol,
  decodeTimestamp,
  decodeTimestampAgo,
  estimatePnl,
  getTradeAbleCrypto,
  okxReponseChecker,
  zerofy,
} from "../../utils";
import {
  ATR_PERIOD,
  parseConfigInterval,
  USDT,
  WHITE_LIST_TOKENS_TRADE,
} from "../../utils/config";
import { formatReportInterval } from "../../utils/message";
import { calculateATR } from "../../signals/atr";
import {
  sendOKXWsMessage,
  wsCandles,
  wsPositions,
  wsTicks,
} from "../../helper/okx.socket";
import { setTimeout } from "timers/promises";
import {
  getAccountOrder,
  getAccountPendingAlgoOrders,
  getAccountPendingOrders,
  getAccountPositions,
} from "../../helper/okx.account";
import { fowardTickerATRWithWs } from "./ticker";
import WebSocket from "ws";
import { calcBreakEvenPx, calcTpSL, DELAY_FOR_DCA_ORDER, PX_CHANGE_TO_DCA } from "./trade";
import {editLimitAlgoOrders} from "../../helper/okx.trade.algo";
dotenv.config();
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
  lastTimeAmendLimitPositions: { [instId: string]: number } 
}) => {
  try {
    if (!wsPositions[0]?.avgPx || wsPositions.length === 0) {
      return;
    }
    const wsInstIds = wsPositions.map((pos) => pos.instId);
    // const _wsPositions: { [instId: string]: IPositionOpen } = {}
    // wsPositions.map(pos => {_wsPositions[pos.instId] = pos})
    // positions = _wsPositions
    Promise.all(
      wsPositions.map(async (pos) => {
        const {
          realizedPnl,
          uplRatio,
          avgPx,
          notionalUsd,
          closeOrderAlgo,
          instId,
          lever,
          posSide,
          fundingFee,
          markPx,
        } = pos;
        if(!closeOrderAlgo[0]) return;
        const breakevenPx = calcBreakEvenPx({posSide: posSide as IPosSide, avgPx, notionalUsd, realizedPnl})
        const fundingRate = fundingArbitrage?.[instId]?.fundingRate
        if(!fundingRate) {
            console.log(instId)
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
        const {tpTriggerPx: newTpTriggerPx, slTriggerPx: newSlTriggerPx} = calcTpSL({fundingRate: Number(fundingRate), posSide: openParams.posSide, px: breakevenPx, tpMinMax: [0.2, 0.4]})
        const lastTimeDCA = lastTimeDCAPositions[instId];
        const lastTimeAmendLimit = lastTimeAmendLimitPositions[instId]
        if (
          pxChange < -PX_CHANGE_TO_DCA &&
          (!lastTimeDCA || Date.now() - lastTimeDCA > DELAY_FOR_DCA_ORDER * 1000) && 
          closeOrderAlgo[0].algoId
        ) {
          lastTimeDCAPositions[instId] = Date.now();
          const estNewAvgPx = String((Number(avgPx) * Number(notionalUsd) + Number(markPx) * openParams.size) / (Number(notionalUsd) + openParams.size))
          const estNewSz = String(Number(notionalUsd) + openParams.size)
          const { openPositionRes } = await openFuturePosition(openParams);
          const estBreakevenPx = calcBreakEvenPx({posSide: posSide as IPosSide, avgPx: estNewAvgPx, notionalUsd: estNewSz, realizedPnl})
          const {tpTriggerPx, slTriggerPx} = Number(fundingFee) <= 0 ?
           calcTpSL({fundingRate: Number(fundingRate), posSide: openParams.posSide, px: estNewAvgPx}) :
           calcTpSL({fundingRate: Number(fundingRate), posSide: openParams.posSide, px: estBreakevenPx, tpMinMax: [0.2, 0.4]})
          const editAlgoRes =  await editLimitAlgoOrders({
              instId: instId, 
              algoId: closeOrderAlgo[0].algoId,
              newSlTriggerPx: slTriggerPx,
              newTpTriggerPx: tpTriggerPx
          })
          if (okxReponseChecker(openPositionRes) && okxReponseChecker(editAlgoRes)) {
            const txt = `<b>💼 [DCA] Position Update</b>
🪙 <b>${pos.instId}</b>
📈 Est.avg: <code>${zerofy(avgPx)}${USDT}</code> → <code>${zerofy(estNewAvgPx)}${USDT}</code>
⚖️ Sz: <code>${zerofy(pos.notionalUsd)}${USDT}</code> → <code>${zerofy(estNewSz)}${USDT}</code>
💰 B.Even: <code>${zerofy(breakevenPx)}${USDT}</code> -> <code>${zerofy(estBreakevenPx)}${USDT}</code>
🎯 N.TP/SL: <code>${zerofy(tpTriggerPx)}${USDT}</code> | <code>${zerofy(slTriggerPx)}${USDT}</code>`;            
            await ctx.replyWithHTML(txt);
          } else {
            await ctx.replyWithHTML(
              `⚠️ DCA order failed. <code> ${openPositionRes.code}: ${openPositionRes.msg} </code>`
            );
          }
        }

        if(Number(fundingFee) > 0 && (!lastTimeAmendLimit || Date.now() - lastTimeAmendLimit > DELAY_FOR_DCA_ORDER * 1000)) {
          lastTimeAmendLimitPositions[instId] = Date.now();
          const editAlgoRes =  await editLimitAlgoOrders({
            instId: instId, 
            algoId: closeOrderAlgo[0]?.algoId,
            newSlTriggerPx,
            newTpTriggerPx
        })
        if (okxReponseChecker(editAlgoRes)) {
          const txt = `<b>Limit Update</b>: <b>${pos.instId}</b>
💰 F.Fee : ${zerofy(fundingFee)}${USDT} 
🎯 N.TP/SL: <code>${zerofy(newTpTriggerPx)}${USDT}</code> | <code>${zerofy(newSlTriggerPx)}${USDT}</code>`;            
          await ctx.replyWithHTML(txt);
        } else {
          await ctx.replyWithHTML(
            `⚠️ Edit limit failed. <code> ${editAlgoRes.code}: ${editAlgoRes.msg} </code>`
          );
        }
      }
          
      })
    );
  } catch (err: any) {
    await ctx.replyWithHTML(
      `[POSITION] Error: <code>${axiosErrorDecode(err)}</code>`
    );
  }
};
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
  let tradeAbleCryptoCandles: { [instId: string]: ICandles } = {};
  let tradeAbleCryptoATRs: { [instId: string]: CandleWithATR[] } = {};
  let trablePositions: { [instId: string]: IPositionOpen | undefined } = {};
  let lastTimeDCAPositions: { [instId: string]: number } = {};
  let lastTimeAmendLimitPositions: { [instId: string]: number } = {};
  const WSPositions = wsPositions({
    authCallBack(config) {
      console.log(config);
    },
    subcribedCallBack(param) {
      console.log(param);
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
      console.log(e);
    },
    closeCallBack(code, reason) {
      // console.error(`[POSITION] WebSocket closed with code: ${code} ${reason}`);
      if (code === 1005) {
        Object.keys(lastTimeDCAPositions).forEach((instId) => {
          delete lastTimeDCAPositions[instId];
        });
        // ctx.replyWithHTML(
        //   `🔗 [POSITION] WebSocket connection terminated for <b><code>${id}</code>.</b>`
        // );
        // campaigns.delete(id);
      } else {
        forwardPositionsWithWs({
          ctx,
          id,
          config,
          tradeAbleCrypto,
          fundingArbitrage,
          positions,
          campaigns,
        });
        // ctx.replyWithHTML(
        //   `⛓️ [POSITION] [${code}] WebSocket disconnected for <b><code>${id}</code>.</b> Attempting reconnection.`
        // );
      }
    },
  });

  campaigns.set(id, { ...(campaigns.get(id) || config), WSPositions });
}
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
