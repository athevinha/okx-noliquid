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
import {
  getAccountOrder,
  getAccountPendingAlgoOrders,
  getAccountPendingOrders,
} from "../../helper/okx.account";
import { fowardTickerATRWithWs } from "./ticker";
import WebSocket from "ws";
dotenv.config();

const _fowardPositions = async ({
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
  alreadyOpenTrailingPositions: { [instId: string]: boolean };
}) => {
  try {
    if (!wsPositions[0]?.avgPx || wsPositions.length === 0) {
      return;
    }
    const wsInstIds = wsPositions.map((pos) => pos.instId);
    
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
  let alreadyOpenTrailingPositions: { [instId: string]: boolean } = {};
  const WSTrailing = wsPositions({
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
      console.error(`[POSITION] WebSocket closed with code: ${code} ${reason}`);
      if (code === 1005) {
        Object.keys(alreadyOpenTrailingPositions).forEach((instId) => {
          delete alreadyOpenTrailingPositions[instId];
        });
        ctx.replyWithHTML(
          `🔗 [POSITION] WebSocket connection terminated for <b><code>${id}</code>.</b>`
        );
        // campaigns.delete(id);
      } else if (code === 4004) {
        // 4004 code indicates no data received within 30 seconds
        Object.keys(alreadyOpenTrailingPositions).forEach((instId) => {
          delete alreadyOpenTrailingPositions[instId];
        });
        if (campaigns.get(id)?.WSTicker) {
          campaigns.get(id)?.WSTicker?.close();
        }
        console.log(
          `🛑 [POSITION] WebSocket connection stopped for <b><code>${id} [${code}]</code>.</b>`
        );
      } else {
        forwardPositionsWithWs({
          ctx,
          id,
          config,
          tradeAbleCrypto,
          campaigns,
        });
        ctx.replyWithHTML(
          `⛓️ [POSITION] [${code}] WebSocket disconnected for <b><code>${id}</code>.</b> Attempting reconnection.`
        );
      }
    },
  });

  campaigns.set(id, { ...(campaigns.get(id) || config), WSTrailing });
}
export const botPositions = ({
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
  forwardPositionsWithWs({
    ctx,
    id,
    config,
    tradeAbleCrypto,
    campaigns,
  });
};
