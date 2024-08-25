import dotenv from 'dotenv';
import {Telegraf} from 'telegraf';
import {getAccountConfig, getAccountPendingOrders, getAccountOrdersHistory, getAccountPositionRisk, getAccountPositions, getAccountPositionsHistory} from './helper/okx-account';
import {placeOrder, setLeveragePair, setPositionMode} from './helper/okx-trade';
dotenv.config();

export async function bot(apiKey?: string) {
    if(apiKey) {
        const bot = new Telegraf(apiKey);

    }
    const positionsHistory = await getAccountPositionsHistory('SWAP')
    const positions = await getAccountPositions('SWAP')
    const positionsHistoryRisk = await getAccountPositionRisk('SWAP')
    console.log(positionsHistoryRisk[0].posData)

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
    // await Promise.all(WHITE_LIST_TOKENS_TRADE.map(async SYMBOL => {
    //     const candles = await getSymbolCandles({
    //         instID: `${SYMBOL}-USDT`,
    //         before: 0,
    //         bar: '1H',
    //         limit: 10000
    //     })
    //     const emaCross = findEMACrossovers(candles, 9,21) 
    //     const trades = simulateTrades(emaCross, 500)
    //     // console.table(trades.closedTrades);
    //     console.log(`-----------------------${SYMBOL}-----------------------------`)
    //     console.log('Total PNL ($):', trades.totalPnL)
    //     console.log('Volume ($):', trades.totalVolumeInUSD)
    //     console.log('Total Tx:',trades.totalTransactions)
    //     console.log('Trade time:',trades.closedTrades[0].ts,'->',trades.closedTrades[trades.closedTrades.length - 1].ts)
    // }))
  


    // console.log(emaCross926.map(a => {return {...a, ts: decodeTimestamp(Math.round(a.ts))}}).slice(-2))
    // console.log(emaCross926)
}