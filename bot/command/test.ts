import { setTimeout } from "timers/promises";
import { getSymbolCandles } from "../helper/okx.candles";
import { getOKXFunding } from "../helper/okx.funding";
import { wsPositions, wsTicks } from "../helper/okx.socket";
import { closeFuturePosition, openFuturePosition } from "../helper/okx.trade";
import { calculateATR } from "../signals/atr";
import {
  CampaignConfig,
  ICandle,
  ICandles,
  IOKXFunding,
  IPositionOpen,
  IWsPositionReponse,
} from "../type";
import { ATR_PERIOD, parseConfigInterval } from "../utils/config";
import {existsSync} from "fs";
import {config} from "dotenv";
import { Context, NarrowedContext, Telegraf } from "telegraf";
import { Message, Update } from "telegraf/typings/core/types/typegram";

const env = process.env.ENV || "dev"; // fallback to 'dev' mode
const envPath = `.env.${env}`;
if (existsSync(envPath)) {
  config({ path: envPath });
  console.log(`✅ Loaded ${envPath}`);
} else {
  console.warn(`⚠️ Environment file ${envPath} not found.`);
}
export const test = async (ctx: NarrowedContext<
    Context<Update>,
    {
      message:
        | (Update.New & Update.NonChannel & Message.AnimationMessage)
        | (Update.New & Update.NonChannel & Message.TextMessage);
      update_id: number;
    }
  >) => {
  let fundingArbitrage: { [instId: string]: IOKXFunding } = {};
  let candles: { [instId: string]: ICandles } = {};
  let positions: { [instId: string]: IPositionOpen | boolean } = {};

  const updateFetchData = async () => {
    try {
      const _fundingArbitrage: { [instId: string]: IOKXFunding } = {};
      (
        await getOKXFunding({
          fundingDownTo: -2,
          fundingUpTo: -0.1,
        })
      ).slice(0, 10).forEach((e) => {
        _fundingArbitrage[`${e.ccy}-USDT-SWAP`] = e;
      });
      fundingArbitrage = _fundingArbitrage;
    } catch (err) {
      console.error("⚠️ Failed to fetch funding data:", err);
    }

    try {
      for (const instId of Object.keys(fundingArbitrage)) {
        const rawCandles = await getSymbolCandles({
          instID: instId,
          bar: "1m",
          before: 0,
          limit: 300,
        });
        candles[instId] = calculateATR(rawCandles, ATR_PERIOD);
      }
    } catch (err) {
      console.error("⚠️ Failed to fetch candles:", err);
    }
  };

  await updateFetchData();
  setInterval(updateFetchData, 3000);

  let reconnectTicks = () => {};
  let reconnectPositions = () => {};

  const setupWsTicks = () => {
    return wsTicks({
      subscribeMessage: {
        op: "subscribe",
        args: Object.keys(fundingArbitrage).map((e) => ({
          instId: e,
          channel: `mark-price`,
        })),
      },
      subcribedCallBack(param) {
        console.log("📡 Subscribed to tick data:", param);
      },
      messageCallBack(mark) {
        const data = mark.data[0];
        const fundingData = fundingArbitrage[data.instId];
        if (!fundingData) return;

        const fundingTimeLeftMs = Number(fundingData.fundingTime) - Number(data.ts);
        const fundingTimeLeftSec = fundingTimeLeftMs / 1000;

        console.log(
          `📊 [${data.instId}] Left: ${fundingTimeLeftSec.toFixed(2)}s | Px: ${data.markPx} | F: ${(Number(fundingData.fundingRate) * 100).toFixed(2)}%`
        );

        if (
          fundingTimeLeftSec <= 2 * 60 &&
          fundingTimeLeftSec > (2 * 60) - 1 &&
          !positions[data.instId]
        ) {
          ctx.reply(`🚀 Opening position for ${data.instId}`);
          openFuturePosition({
            instId: data.instId,
            leverage: 10,
            mgnMode: "isolated",
            size: 20,
            posSide: "long",
            tpTriggerPx: String(Number(data.markPx) * (1 + Math.abs(Number(fundingData.fundingRate)) * 2)),
            slTriggerPx: String(Number(data.markPx) * (1 - Math.abs(Number(fundingData.fundingRate)) * 2)),
          });
          positions[data.instId] = true;
        }

        if (
          fundingTimeLeftSec < 2 &&
          !!(positions[data.instId] as IPositionOpen)?.avgPx
        ) {
          ctx.reply(`❌ Closing position for ${data.instId} ${fundingTimeLeftSec}`);
          closeFuturePosition({
            instId: data.instId,
            mgnMode: "isolated",
            posSide: "long",
          });
          positions[data.instId] = false;
        }
      },
      errorCallBack(e) {
        console.error("❗ Tick socket error, restarting...", e);
        reconnectTicks()
      },
    });
  };

  const setupWsPositions = () => {
    return wsPositions({
      authCallBack() {
        console.log("🔐 Auth success for position WebSocket");
      },
      subcribedCallBack(param) {
        console.log("📡 Subscribed to position data:", param);
      },
      messageCallBack(res) {
        const _positions: { [instId: string]: IPositionOpen } = {};
        res.data.forEach((pos) => {
          _positions[pos.instId] = pos;
        });
        positions = _positions;
      },
      errorCallBack(e) {
        console.error("❗ Position socket error, restarting...", e);
        reconnectPositions()
      },
    });
  };

  reconnectTicks = () => {
    setupWsTicks();
  };

  reconnectPositions = () => {
    setupWsPositions();
  };

  reconnectTicks();
  reconnectPositions();
};


export const botFunding = ({
  bot,
  campaigns,
}: {
  bot: Telegraf;
  campaigns: Map<string, CampaignConfig>;
}) => {
  let lastestSignalTs: { [instId: string]: number } = {};
  bot.command("start-funding", async (ctx) => {
    const [id, ...configStrings] = ctx.message.text.split(" ").slice(1);
    const config = parseConfigInterval(configStrings.join(" "));

    if (campaigns.has(id)) {
      ctx.replyWithHTML(
        `🚫 Trading interval with ID <code>${id}</code> is already active.`,
      );
      return;
    }
    await ctx.replyWithHTML("Funding start");
    await test(ctx)
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
};
