import { CampainState, ImgnMode } from "../type";
import dotenv from "dotenv";
dotenv.config();

export const WHITE_LIST_TOKENS_TRADE = [
  "WIF-USDT-SWAP",
  "PEPE-USDT-SWAP",
  "FLOKI-USDT-SWAP",
  "BONK-USDT-SWAP",
];
export const DEFAULT_BOT_CONFIG = {
  bar: "1H",
  leve: 3,
  mgnMode: "isolated",
  equityPercent: 90,
  slopeThresholdUp: undefined,
  slopeThresholdUnder: undefined,
  slopeThreshAverageMode: undefined,
  variance: undefined,
  scapeMode: true,
  tradeDirection: "long",
  tokenTradingMode: "whitelist",
};
export const USE_PROXY = true;
export const MC_ALLOW_TO_TRADING = 500_000_000;
export const ATR_PERIOD = 14;
export const OKX_BASE_FETCH_API_URL = "https://www.okx.com/priapi/v5";
export const OKX_BASE_WS_URL =
  Number(process.env.DEMO_TRADING) === 1
    ? "wss://wspap.okx.com:8443"
    : "wss://ws.okx.com:8443";
export const OKX_BASE_API_URL = "https://www.okx.com";
export const USDT = "₮";

export const parseConfigInterval = (configString: string) => {
  const configParts = configString.split(" ");
  let {
    bar,
    leve,
    mgnMode,
    equityPercent,
    sz,
    slopeThresholdUp,
    slopeThresholdUnder,
    slopeThreshAverageMode,
    variance,
    tradeDirection,
    scapeMode,
    tokenTradingMode,
  }: any = DEFAULT_BOT_CONFIG;
  const campaignInitialState: CampainState = {
    posIds: [],
    startTime: Date.now(),
  };
  configParts.forEach((part) => {
    if (part.startsWith("bar-")) {
      bar = part.replace("bar-", "");
    } else if (part.startsWith("leve-")) {
      leve = parseInt(part.replace("leve-", ""));
    } else if (part.startsWith("mgnMode-")) {
      mgnMode = part.replace("mgnMode-", "") as ImgnMode;
    } else if (part.startsWith("equityPercent-")) {
      equityPercent = parseFloat(part.replace("equityPercent-", ""));
    } else if (part.startsWith("sz-")) {
      sz = parseFloat(part.replace("sz-", ""));
    } else if (part.startsWith("slopeUp-")) {
      slopeThresholdUp = parseFloat(part.replace("slopeUp-", ""));
    } else if (part.startsWith("slopeUnder-")) {
      slopeThresholdUnder = parseFloat(part.replace("slopeUnder-", ""));
    } else if (part.startsWith("avgMode-")) {
      slopeThreshAverageMode = part.replace("avgMode-", "") === "true";
    } else if (part.startsWith("tradeDirection-")) {
      tradeDirection = part.replace("tradeDirection-", "");
    } else if (part.startsWith("tokenMode-")) {
      tokenTradingMode = part.replace("tokenMode-", "") as
        | "all"
        | "whitelist"
        | string;
    } else if (part.startsWith("variance-")) {
      variance = part.replace("variance-", "") as string;
      if (Number(variance)) variance = (Number(variance) / 100).toString();
      else if (variance.includes("auto")) variance = variance;
    }
  });

  return {
    bar,
    leve,
    mgnMode,
    equityPercent,
    sz,
    tradeDirection,
    scapeMode,
    slopeThresholdUp,
    slopeThresholdUnder,
    slopeThreshAverageMode,
    tokenTradingMode,
    variance,
    // Campain state
    ...campaignInitialState
  };
};
