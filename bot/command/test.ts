import { setTimeout } from "timers/promises";
import { getSymbolCandles } from "../helper/okx.candles";
import { getOKXFunding } from "../helper/okx.funding";
import { wsPositions, wsTicks } from "../helper/okx.socket";
import { closeFuturePosition, openFuturePosition } from "../helper/okx.trade";
import { calculateATR } from "../signals/atr";
import {
  ICandle,
  ICandles,
  IOKXFunding,
  IPositionOpen,
  IWsPositionReponse,
} from "../type";
import { ATR_PERIOD } from "../utils/config";
import {existsSync} from "fs";
import {config} from "dotenv";
const env = process.env.ENV || "dev"; // fallback to 'dev' mode
const envPath = `.env.${env}`;
if (existsSync(envPath)) {
  config({ path: envPath });
  console.log(`✅ Loaded ${envPath}`);
} else {
  console.warn(`⚠️ Environment file ${envPath} not found.`);
}
export const test = async () => {
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
  setInterval(updateFetchData, 2000);

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
          console.log(`🚀 Opening position for ${data.instId}`);
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
          console.log(`❌ Closing position for ${data.instId}`);
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

test();
