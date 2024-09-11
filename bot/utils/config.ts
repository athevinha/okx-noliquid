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
  sz: 50,
  slopeThresholdUp: undefined,
  slopeThresholdUnder: undefined,
  slopeThreshAverageMode: undefined,
  variance: undefined,
  tokenTradingMode: "whitelist"
}
export const USE_PROXY = true
export const MC_ALLOW_TO_TRADING = 500_000_000
export const OKX_BASE_FETCH_API_URL = "https://www.okx.com/priapi/v5";
export const OKX_BASE_WS_URL = "wss://ws.okx.com:8443";
export const OKX_BASE_API_URL = "https://www.okx.com";
export const USDT = "₮";

export const parseConfigInterval = (configString: string) => {
  const configParts = configString.split(" ");
  let {bar, leve, mgnMode, sz, slopeThresholdUp, slopeThresholdUnder, slopeThreshAverageMode, variance, tokenTradingMode}: any = DEFAULT_BOT_CONFIG
  configParts.forEach((part) => {
    if (part.startsWith("bar-")) {
      bar = part.replace("bar-", "");
    } else if (part.startsWith("leve-")) {
      leve = parseInt(part.replace("leve-", ""));
    } else if (part.startsWith("mgnMode-")) {
      mgnMode = part.replace("mgnMode-", "") as ImgnMode;
    } else if (part.startsWith("sz-")) {
      sz = parseFloat(part.replace("sz-", ""));
    } else if (part.startsWith("slopeUp-")) {
      slopeThresholdUp = parseFloat(part.replace("slopeUp-", ""));
    } else if (part.startsWith("slopeUnder-")) {
      slopeThresholdUnder = parseFloat(part.replace("slopeUnder-", ""));
    } else if (part.startsWith("avgMode-")) {
      slopeThreshAverageMode = part.replace("avgMode-", "") === "true";
    } else if (part.startsWith("tokenMode-")) {
      tokenTradingMode = part.replace("tokenMode-", "") as "all" | "whitelist" | string;
    }else if (part.startsWith("variance-")) {
      variance = part.replace("variance-", "") as string;
      if(Number(variance)) variance = (Number(variance) / 100).toString()
      else if(variance === 'auto') variance = 'auto'
    }
  });

  return {
    bar,
    leve,
    mgnMode,
    sz,
    slopeThresholdUp,
    slopeThresholdUnder,
    slopeThreshAverageMode,
    tokenTradingMode,
    variance
  };
};