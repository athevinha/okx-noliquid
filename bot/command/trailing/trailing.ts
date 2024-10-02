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
import { getAccountPendingAlgoOrders } from "../../helper/okx.account";
import { fowardTickerATRWithWs } from "./ticker";
import WebSocket from "ws";
dotenv.config();

const _fowardTrailing = async ({
  ctx,
  config,
  tradeAbleCrypto,
  wsPositions,
  tradeAbleCryptoATRs,
  tradeAbleCryptoCandles,
  trablePositions,
  alreadyOpenTrailingPositions,
  id,
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
  campaigns: Map<string, CampaignConfig>;
  wsPositions: IPositionOpen[];
  config: CampaignConfig;
  tradeAbleCrypto: string[];
  tradeAbleCryptoCandles: { [instId: string]: ICandles };
  tradeAbleCryptoATRs: { [instId: string]: CandleWithATR[] };
  trablePositions: { [instId: string]: IPositionOpen | undefined };
  alreadyOpenTrailingPositions: { [instId: string]:  boolean } ;
}) => {
  try {
    if (!wsPositions[0]?.avgPx || wsPositions.length === 0) return; // Close and open pos message
    const algoOrders = await getAccountPendingAlgoOrders({});
    const WSPositions = wsPositions.filter((pos) => {
      if (!tradeAbleCrypto.includes(pos.instId)) return false;
      const algoOrder = algoOrders.filter(
        (aOrd) => aOrd.instId === pos.instId
      )?.[0];
      if (algoOrder?.moveTriggerPx || algoOrder?.callbackRatio) return false; // Already set a trailing loss orders
      return true;
    });
    const wsInstIds = WSPositions.map((pos) => pos.instId);
    const outdated =
      (Object.keys(trablePositions).filter((crypto) => wsInstIds.includes(crypto)).length !==
      WSPositions.length) || WSPositions.length !== Object.keys(trablePositions).length;
    console.log("trablePositions", Object.keys(trablePositions).length,"| WSPositions",WSPositions.map((ws) => ws.instId).length, "| outdated", outdated, "| Already", Object.keys(alreadyOpenTrailingPositions).filter(key => alreadyOpenTrailingPositions[key]).length);

    if (outdated) {
      WSPositions.forEach((pos) => {
        trablePositions[pos.instId] = pos; // Add or update the position
      });
      Object.keys(trablePositions).forEach((instId) => {
        if (!WSPositions.some((pos) => pos.instId === instId)) {
          delete trablePositions[instId]; // Remove the position if it no longer exists in WSPositions
        }
      });
      await Promise.all(
        WSPositions.map(async ({ instId }) => {
          tradeAbleCryptoCandles[instId] = await getSymbolCandles({
            instID: instId,
            bar: config.bar,
            before: 0,
            limit: 300,
          });
          tradeAbleCryptoATRs[instId] = calculateATR(
            tradeAbleCryptoCandles[instId],
            ATR_PERIOD
          );
        })
      );
      fowardTickerATRWithWs({
        ctx,
        id,
        config,
        wsPositions: WSPositions,
        campaigns,
        tradeAbleCrypto,
        tradeAbleCryptoATRs,
        tradeAbleCryptoCandles,
        trablePositions,
        alreadyOpenTrailingPositions,
      });
    }
  } catch (err: any) {
    await ctx.replyWithHTML(
      `[TRAILING] Error: <code>${axiosErrorDecode(err)}</code>`
    );
  }
};
async function forwardTrailingWithWs({
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
  let trablePositions: { [instId: string]: IPositionOpen | undefined } = {};
  let alreadyOpenTrailingPositions: { [instId: string]:  boolean } = {};
  const WSTrailing = wsPositions({
    authCallBack(config) {
      console.log(config);
    },
    subcribedCallBack(param) {
      console.log(param);
    },
    messageCallBack(pos) {
      _fowardTrailing({
        config,
        ctx,
        wsPositions: pos.data,
        tradeAbleCrypto,
        tradeAbleCryptoATRs,
        tradeAbleCryptoCandles,
        trablePositions,
        alreadyOpenTrailingPositions,
        id,
        campaigns,
      });
    },
    errorCallBack(e) {
      console.log(e);
    },
    closeCallBack(code, reason) {
      console.error("[TRAILING] WS closed with code: ", code);
      
      if (code === 1005) {
        Object.keys(alreadyOpenTrailingPositions).forEach((instId) => {
          delete alreadyOpenTrailingPositions[instId];
        });
        ctx.replyWithHTML(
          `🛑 [TRAILING] Stopped WS <b><code>${id}</code>.</b>`
        );
        campaigns.delete(id);
      } else if  (code === 4004) {
        Object.keys(alreadyOpenTrailingPositions).forEach((instId) => {
          delete alreadyOpenTrailingPositions[instId];
        });
        console.log(
          `🛑 [TRAILING] Stopped WS <b><code>${id} [${code}]</code>.</b>`
        );
      }
      else {
        forwardTrailingWithWs({
          ctx,
          id,
          config,
          tradeAbleCrypto,
          campaigns,
        });
        ctx.replyWithHTML(
          `⛓️ [TRAILING] [${code}] socket disconnected for <b><code>${id}</code>.</b> Reconnected`
        );
      }
    },
  });

  campaigns.set(id, { ...(campaigns.get(id) || config), WSTrailing });
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
