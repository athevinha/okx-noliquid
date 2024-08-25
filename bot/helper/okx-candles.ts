import axios from "axios"
import {OKX_BASE_API_URL, OKX_BASE_FETCH_API_URL} from "../utils/config"
import {IAccountBalance, ICandles} from "../type"
import {makeHeaderAuthenticationOKX} from "./auth"
// -- DEV --
// ts	String	Opening time of the candlestick, Unix timestamp format in milliseconds, e.g. 1597026383085
// o	String	Open price
// h	String	highest price
// l	String	Lowest price
// c	String	Close price
// vol	String	Trading volume
// If it is SPOT, the value is the quantity in base currency.
// volCcy	String	Trading volume
// If it is SPOT, the value is the quantity in quote currency.
// volCcyQuote	String	Trading volume, the value is the quantity in quote currency
// e.g. The unit is USDT for BTC-USDT
// confirm	String	The state of candlesticks.
// 0: K line is uncompleted
// 1: K line is completed
// Bar size, the default is 1m
// e.g. [1m/3m/5m/15m/30m/1H/2H/4H]
// Hong Kong time opening price k-line: [6H/12H/1D/2D/3D/1W/1M/3M]
// UTC time opening price k-line: [/6Hutc/12Hutc/1Dutc/2Dutc/3Dutc/1Wutc/1Mutc/3Mutc]
export const getSymbolCandles = async ({instID, before, bar, limit}: {instID:string, before: number, bar: string, limit: number}): Promise<ICandles> => {
    try {
        const res = await axios.get(`${OKX_BASE_FETCH_API_URL}/market/candles?instId=${instID}&before=${before}&bar=${bar}&limit=${limit}&t=${Date.now()}`)
        const arrayCandles: string[][] = res.data?.data
        return arrayCandles.reverse().map(candle => {
            return {
                ts: Number(candle[0]),
                o:  Number(candle[1]),
                h:  Number(candle[2]),
                l:  Number(candle[3]),
                c:  Number(candle[4]),
                vol:  Number(candle[5]),
                volCcy:  Number(candle[6]),
                volCcyQuote:  Number(candle[7]),
                confirm:  Number(candle[8]),
              }
        })
    } catch (error) {
        console.log(error)
        return []
    }
}

export const getAccountConfig = async (): Promise<any[]> => {
    try {
        const path = `/api/v5/account/config`
        const res = await axios.get(`${OKX_BASE_API_URL}${path}`, {
            headers: makeHeaderAuthenticationOKX('GET', path, ''),
        })
        return res?.data?.data as IAccountBalance[]
    } catch (error) {
        console.log(error)
        return []
    }
}