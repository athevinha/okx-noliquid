import dotenv from "dotenv";
import { Context, NarrowedContext } from "telegraf";
import { Message, Update } from "telegraf/typings/core/types/typegram";
import { getAccountPendingAlgoOrders } from "../../helper/okx.account";
import { wsTicks } from "../../helper/okx.socket";
import {
  CampaignConfig,
  CandleWithATR,
  ICandle,
  ICandles,
  ImgnMode,
  IPositionOpen,
  IPosSide,
  IWsTickerReponse,
} from "../../type";
import {
  axiosErrorDecode,
  decodeSymbol,
  decodeTimestamp,
  decodeTimestampAgo,
  okxReponseDecode,
  zerofy,
} from "../../utils";
import WebSocket from "ws";
import { calculateATR } from "../../signals/atr";
import { openTrailingStopOrder } from "../../helper/okx.trade.algo";
import { USDT } from "../../utils/config";
import { setTimeout } from "timers/promises";
import { getSymbolCandles } from "../../helper/okx.candles";
dotenv.config();
let a = 0;
const _fowardTickerATRWithWs = async ({
  ctx,
  config,
  id,
  tick,
  unFillTrailingLossPosition,
  campaigns,
  tradeAbleCrypto,
  tradeAbleCryptoATRs,
  tradeAbleCryptoCandles,
  trablePositions,
  alreadyOpenTrailingPositions,
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
  unFillTrailingLossPosition: IPositionOpen[];
  id: string;
  tick: IWsTickerReponse;
  campaigns: Map<string, CampaignConfig>;
  config: CampaignConfig;
  tradeAbleCrypto: string[];
  tradeAbleCryptoCandles: { [instId: string]: ICandles };
  tradeAbleCryptoATRs: { [instId: string]: CandleWithATR[] };
  trablePositions: { [instId: string]: IPositionOpen | undefined };
  alreadyOpenTrailingPositions: { [instId: string]: boolean };
}) => {
  try {
    if (Object.keys(trablePositions).includes(tick.data[0].instId)) {
      const { markPx, instId, ts } = tick.data[0];
      const markPrice = Number(markPx);
      const candles = tradeAbleCryptoCandles[instId];
      const multiple = config.variance
        ? Number(
            config.variance === "auto"
              ? [1, "auto"]
              : config.variance.split(",")[0]
          )
        : 0.05;
      // if (!candles) return;
      if (!candles || candles.length < 2) return;

      const candlePeriod = candles[1].ts - candles[0].ts;
      const lastCandle = candles[candles.length - 1];

      if (Number(ts) >= lastCandle.ts + candlePeriod) {
        console.log("---------------TICKER NEW CANDLE-----------------------");
        const newCandle: ICandle = {
          ts: Number(ts),
          o: markPrice,
          h: markPrice,
          l: markPrice,
          c: markPrice,
          vol: 0,
          volCcy: 0,
          volCcyQuote: 0,
          confirm: 0,
        };
        candles.push(newCandle);
      } else {
        if (markPrice <= lastCandle.l) lastCandle.l = markPrice;
        if (markPrice >= lastCandle.h) lastCandle.h = markPrice;
        candles[candles.length - 1].c = markPrice;
      }
      tradeAbleCryptoCandles[instId] = candles;
      const atrs = calculateATR(candles, 14,'EMA');
      const currentAtr = atrs.slice(-1)[0];
      const estActiveAvgPx = candles[candles.length - 2].c + atrs[atrs.length - 2].atr * multiple
      // console.log(instId, 'Fill close', candles[candles.length - 2].c,  '|', 'Fill Atr', atrs[atrs.length - 2].atr, "|", 'Est. Mark/Active Px', `${markPrice}/${estActiveAvgPx}`)
      // console.log('Last 2st:', [candles[candles.length - 2].c, candles[candles.length - 2].h], 'Last 1st:', [candles[candles.length - 1].c, candles[candles.length - 1].h], 'ATR:', currentAtr.atr)
      const pos = trablePositions[instId] as IPositionOpen;
      // console.log(instId, Number(trablePositions[instId]?.avgPx) + currentAtr?.atr * multiple, markPrice)
      
    }
  } catch (err: any) {
    await ctx.replyWithHTML(
      `[TICK] Error: <code>${axiosErrorDecode(err)}</code>`
    );
  }
};
export async function fowardTickerATRWithWs({
  ctx,
  id,
  config,
  wsPositions,
  campaigns,
  tradeAbleCrypto,
  tradeAbleCryptoCandles,
  tradeAbleCryptoATRs,
  trablePositions,
  alreadyOpenTrailingPositions,
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
  wsPositions: IPositionOpen[];
  campaigns: Map<string, CampaignConfig>;
  tradeAbleCrypto: string[];
  tradeAbleCryptoCandles: { [instId: string]: ICandles };
  tradeAbleCryptoATRs: { [instId: string]: CandleWithATR[] };
  trablePositions: { [instId: string]: IPositionOpen | undefined };
  alreadyOpenTrailingPositions: { [instId: string]: boolean };
}) {
  if (campaigns.get(id)?.WSTicker?.readyState === WebSocket.OPEN) return;
  if (
    !campaigns.has(id) ||
    campaigns.get(id)?.WSPositions?.readyState === WebSocket.CLOSED ||
    campaigns.get(id)?.WS?.readyState === WebSocket.CLOSED
  ) {
    campaigns.get(id)?.WSTicker?.close();
    return;
  }

  // const unFillTrailingLossInstId = wsPositions.map(p => p.instId)
  console.log(
    "Start Ticker Socket...",
    wsPositions.map((p) => p.instId)
  );
  const WSTicker = wsTicks({
    subscribeMessage: {
      op: "subscribe",
      args: tradeAbleCrypto.map((instId) => ({
        channel: "mark-price",
        instId,
      })),
    },
    subcribedCallBack(param) {
      console.log(param);
    },
    messageCallBack(tick) {
      _fowardTickerATRWithWs({
        config,
        ctx,
        tick,
        tradeAbleCryptoCandles,
        tradeAbleCrypto,
        tradeAbleCryptoATRs,
        unFillTrailingLossPosition: wsPositions,
        id,
        campaigns,
        trablePositions,
        alreadyOpenTrailingPositions,
      });
    },
    errorCallBack(e) {
      console.log(e);
    },
    closeCallBack(code, reason) {
      console.error("[TICK] WS closed with code: ", code);
      if (code === 1005) {
        ctx.replyWithHTML(
          `🔗 [TICK] WebSocket connection terminated for <b><code>${id}</code>.</b>`
        );
        // campaigns.delete(id);
      } else {
        fowardTickerATRWithWs({
          ctx,
          id,
          config,
          tradeAbleCrypto,
          tradeAbleCryptoCandles,
          tradeAbleCryptoATRs,
          wsPositions,
          campaigns,
          trablePositions,
          alreadyOpenTrailingPositions,
        });
        ctx.replyWithHTML(
          `⛓️ [TICK] [${code}] Trailing socket disconnected for <b><code>${id}</code>.</b> Reconnected`
        );
      }
    },
  });

  campaigns.set(id, { ...(campaigns.get(id) || config), WSTicker });
}
