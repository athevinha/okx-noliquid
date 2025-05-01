import axios from "axios";
import { OKX_BASE_FETCH_API_URL } from "../utils/config";
import { makeHeaderAuthenticationOKX } from "./auth";
import { getRandomeHttpAgent } from "../utils";
import { IOKXFunding } from "../type";
import {getOKXTickerInfo} from "./okx.ccy";
import {MIN_TICKER_VOLUME_24H} from "../command/wstrade/trade";
const MODE = process.env.ENV
export const getOKXFunding = async ({
  fundingNegativeDownTo,
  fundingNegativeUpTo,
  fundingPositiveUpTo,
  fundingPositiveDownTo,
  minVolume24H = MIN_TICKER_VOLUME_24H
}: {
  fundingNegativeUpTo?: number;
  fundingNegativeDownTo?: number;
  fundingPositiveUpTo?: number;
  fundingPositiveDownTo?: number;
  minVolume24H?: number ;
}): Promise<IOKXFunding[]> => {
  const {tickerInfo, tickersInforWithObject} = await getOKXTickerInfo()
  const path = `/public/funding-rate-all?ccyType=USDT&instId=`;
  const res = await axios.get(`${OKX_BASE_FETCH_API_URL}${path}`, {
    headers: makeHeaderAuthenticationOKX("GET", path, ""),
  });
  const _results: IOKXFunding[] = res?.data?.data?.[0]?.fundingList;
  const results = _results.filter(
    (r) =>
      (Number(tickersInforWithObject[r.instId]?.volCcy24h) * Number(tickersInforWithObject[r.instId]?.last))  >= (minVolume24H || MIN_TICKER_VOLUME_24H) &&
      (
        (!fundingNegativeUpTo || Number(r?.fundingRate) * 100 <= fundingNegativeUpTo) && (!fundingNegativeDownTo || Number(r?.fundingRate) * 100 >= fundingNegativeDownTo) 
        || 
        (!fundingPositiveUpTo || Number(r?.fundingRate) * 100 <= fundingPositiveUpTo) && (!fundingPositiveDownTo || Number(r?.fundingRate) * 100 >= fundingPositiveDownTo) 
      )
  ).map(r => {return {...r, tickerInfor: tickersInforWithObject[r.instId]}});
  return results;
};

export const getOKXFundingObject = async ({
  fundingNegativeDownTo,
  fundingNegativeUpTo,
  fundingPositiveUpTo,
  fundingPositiveDownTo,
}: {
  fundingNegativeUpTo?: number;
  fundingNegativeDownTo?: number;
  fundingPositiveUpTo?: number;
  fundingPositiveDownTo?: number;
}) => {
  const _fundingArbitrage: { [instId: string]: IOKXFunding } = {};
  (
    await getOKXFunding({
      fundingNegativeDownTo: fundingNegativeDownTo || -2,
      fundingNegativeUpTo: fundingNegativeUpTo || 0,
      fundingPositiveDownTo: fundingPositiveDownTo || 0,
      fundingPositiveUpTo: fundingPositiveUpTo || 2,
    })
  )
    .slice(0, 10)
    .forEach((e) => {
      if(MODE === "dev")
          e.fundingTime = String(Date.now() + 10000)
      _fundingArbitrage[e.instId] = e;
    });
  return _fundingArbitrage;
};
