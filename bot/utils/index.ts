import crypto from "crypto";
import { IPosSide, OKXResponse } from "../type";
import { USE_PROXY, WHITE_LIST_TOKENS_TRADE } from "./config";
import { getSupportCrypto } from "../helper/okx.candles";
import { HttpsProxyAgent } from "https-proxy-agent";
import proxys from "../../proxys.json";
import WebSocket from "ws";
import {existsSync} from "fs";
import {config} from "dotenv";

export const loadEnv = () =>  {
  const env = process.env.ENV || "dev"; // fallback to 'dev' mode
  const envPath = `.env.${env}`;
  if (existsSync(envPath)) {
    config({ path: envPath });
  } else {
    console.warn(`⚠️ Environment file ${envPath} not found.`);
  }
}
export function decodeTimestamp(
  ts?: number,
  UTC: number = 7 * 60 * 60 * 1000,
): string {
  if (!ts) return "0";
  const date = new Date(ts + UTC);
  return date.toISOString(); // Returns date in ISO 8601 format (e.g., '2023-08-23T12:34:56.789Z')
}
export function decodeTimestampAgo(timestamp?: number, clean = false): string {
  if (!timestamp) return "0";
  const currentTime = Date.now();
  const difference = currentTime - timestamp;

  const millisecondsPerMinute = 60 * 1000;
  const millisecondsPerHour = 60 * millisecondsPerMinute;
  const millisecondsPerDay = 24 * millisecondsPerHour;

  const days = Math.floor(difference / millisecondsPerDay);
  const hours = Math.floor(
    (difference % millisecondsPerDay) / millisecondsPerHour,
  );
  const minutes = Math.floor(
    (difference % millisecondsPerHour) / millisecondsPerMinute,
  );

  const daysText =
    days > 0 ? `${days}${clean ? "d" : ` day${days !== 1 ? "s" : ""}`}` : "";
  const hoursText =
    hours > 0
      ? `${hours}${clean ? "h" : ` hour${hours !== 1 ? "s" : ""}`}`
      : "";
  const minutesText =
    minutes > 0
      ? `${minutes}${clean ? "m" : ` min${minutes !== 1 ? "s" : ""}`}`
      : "";

  if (days > 0) {
    return `${daysText} ${hoursText} ago`;
  } else if (hours > 0) {
    return `${hoursText} ${minutesText} ago`;
  } else {
    return `${minutesText} ago`;
  }
}

export function createSignature(
  timestamp: string,
  method: string,
  requestPath: string,
  body?: string,
  SECRET_KEY?: string,
): string {
  const prehashString = `${timestamp}${method}${requestPath}${body}`;
  const hmac = crypto.createHmac("sha256", SECRET_KEY || "");
  hmac.update(prehashString);
  return hmac.digest("base64");
}

export function toFixed(x: any): string {
  if (Math.abs(x) < 1.0) {
    // eslint-disable-next-line no-var
    var e = parseInt(x.toString().split("e-")[1]);
    if (e) {
      x *= Math.pow(10, e - 1);
      x = String("0." + new Array(e).join("0") + x.toString().substring(2));
    }
  } else {
    // eslint-disable-next-line no-var
    var e = parseInt(x.toString().split("+")[1]);
    if (e > 20) {
      e -= 20;
      x /= Math.pow(10, e);
      x = String(x + new Array(e + 1).join("0"));
    }
  }
  return x;
}
export const zerofy = (
  _value: number | string,
  minZeroDecimal: number = 4,
): string => {
  const value = Number(toFixed(_value));
  const countZeroAfterDot = -Math.floor(Math.log10(value) + 1);
  if (
    Number.isFinite(countZeroAfterDot) &&
    countZeroAfterDot >= minZeroDecimal
  ) {
    const ucZeros = String.fromCharCode(
      parseInt(`+208${countZeroAfterDot}`, 16),
    );
    return value
      .toLocaleString("fullwide", {
        maximumSignificantDigits: 4,
        maximumFractionDigits: 18,
      })
      .replace(/[.,]{1}0+/, `.0${ucZeros}`);
  }
  return value.toLocaleString("fullwide", {
    maximumSignificantDigits: 4,
    maximumFractionDigits: 18,
  });
};

export const formatU = (u: string | number): string => {
  const num = typeof u === "string" ? parseFloat(u) : u;
  return num < 0 ? `-$${zerofy(Math.abs(num))}` : `+$${zerofy(num)}`;
};
export const decodeSymbol = (symbol: string) => {
  return symbol.split("-").slice(0, 2).join("/");
};
export function getRandomElementFromArray<T>(array: T[]): T {
  if (!Array.isArray(array) || array.length === 0) {
    throw new Error("Input should be a non-empty array.");
  }

  const randomIndex = Math.floor(Math.random() * array.length);
  return array[randomIndex];
}

export const generateTableReport = (
  data: Array<{ [key: string]: string | number }>,
  headers: string[],
) => {
  const columnWidths = headers.map((header) =>
    Math.max(
      header.length,
      ...data.map((row) => row[header].toString().length),
    ),
  );

  const generateRow = (row: { [key: string]: string | number }) =>
    headers
      .map((header, i) => row[header].toString().padEnd(columnWidths[i]))
      .join(" | ");

  const headerRow = headers
    .map((header, i) => header.padEnd(columnWidths[i]))
    .join(" | ");
  const separator = columnWidths.map((width) => "-".repeat(width)).join("-|-");

  const rows = data.map(generateRow).join("\n");

  return `${headerRow}\n${separator}\n${rows}`;
};
export const generateTelegramTableReport = (
  data: Array<{ [key: string]: string | number }>,
  headers: string[],
) => {
  const columnWidths = headers.map((header) =>
    Math.max(
      header.length,
      ...data.map((row) => row[header].toString().length),
    ),
  );

  const generateRow = (row: { [key: string]: string | number }) =>
    headers
      .map((header, i) => row[header].toString().padEnd(columnWidths[i]))
      .join(" | ");

  const headerRow = headers
    .map((header, i) => header.padEnd(columnWidths[i]))
    .join(" | ");
  const separator = columnWidths.map((width) => "-".repeat(width)).join("-|-");

  const rows = data.map(generateRow).join("\n");

  return `<pre>${headerRow}\n${separator}\n${rows}</pre>`;
};

export const decodeClOrdId = ({
  campaignId,
  instId,
  posSide,
  leverage,
  size,
}: {
  campaignId: string;
  instId: string;
  posSide: IPosSide;
  leverage: number;
  size: number;
}) => {
  return `${campaignId}`
    .replaceAll("-", "o")
    .replaceAll("_", "o")
    .replaceAll("/", "o")
    .slice(0, 32)
    .toLowerCase();
};

export const decodeTag = ({
  campaignId,
  instId,
  posSide,
  leverage,
  size,
}: {
  campaignId: string;
  instId: string;
  posSide: IPosSide;
  leverage: number;
  size: number;
}) => {
  return `${campaignId}o${size}o${leverage}`
    .replaceAll("-", "o")
    .replaceAll("_", "o")
    .replaceAll("/", "o")
    .slice(0, 16)
    .toLowerCase();
};

export const getTradeAbleCrypto = async (tokenTradingMode: string) => {
  const supportFutureCryptos = await getSupportCrypto({});
  const supportFutureCryptosByInstId = supportFutureCryptos.map(
    (e) => e.instId,
  );
  let tradeAbleCrypto = WHITE_LIST_TOKENS_TRADE;
  if (tokenTradingMode === "whitelist")
    tradeAbleCrypto = WHITE_LIST_TOKENS_TRADE;
  else if (tokenTradingMode === "all") {
    tradeAbleCrypto = supportFutureCryptosByInstId;
  } else {
    tradeAbleCrypto = tokenTradingMode?.split("/") || [];
  }
  return tradeAbleCrypto.filter((instId) =>
    supportFutureCryptosByInstId.includes(instId),
  );
};

export const getRandomeHttpAgent = () => {
  if (!USE_PROXY) return undefined;
  const proxy: any = getRandomElementFromArray(proxys);
  const proxyHost = proxy.ip;
  const proxyPort = proxy.port;
  const proxyUsername = proxy.username; // If the proxy requires authentication
  const proxyPassword = proxy.password; // If the proxy requires authentication

  const proxyURL = `http://${
    proxyUsername && proxyPassword ? `${proxyUsername}:${proxyPassword}@` : ""
  }${proxyHost}:${proxyPort}`;
  const httpsAgent = new HttpsProxyAgent(proxyURL);
  return httpsAgent;
};

export const axiosErrorDecode = (error: any, log: boolean = true) => {
  if (log)
    console.error(
      error?.response?.data?.msg || "",
      error?.reason || "",
      error?.message || "",
      error?.response?.data?.code || error.code || "",
    );
  return `${error?.response?.data?.msg || ""}${error?.reason || ""}${error?.message || ""}${error?.response?.data?.code || error?.code || ""}`;
};

export const estimatePnl = ({
  posSide,
  sz,
  c,
  e,
}: {
  posSide: IPosSide;
  sz: number | string;
  c: number | string;
  e: number | string;
}): {
  estPnlStopLoss: number;
  estPnlStopLossPercent: number;
  estPnlStopLossIcon: string;
} => {
  let estPnlStopLossPercent = 0;
  let estPnlStopLoss = 0;
  if (posSide === "long")
    estPnlStopLossPercent = (Number(c) - Number(e)) / Number(e);
  else if (posSide === "short")
    estPnlStopLossPercent = (Number(e) - Number(c)) / Number(e);
  estPnlStopLoss = estPnlStopLossPercent * Number(sz);
  let estPnlStopLossIcon = estPnlStopLoss >= 0 ? "🟣" : "🟠";
  return {
    estPnlStopLoss,
    estPnlStopLossPercent,
    estPnlStopLossIcon,
  };
};

export const okxReponseChecker = (
  po: OKXResponse,
  isCheckSCode: boolean = true,
) => {
  const status =
    po.msg === "" &&
    po.code === "0" &&
    (!isCheckSCode || po?.data?.[0]?.sCode === "0");
  if (status === false) console.error(po);
  return status;
};

export const okxReponseDecode = (
  po: OKXResponse,
  isCheckSCode: boolean = true,
): string => {
  let msg = po.msg;
  if (isCheckSCode && po?.data?.[0]?.sMsg && po?.data?.[0]?.sCode !== "0") {
    msg += po?.data?.[0]?.sMsg;
  }
  return msg;
};
