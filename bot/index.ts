import dotenv from 'dotenv'
import {Telegraf} from 'telegraf';
import {getAccountBalance, getSymbolCandles} from './helper/okx-candles';
import { calculateEMA, findEMACrossovers, simulateTrades} from './signals/ema-cross';
import {decodeTimestamp} from './utils';
import {WHITE_LIST_TOKENS_TRADE} from './utils/config';
dotenv.config();

export async function bot(apiKey?: string) {
    if(apiKey) {
        const bot = new Telegraf(apiKey);

    }
    const [balances] = await getAccountBalance()
    console.log(balances)
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