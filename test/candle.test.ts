import { expect } from 'chai';
import {WHITE_LIST_TOKENS_TRADE} from '../bot/utils/config';
import {getCandlesWithLimit, getSupportCrypto, getSymbolCandles} from '../bot/helper/okx-candles';
import {decodeTimestamp, decodeTimestampAgo} from '../bot/utils';

describe('OKX candles test fetch', () => {
    it('Can fetch multi contract (Future) candles', async () => {
        // const supportFutureCryptos = (await getSupportCrypto({}))
        // const supportFutureCryptosByInstId = supportFutureCryptos.map(e => e.instId)
        // console.log('Crypto support trade count:', supportFutureCryptosByInstId.length)

        // const _candles = await getSymbolCandles({
        //     before: 0,
        //     instID: 'BTC-USDT-SWAP',
        //     bar: '15m',
        //     limit: 300
        // })
        const _candles1 = await getCandlesWithLimit({
            instID: 'BTC-USDT-SWAP',
            bar: '15m',
            limit: 2000
        })
        // console.log(decodeTimestampAgo(_candles[0].ts))
        console.log(decodeTimestampAgo(_candles1[0].ts))
        console.log(decodeTimestampAgo(_candles1[_candles1.length - 1].ts))

        // let [candles] = await Promise.all([WHITE_LIST_TOKENS_TRADE[0]].map(async spCrypto => {
        //     return await getSymbolCandlesUnLimit({
        //         before: 0,
        //         after: 1725003000000,
        //         instID: spCrypto,
        //         bar: '15m',
        //         limit: 300
        //     })
        // }))
        // candles = candles.sort((a,b) => Number(a.ts) - Number(b.ts))
        // console.log(candles.length)
        // console.log(decodeTimestamp(candles[0].ts))
        // console.log(decodeTimestamp(candles[candles.length - 1].ts))
        // expect(supportFutureCryptos.length).eq(candles.filter(c => c.length >= 200 ).length)
    });
});
