import {ImgnMode} from "../type";

export const WHITE_LIST_TOKENS_TRADE = [
  "BTC-USDT-SWAP",
  "ETH-USDT-SWAP",
  // "SOL-USDT-SWAP",
  // "BNB-USDT-SWAP",
  // "NOT-USDT-SWAP",
  "PEPE-USDT-SWAP",
  // "OP-USDT-SWAP",
  // "MEW-USDT-SWAP",
  // "MEME-USDT-SWAP",

];
export const DEFAULT_BOT_CONFIG = {
  bar: '1Dutc',
  leve: 5,
  mgnMode: 'isolated',
  sz:500,
  intervalDelay: 30 * 1000,
  slopeThresholdUp: undefined,
  slopeThresholdUnder: undefined,
  slopeThreshAverageMode: undefined,
  tokenTradingMode: "whitelist"
}
export const MC_ALLOW_TO_TRADING = 300_000_000
export const OKX_BASE_FETCH_API_URL = "https://www.okx.com/priapi/v5";
export const OKX_BASE_API_URL = "https://www.okx.com";
export const USDT = "₮";

export const parseConfigInterval = (configString: string) => {
  const configParts = configString.split(" ");
  let {bar, leve, mgnMode, sz, intervalDelay, slopeThresholdUp, slopeThresholdUnder, slopeThreshAverageMode,  tokenTradingMode}: any = DEFAULT_BOT_CONFIG
  configParts.forEach((part) => {
    if (part.startsWith("bar-")) {
      bar = part.replace("bar-", "");
    } else if (part.startsWith("leve-")) {
      leve = parseInt(part.replace("leve-", ""));
    } else if (part.startsWith("mgnMode-")) {
      mgnMode = part.replace("mgnMode-", "") as ImgnMode;
    } else if (part.startsWith("sz-")) {
      sz = parseFloat(part.replace("sz-", ""));
    } else if (part.startsWith("delay-")) {
      intervalDelay = parseInt(part.replace("delay-", ""));
    } else if (part.startsWith("slopeUp-")) {
      slopeThresholdUp = parseFloat(part.replace("slopeUp-", ""));
    } else if (part.startsWith("slopeUnder-")) {
      slopeThresholdUnder = parseFloat(part.replace("slopeUnder-", ""));
    } else if (part.startsWith("avgMode-")) {
      slopeThreshAverageMode = part.replace("avgMode-", "") === "true";
    } else if (part.startsWith("tokenMode-")) {
      tokenTradingMode = part.replace("tokenMode-", "") as "all" | "whitelist" | string;
    }
  });

  return {
    bar,
    leve,
    mgnMode,
    sz,
    intervalDelay,
    slopeThresholdUp,
    slopeThresholdUnder,
    slopeThreshAverageMode,
    tokenTradingMode,
  };
};