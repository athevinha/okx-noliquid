import dotenv from "dotenv";
import {Telegraf} from "telegraf";
import {botLoginCommand} from "./command/auth";
import {botCatchError} from "./command/catch";
import {botBarCommand} from "./command/config";
import {botReportPositions} from "./command/positions";
import {botWatchingInterval} from "./command/trade";
import {closeFuturePosition, openFuturePosition} from "./helper/okx-trade";
import {WHITE_LIST_TOKENS_TRADE} from "./utils/config";
import {getAccountPositionsHistory} from "./helper/okx-account";
import {botReportPositionsHistory} from "./command/history";
dotenv.config();

export async function bot(apiKey?: string) {
  if (apiKey) {
    const bot = new Telegraf(apiKey);
    const validUsername = "vicdvc";
    let bar = '1H'
    let authenticated = false;
    let intervalId: NodeJS.Timeout | null = null;
    
    botLoginCommand({bot, authenticated, validUsername})
    botBarCommand({bot, bar})
    botCatchError({bot})
    botReportPositions({bot})
    botReportPositionsHistory({bot})
    botWatchingInterval({bot, intervalId, bar})

    bot.launch();
    
    process.once("SIGINT", () => bot.stop("SIGINT"));
    process.once("SIGTERM", () => bot.stop("SIGTERM"));
  }
  // const {msg: openMsg} = await openFuturePosition({
  //   instId: WHITE_LIST_TOKENS_TRADE[0],
  //   leverage: 70, 
  //   size: 500,
  //   posSide: 'short',
  //   mgnMode:'isolated'
  // })
  // const {msg: closeMsg} = await closeFuturePosition({
  //   instId: WHITE_LIST_TOKENS_TRADE[0],
  //   posSide: 'short',
  //   mgnMode:'isolated'
  // })
    // const positionsHistory = await getAccountPositionsHistory("SWAP");
    // const positions = await getAccountPositions("SWAP");
    // const positionsHistoryRisk = await getAccountPositionRisk("SWAP");
    // console.log(positions[0]);

  // console.log(ordersHistory.length, orders.length, positions.length)
  // const accountConfig = await getAccountConfig()
  // await setPositionMode('long_short_mode')
  // await setLeveragePair('ETH-USDT-SWAP', 5, 'isolated', 'short')
  // const _placeOrder = await placeOrder({
  //     instId : 'ETH-USDT-SWAP',
  //     tdMode: 'isolated',
  //     side: 'sell',
  //     posSide: 'short',
  //     ordType: 'market',
  //     szUSD: 100, // ETH * USDT
  // })
  // console.log(_placeOrder)
  // console.log(a)
  // const orders = await getAccountOrders('SWAP')
  // const accountConfigs = await getAccountConfig()
  // console.log(ordersHistory)
  // await Promise.all(
  //   WHITE_LIST_TOKENS_TRADE.map(async (SYMBOL) => {
  //     const candles = await getSymbolCandles({
  //       instID: `${SYMBOL}`,
  //       before: 0,
  //       bar: "1m",
  //       limit: 10000,
  //     });
  //     // console.log(SYMBOL, candles[candles.length - 1].c);
  //     const emaCross = findEMACrossovers(candles, 9, 21);
  //     console.log(emaCross.map(a => {return {...a, ts: decodeTimestamp(Math.round(a.ts))}}).slice(-1))
  //     console.log(candles.map(a => {return {...a, ts: decodeTimestamp(Math.round(a.ts))}}).slice(-1))

  //     // const trades = simulateTrades(emaCross, 500);
  //     // console.log(
  //     //   `-----------------------${SYMBOL}-----------------------------`
  //     // );
  //     // console.log("Total PNL ($):", trades.totalPnL);
  //     // console.log("Volume ($):", trades.totalVolumeInUSD);
  //     // console.log("Total Tx:", trades.totalTransactions);
  //     // console.log(
  //     //   "Trade time:",
  //     //   trades.closedTrades[0].ts,
  //     //   "->",
  //     //   trades.closedTrades[trades.closedTrades.length - 1].ts
  //     // );
  //   })
  // );

  // console.log(emaCross926.map(a => {return {...a, ts: decodeTimestamp(Math.round(a.ts))}}).slice(-2))
  // console.log(emaCross926)
}
