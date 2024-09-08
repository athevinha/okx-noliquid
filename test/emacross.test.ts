import {expect} from 'chai';
import {getCandlesWithLimit, getSupportCrypto,getSymbolCandles} from '../bot/helper/okx-candles';
import {findEMACrossovers} from '../bot/signals/ema-cross';
import {decodeTimestamp} from '../bot/utils';

describe('Candles EMA cross test', () => {
    it('True EMA cross with single symbol', async () => {
        const SYMBOL = "AAVE-USDT-SWAP"
        const candles = await getSymbolCandles({
            before: 0,
            instID: SYMBOL,
            bar: '2H',
            limit: 300
        })
        const emaCross = findEMACrossovers(candles, 9, 21).map(e => ({...e, ts: decodeTimestamp(e.ts)}))
    });
});
