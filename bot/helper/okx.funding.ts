import axios from "axios";
import { OKX_BASE_FETCH_API_URL } from "../utils/config";
import { makeHeaderAuthenticationOKX } from "./auth";
import { getRandomeHttpAgent } from "../utils";
import { IOKXFunding } from "../type";


export const getOKXFunding = async ({fundingDownTo, fundingUpTo}:{fundingUpTo?: number, fundingDownTo?: number}): Promise<IOKXFunding[]> => {
  const path = `/rubik/web/public/funding-rate-arbitrage?ctType=linear&ccyType=USDT`;
  const res = await axios.get(`${OKX_BASE_FETCH_API_URL}${path}`, {
    headers: makeHeaderAuthenticationOKX("GET", path, ""),
  });
  const _results: IOKXFunding[] = res?.data?.data
  const results = _results.filter(r => 
    //  r.buyInstType === "SWAP" &&
     (!fundingUpTo || (Number(r.fundingRate) * 100) <= fundingUpTo) && 
     (!fundingDownTo || (Number(r.fundingRate) * 100) >= fundingDownTo) )
  return results;
};
