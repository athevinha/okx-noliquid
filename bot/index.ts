import dotenv from "dotenv";
import {Telegraf} from "telegraf";
import {botLoginCommand} from "./command/auth";
import {botCatchError} from "./command/catch";
import {botBarCommand} from "./command/config";
import {botReportPositions} from "./command/positions";
import {botAutoTrading} from "./command/trade";
import {closeFuturePosition, openFuturePosition} from "./helper/okx-trade";
import {WHITE_LIST_TOKENS_TRADE} from "./utils/config";
import {getAccountPositionsHistory} from "./helper/okx-account";
import {botReportPositionsHistory} from "./command/history";
import {getSymbolCandles} from "./helper/okx-candles";
import {findEMACrossovers} from "./signals/ema-cross";
import {decodeTimestamp} from "./utils";
import {botReportSymbolReport} from "./command/symbols-report";
import {IIntervalData} from "./type";
dotenv.config();

export async function bot(apiKey?: string) {
  if (apiKey) {
    const bot = new Telegraf(apiKey);
    const validUsername = "vicdvc";
    let authenticated = false;
    const intervalData: IIntervalData = {}
    
    botLoginCommand({bot, authenticated, validUsername})
    botCatchError({bot})
    botReportPositions({bot})
    botReportPositionsHistory({bot})
    botReportSymbolReport({bot})
    botAutoTrading({bot})

    bot.launch();
    
    process.once("SIGINT", () => bot.stop("SIGINT"));
    process.once("SIGTERM", () => bot.stop("SIGTERM"));
  }
}
