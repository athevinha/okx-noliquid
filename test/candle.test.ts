import {expect} from 'chai';
import {getCandlesWithLimit, getSupportCrypto,getSymbolCandles} from '../bot/helper/okx.candles';

describe('OKX candles test fetch', () => {
    it('Can fetch multi contract (Future) candles', async () => {
        const supportFutureCryptos = (await getSupportCrypto({}))
        const supportFutureCryptosByInstId = supportFutureCryptos.map(e => e.instId)
        let candles = await Promise.all(supportFutureCryptosByInstId.map(async spCrypto => {
            return await getSymbolCandles({
                before: 0,
                instID: spCrypto,
                bar: '15m',
                limit: 300
            })
        }))
        expect(supportFutureCryptos.length).eq(candles.filter(c => c.length >= 200 ).length)
    });
    it('Can fetch more candles candles', async () => {
        const supportFutureCryptos = (await getSupportCrypto({}))
        const supportFutureCryptosByInstId = supportFutureCryptos.map(e => e.instId)
        const LIMIT = 1000
        let candles = await Promise.all(supportFutureCryptosByInstId.map(async spCrypto => {
            return await getCandlesWithLimit({
                instID: spCrypto,
                bar: '1m',
                limit: LIMIT
            })
        }))
        expect(candles.filter(c => c.length === 1000).length).eq(candles.length)
        expect(supportFutureCryptos.length).eq(candles.filter(c => c.length >= 200 ).length)
    });
});
