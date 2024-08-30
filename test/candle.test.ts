import { expect } from 'chai';
import {WHITE_LIST_TOKENS_TRADE} from '../bot/utils/config';
import {getSupportCrypto, getSymbolCandles} from '../bot/helper/okx-candles';

describe('OKX candles test fetch', () => {
    it('Can fetch multi contract (Future) candles', async () => {
        const supportFutureCryptos = (await getSupportCrypto({}))
        const supportFutureCryptosByInstId = supportFutureCryptos.map(e => e.instId)
        console.log('Crypto support trade count:', supportFutureCryptosByInstId.length)
        const candles = await Promise.all(supportFutureCryptosByInstId.map(async spCrypto => {
            return await getSymbolCandles({
                instID: spCrypto,
                bar: '15m',
                before: 0,
                limit: 300
            })
        }))
        expect(supportFutureCryptos.length).eq(candles.filter(c => c.length >= 200 ).length)
    });
});
