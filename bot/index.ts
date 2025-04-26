import dotenv from "dotenv";
import { Telegraf } from "telegraf";
import { botLoginCommand } from "./command/auth";
import { botCatchError } from "./command/catch";
import { botReportPositionsHistory } from "./command/history";
import { botReportPositions } from "./command/positions";
import { botReportSymbolReport } from "./command/symbols-report";
import { botAutoTrading } from "./command/wstrade/trade";
import { CampaignConfig } from "./type";
import { botWSManagement } from "./command/ws";
// import {botFunding} from "./command/test";
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
export async function bot(apiKey?: string) {
  if (apiKey) {
    const bot = new Telegraf(apiKey);
    const validUsername = "vicdvc";
    let authenticated = false;
    const campaigns = new Map<string, CampaignConfig>();
    botLoginCommand({ bot, authenticated, validUsername });
    botCatchError({ bot });
    botReportPositions({ bot, campaigns });
    botReportPositionsHistory({ bot, campaigns });
    botReportSymbolReport({ bot, campaigns });
    botAutoTrading({ bot, campaigns });
    botWSManagement({ bot, campaigns });
    // botFunding({bot, campaigns})
    bot.launch();

    process.once("SIGINT", () => bot.stop("SIGINT"));
    process.once("SIGTERM", () => bot.stop("SIGTERM"));
  }
}
