import axios from "axios";
import { OKX_BASE_FETCH_API_URL } from "../utils/config";
import { makeHeaderAuthenticationOKX } from "./auth";
import { getRandomeHttpAgent } from "../utils";
import { IOKXFunding } from "../type";
const MODE = process.env.ENV

export const getOKXFunding = async ({
  fundingDownTo,
  fundingUpTo,
}: {
  fundingUpTo?: number;
  fundingDownTo?: number;
}): Promise<IOKXFunding[]> => {
  const path = `/rubik/web/public/funding-rate-arbitrage?ctType=linear&ccyType=USDT`;
  const res = await axios.get(`${OKX_BASE_FETCH_API_URL}${path}`, {
    headers: makeHeaderAuthenticationOKX("GET", path, ""),
  });
  const _results: IOKXFunding[] = res?.data?.data;
  const results = _results.filter(
    (r) =>
      //  r.buyInstType === "SWAP" &&
      (!fundingUpTo || Number(r?.fundingRate) * 100 <= fundingUpTo) &&
      (!fundingDownTo || Number(r?.fundingRate) * 100 >= fundingDownTo)
  );
  return results;
};

export const getOKXFundingObject = async ({
  fundingDownTo,
  fundingUpTo,
}: {
  fundingUpTo?: number;
  fundingDownTo?: number;
}) => {
  const _fundingArbitrage: { [instId: string]: IOKXFunding } = {};
  (
    await getOKXFunding({
      fundingDownTo: fundingDownTo || -2,
      fundingUpTo: fundingUpTo || 2,
    })
  )
    .slice(0, 10)
    .forEach((e) => {
      if(MODE === "dev")
          e.fundingTime = String(Date.now() + 10000)
      _fundingArbitrage[`${e.ccy}-USDT-SWAP`] = e;
    });
  return _fundingArbitrage;
};
