import { setTimeout as _setTImeout } from "timers/promises";
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

import { Context, NarrowedContext, Telegraf } from "telegraf";
import { Message, Update } from "telegraf/typings/core/types/typegram";
import {existsSync} from "fs";
import {config} from "dotenv";
const MODE = process.env.ENV
const env = process.env.ENV || "dev"; // fallback to 'dev' mode
const envPath = `.env.${env}`;
if (existsSync(envPath)) {
  config({ path: envPath });
  console.log(`✅ Loaded ${envPath}`);
} else {
  console.warn(`⚠️ Environment file ${envPath} not found.`);
}

export const test = async (ctx?: NarrowedContext<
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
  let nextUpdateTimeMs = 0; // Track when we should next update

  const updateFetchData = async () => {
    try {
      console.log("🔄 Updating funding data and candles...");
      const _fundingArbitrage: { [instId: string]: IOKXFunding } = {};
      (
        await getOKXFunding({
          fundingDownTo: -2,
          fundingUpTo: -0.05,
        })
      ).slice(0, 10).forEach((e) => {
        if(MODE === "dev")
          e.fundingTime = String(Date.now() + 1000 * 10)
        _fundingArbitrage[`${e.ccy}-USDT-SWAP`] = e;
      });
      fundingArbitrage = _fundingArbitrage;

      // Calculate when the next update should be
      let nextFundingTime = 0;
      for (const key in fundingArbitrage) {
        const fundingTime = Number(fundingArbitrage[key].fundingTime);
        if (fundingTime > nextFundingTime) {
          nextFundingTime = fundingTime;
        }
      }

      // Set next update to 10 minutes before the next funding time
      // Or use the next 4-hour interval if we can't determine from funding data
      if (nextFundingTime > Date.now()) {
        nextUpdateTimeMs = nextFundingTime - 10 * 60 * 1000; // 10 minutes before funding
      } else {
        // If we can't determine next funding time, calculate next 4-hour interval
        const now = new Date();
        const hours = now.getUTCHours();
        const nextIntervalHour = Math.ceil(hours / 4) * 4;
        const nextDate = new Date(Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          nextIntervalHour, 
          0, 0, 0
        ));
        
        if (nextDate.getTime() <= now.getTime()) {
          nextDate.setUTCHours(nextDate.getUTCHours() + 4);
        }
        
        nextUpdateTimeMs = nextDate.getTime() - 10 * 60 * 1000; // 10 minutes before funding
      }

      console.log(`📅 Next data update scheduled for: ${new Date(nextUpdateTimeMs).toISOString()}`);

      // Fetch candles for all funding opportunities
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
      console.error("⚠️ Failed to fetch funding data:", err);
      // On error, retry in 1 minute
      nextUpdateTimeMs = Date.now() + 60 * 1000;
    }
  };

  // Initial update
  await updateFetchData();

  // Schedule periodic updates only before funding times
  if (MODE !== "dev") {
    const checkAndUpdate = async () => {
      const now = Date.now();
      if (now >= nextUpdateTimeMs) {
        await updateFetchData();
      }
      
      // Check again in 1 minute
      setTimeout(() => checkAndUpdate(), 60 * 1000);
    };
    
    // Start the checking loop
    setTimeout(() => checkAndUpdate(), 60 * 1000);
  }

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
        const fundingRate = Number(fundingData.fundingRate)
        if (!fundingData) return;

        const fundingTimeLeftMs = Number(fundingData.fundingTime) - Number(data.ts);
        const fundingTimeLeftSec = fundingTimeLeftMs / 1000;

        console.log(
          `📊 [${data.instId}] Left: ${fundingTimeLeftSec.toFixed(2)}s | Px: ${data.markPx} | F: ${(Number(fundingData.fundingRate) * 100).toFixed(2)}%`
        );
        const timeToOpen = MODE === "dev" ? 2 : 1.5 * 60
        if (
          fundingTimeLeftSec <= timeToOpen &&
          fundingTimeLeftSec > timeToOpen - 1 &&
          !positions[data.instId]
        ) {
          const tpPercent = Math.min(Math.max(Math.abs(fundingRate) * 2, 0.003), 0.004);
          const slPercent = Math.min(Math.max(Math.abs(fundingRate) * 2, 0.006), 0.008);
          
          const posSide = fundingRate < 0 ? "long" : "short";
    
          console.log(tpPercent, slPercent)
          openFuturePosition({
            instId: data.instId,
            leverage: 10,
            mgnMode: "isolated",
            size: 20,
            posSide,
            tpTriggerPx: String(
              Number(data.markPx) * (1 + (posSide === "long" ? tpPercent : -tpPercent))
            ),
            slTriggerPx: String(
              Number(data.markPx) * (1 - (posSide === "long" ? slPercent : -slPercent))
            ),
          });
          
          positions[data.instId] = true;
          if(ctx) ctx.reply(`🚀 Opening position for ${data.instId}`);
        }

        if (
          fundingTimeLeftSec < -20 &&
          !!(positions[data.instId] as IPositionOpen)?.avgPx
        ) {
          closeFuturePosition({
            instId: data.instId,
            mgnMode: "isolated",
            posSide: "long",
          });
          positions[data.instId] = false;
          if(ctx) ctx.reply(`❌ Closing position for ${data.instId} ${fundingTimeLeftSec}`);
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
  setInterval(() => {
    reconnectTicks();
    reconnectPositions();
  }, (10000));
};

if(MODE === "dev" || MODE === "stage") 
{
    console.log("MODE: ", MODE)
    test()
}

export const botFunding = ({
  bot,
  campaigns,
}: {
  bot: Telegraf;
  campaigns: Map<string, CampaignConfig>;
}) => {
  let lastestSignalTs: { [instId: string]: number } = {};
  bot.command("funding", async (ctx) => {
    const [id, ...configStrings] = ctx.message.text.split(" ").slice(1);

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