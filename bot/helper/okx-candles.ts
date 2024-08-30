import axios from "axios"
import {MC_ALLOW_TO_TRADING, OKX_BASE_API_URL, OKX_BASE_FETCH_API_URL} from "../utils/config"
import {IAccountBalance, ICandles, IInstrumentsData} from "../type"
import {makeHeaderAuthenticationOKX} from "./auth"
import {getRandomElementFromArray} from "../utils"
import proxys from "../../proxys.json"
import {HttpsProxyAgent} from "https-proxy-agent"
import {getCurrencyInfo} from "./okx-ccy"
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
export const getSymbolCandles = async ({
    instID,
    before,
    bar,
    limit
  }: {
    instID: string;
    before: number;
    bar: string;
    limit: number;
  }): Promise<ICandles> => {
    const maxRetries = 3;
    let attempts = 0;
  
    const fetchCandles = async (): Promise<string[][]> => {
      const proxy: any = getRandomElementFromArray(proxys);
      const proxyHost = proxy.ip;
      const proxyPort = proxy.port;
      const proxyUsername = proxy.username; // If the proxy requires authentication
      const proxyPassword = proxy.password; // If the proxy requires authentication
  
      const proxyURL = `http://${
        proxyUsername && proxyPassword ? `${proxyUsername}:${proxyPassword}@` : ""
      }${proxyHost}:${proxyPort}`;
      const httpsAgent = new HttpsProxyAgent(proxyURL);
  
      const path = `/api/v5/market/candles?instId=${instID}&before=${before}&bar=${bar}&limit=${limit}&t=${Date.now()}`
      const res = await axios.get(`${OKX_BASE_API_URL}${path}`, {
          headers: makeHeaderAuthenticationOKX('GET', path, ''),
          httpsAgent
      })
      if(res.data.code !== '0') console.log(instID, res.data.msg)
      return res.data?.data;
    };
  
    try {
      let arrayCandles: string[][] = [];
  
      while (attempts < maxRetries) {
        attempts += 1;
        
        arrayCandles = await fetchCandles();
  
        if (arrayCandles?.length > 0) {
          break;
        }
  
      }
  
      // Return the formatted candles
      return arrayCandles.reverse().map(candle => {
        return {
          ts: Number(candle[0]),
          o: Number(candle[1]),
          h: Number(candle[2]),
          l: Number(candle[3]),
          c: Number(candle[4]),
          vol: Number(candle[5]),
          volCcy: Number(candle[6]),
          volCcyQuote: Number(candle[7]),
          confirm: Number(candle[8])
        };
      });
    } catch (error) {
      console.log(error);
      return [];
    }
  };

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

export const getSupportCrypto = async ({instType = 'SWAP'}: {instType?:string}): Promise<IInstrumentsData[]> => {
  try {
    const path = `/api/v5/public/instruments?instType=${instType}`
    const res = await axios.get(`${OKX_BASE_API_URL}${path}`, {
        headers: makeHeaderAuthenticationOKX('GET', path, ''),
    })
    if(res.data.code !== '0') console.log(res.data.msg)
    const instInfo =  (res.data?.data as IInstrumentsData[]).filter(e => e.instId.includes('USDT') && !e.instId.includes('USDC'));

    const instData: IInstrumentsData[] = []
    await Promise.all(instInfo.map(async inst => {
      const info = await getCurrencyInfo(inst.instId.split('-')[0]) 
      if ((info?.marketCap || 0) >= MC_ALLOW_TO_TRADING) instData.push(inst)
    }))
    return instData
  } catch (error) {
    return []
  }
}