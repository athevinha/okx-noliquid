import axios from "axios";
import { ICcyInfo, IInstType, IOKXTikerInfo } from "../type";
import { getRandomeHttpAgent } from "../utils";
import { OKX_BASE_API_URL } from "../utils/config";
import { makeHeaderAuthenticationOKX } from "./auth";
export const getCurrencyInfo = async (
  ccy: string
): Promise<ICcyInfo | undefined> => {
  const httpsAgent = getRandomeHttpAgent();
  try {
    const res = await axios.get(
      `https://www.okx.com/v2/support/info/announce/coinDataInfo?projectName=${ccy}`,
      { httpsAgent }
    );
    if (res.data.code !== 0) console.log(res.data.msg);
    return res.data?.data as ICcyInfo;
  } catch (error: any) {
    console.log(error?.message, error?.code, error?.reason);
  }
};

export const getOKXTickerInfo = async (
  instType: IInstType = "SWAP"
): Promise<{
  tickersInforWithObject: { [instId: string]: IOKXTikerInfo };
  tickerInfo: IOKXTikerInfo[];
}> => {
  const path = `/api/v5/market/tickers?instType=${instType}`;
  const res = await axios.get(`${OKX_BASE_API_URL}${path}`);
  const _results: IOKXTikerInfo[] = res?.data?.data;
  const resultsWithObject: { [instId: string]: IOKXTikerInfo } = {};
  _results.map((data) => {
    resultsWithObject[data.instId] = data;
  });
  return {
    tickersInforWithObject: resultsWithObject,
    tickerInfo: _results,
  };
};
