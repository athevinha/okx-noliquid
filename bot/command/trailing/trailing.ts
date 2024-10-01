import dotenv from "dotenv";
import { Context, NarrowedContext, Telegraf } from "telegraf";
import { Message, Update } from "telegraf/typings/core/types/typegram";
import { getSymbolCandles } from "../../helper/okx.candles";
import { closeFuturePosition, openFuturePosition } from "../../helper/okx.trade";
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
import { wsCandles, wsPositions, wsTicks } from "../../helper/okx.socket";
import { setTimeout } from "timers/promises";
import { getAccountPendingAlgoOrders } from "../../helper/okx.account";
import {fowardTickerATRWithWs} from "./ticker";
dotenv.config();

const _fowardTrailing = async ({
  ctx,
  config,
  tradeAbleCrypto,
  wsPositions,
  tradeAbleCryptoATRs,
  tradeAbleCryptoCandles,
  id,
  campaigns
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
}) => {
  try {
    const algoOrders = await getAccountPendingAlgoOrders({});

    const WSPositions = wsPositions.filter((pos) => {
      if (!tradeAbleCrypto.includes(pos.instId)) return false;
      const algoOrder = algoOrders.filter(
        (aOrd) => aOrd.instId === pos.instId
      )?.[0];
      if (algoOrder?.moveTriggerPx || algoOrder?.callbackRatio) return false; // Already set a trailing loss orders
      return true;
    });
    console.log(WSPositions.map(i => i.instId))
    fowardTickerATRWithWs({
      ctx,
      id,
      config,
      wsPositions: WSPositions,
      campaigns,
      tradeAbleCryptoATRs,
      tradeAbleCryptoCandles
    })
  } catch (err: any) {
    await ctx.replyWithHTML(`[TRAILING] Error: <code>${axiosErrorDecode(err)}</code>`);
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
  await Promise.all(
    tradeAbleCrypto.map(async (instId) => {
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
        id,
        campaigns
      });
    },
    errorCallBack(e) {
      console.log(e);
    },
    closeCallBack(code, reason) {
      console.error("[TRAILING] WS closed with code: ", code);
      if (code === 1005) {
        ctx.replyWithHTML(
          `🛑 [TRAILING] Stopped WS <b><code>${id}</code>.</b>`
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
