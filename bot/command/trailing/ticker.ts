import dotenv from "dotenv";
import {Context,NarrowedContext} from "telegraf";
import {Message,Update} from "telegraf/typings/core/types/typegram";
import {getAccountPendingAlgoOrders} from "../../helper/okx.account";
import {wsTicks} from "../../helper/okx.socket";
import {
    CampaignConfig,
    CandleWithATR,
    ICandles,
    IPositionOpen,
    IWsTickerReponse
} from "../../type";
import {
    axiosErrorDecode
} from "../../utils";
import WebSocket from "ws";
dotenv.config();
const _fowardTickerATRWithWs = async ({
    ctx,
    config,
    id,
    tick,
    unFillTrailingLossPosition,
    campaigns,
    tradeAbleCryptoATRs,
    tradeAbleCryptoCandles,
    trablePositions
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
    unFillTrailingLossPosition: IPositionOpen[]
    id: string;
    tick:IWsTickerReponse,
    campaigns: Map<string, CampaignConfig>;
    config: CampaignConfig;
    tradeAbleCryptoCandles: { [instId: string]: ICandles };
    tradeAbleCryptoATRs: { [instId: string]: CandleWithATR[] };
    trablePositions: {[instId: string]: IPositionOpen | undefined};
  }) => {
    try {
      const tickData = tick.data[0]
      // console.log(tickData.instId, tradeAbleCryptoATRs[tickData.instId].slice(-1)[0].atr)
      // console.log(tickData.instId, tradeAbleCryptoCandles[tickData.instId].slice(-1)[0].c)
    } catch (err: any) {
      await ctx.replyWithHTML(`[TICK] Error: <code>${axiosErrorDecode(err)}</code>`);
    }
  };
export async function fowardTickerATRWithWs({
    ctx,
    id,
    config,
    wsPositions,
    campaigns,
    tradeAbleCryptoCandles,
    tradeAbleCryptoATRs,
    trablePositions,
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
    tradeAbleCryptoCandles: { [instId: string]: ICandles };
    tradeAbleCryptoATRs: { [instId: string]: CandleWithATR[] };
    trablePositions: {[instId: string]: IPositionOpen | undefined};
  }) {
    if(campaigns.get(id)?.WSTicker?.readyState === WebSocket.OPEN) return;
    if(!campaigns.has(id) || campaigns.get(id)?.WSTrailing?.readyState === WebSocket.CLOSED || campaigns.get(id)?.WS?.readyState === WebSocket.CLOSED) {
        campaigns.get(id)?.WSTicker?.close()
        return;
    }

    // const unFillTrailingLossInstId = wsPositions.map(p => p.instId)
    console.log('Start Ticker Socket...', wsPositions.map(p => p.instId))
    const WSTicker = wsTicks({
        subscribeMessage: {
            op: 'subscribe',
            args: wsPositions.map(p => ({
                channel: 'mark-price',
                instId: p.instId
                }))
        },
      subcribedCallBack(param) {console.log(param)},
      messageCallBack(tick) {
        _fowardTickerATRWithWs({
          config,
          ctx,
          tick,
          tradeAbleCryptoCandles,
          tradeAbleCryptoATRs,
          unFillTrailingLossPosition: wsPositions,
          id,
          campaigns,
          trablePositions,
        });
      },
      errorCallBack(e) {
        console.log(e);
      },
      closeCallBack(code, reason) {
        console.error("[TICK] WS closed with code: ", code);
        if (code === 1005) {
          ctx.replyWithHTML(
            `🛑 [TICK] Stopped WS <b><code>${id}</code>.</b>`
          );
          campaigns.delete(id);
        } else {
            fowardTickerATRWithWs({
            ctx,
            id,
            config,
            tradeAbleCryptoCandles,
            tradeAbleCryptoATRs,
            wsPositions,
            campaigns,
            trablePositions
          });
          ctx.replyWithHTML(
            `⛓️ [TICK] [${code}] Trailing socket disconnected for <b><code>${id}</code>.</b> Reconnected`
          );
        }
      },
    });
  
    campaigns.set(id, { ...(campaigns.get(id) || config), WSTicker });
}