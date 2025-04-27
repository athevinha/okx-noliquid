import axios from "axios";
import { ImgnMode, IPosSide, OKXResponse } from "../type";
import { OKX_BASE_API_URL } from "../utils/config";
import { makeHeaderAuthenticationOKX } from "./auth";
import { convertUSDToContractOrderSize } from "./okx.trade";
import { axiosErrorDecode } from "../utils";
import { getAccountPendingAlgoOrders, getAccountPosition, getAccountPositions } from "./okx.account";

export const openTrailingStopOrder = async ({
  instId,
  mgnMode,
  posSide,
  callbackRatio,
  size,
  sizeContract,
  activePx,
  reduceOnly = false,
}: {
  instId: string;
  mgnMode: ImgnMode;
  posSide: IPosSide;
  callbackRatio: string;
  activePx?:string;
  size: number;
  sizeContract?: number;
  reduceOnly?: boolean;
}): Promise<OKXResponse> => {
  try {
    let sz = String(sizeContract);
    if (!sizeContract) {
      if (size)
        sz = await convertUSDToContractOrderSize({
          instId,
          sz: size,
          opType: "close",
        });
      if (!sz)
        return {
          code: "",
          msg: "Convert USD contract error",
          data: [],
        };
    }
    const _side =
      posSide === "long" ? "sell" : posSide === "short" ? "buy" : "net";
    const body = JSON.stringify({
      instId,
      tdMode: mgnMode,
      side: _side,
      posSide,
      callbackRatio,
      ordType: "move_order_stop",
      sz,
      activePx,
      cxlOnClosePos: true,
    });
    const path = `/api/v5/trade/order-algo`;
    const res = await axios.post(`${OKX_BASE_API_URL}${path}`, body, {
      headers: makeHeaderAuthenticationOKX("POST", path, body),
    });
    return res?.data;
  } catch (error: any) {
    axiosErrorDecode(error);
    return {
      code: error?.code,
      data: [],
      msg: axiosErrorDecode(error),
    };
  }
};

export const closeAlgoWithInstId = async ({
  instId,
}: {
  instId: string;
}): Promise<OKXResponse> => {
  try {
    const [position] = await getAccountPositions("SWAP", [instId]);
    if(!position) throw "Not found position"
    
    const body = JSON.stringify(
      position.closeOrderAlgo
        .map((algo) => ({
          instId: position.instId,
          algoId: algo.algoId,
        }))
        .slice(0, 10),
    );
    if (JSON.parse(body).length === 0)
      return {
        code: "404",
        data: [],
        msg: "No trailing loss orders found.",
      };
    const path = `/api/v5/trade/cancel-algos`;
    const res = await axios.post(`${OKX_BASE_API_URL}${path}`, body, {
      headers: makeHeaderAuthenticationOKX("POST", path, body),
    });
    return res?.data as OKXResponse;
  } catch (error: any) {
    return {
      code: error?.code,
      data: [],
      msg: axiosErrorDecode(error),
    };
  }
};


export const openTPSLAlgoOrder = async ({
  instId,
  mgnMode,
  posSide,
  size,
  sizeContract,
  slTriggerPx,
  tpTriggerPx,
}: {
  instId: string;
  mgnMode: ImgnMode;
  posSide: IPosSide;
  size: number;
  tpTriggerPx?: string;
  slTriggerPx?:string;
  sizeContract?: number;
}): Promise<OKXResponse> => {
  try {
    let sz = String(sizeContract);
    if (!sizeContract) {
      if (size)
        sz = await convertUSDToContractOrderSize({
          instId,
          sz: size,
          opType: "close",
        });
      if (!sz)
        return {
          code: "",
          msg: "Convert USD contract error",
          data: [],
        };
    }
    const _side =
      posSide === "long" ? "sell" : posSide === "short" ? "buy" : "net";
    const body = JSON.stringify({
      instId,
      tdMode: mgnMode,
      side: _side,
      hasTp: true,
      hasSl: true,
      posSide,
      ordType: "oco",
      tpTriggerPxType: "mark",
      tpOrdPx : "-1",
      tpTriggerPx,
      slTriggerPxType: "mark",
      slOrdPx : "-1",
      closeFraction: 1,
      slTriggerPx,
      reduceOnly: true,
      cxlOnClosePos: true
    });
    const path = `/api/v5/trade/order-algo`;
    const res = await axios.post(`${OKX_BASE_API_URL}${path}`, body, {
      headers: makeHeaderAuthenticationOKX("POST", path, body),
    });
    return res?.data;
  } catch (error: any) {
    axiosErrorDecode(error);
    return {
      code: error?.code,
      data: [],
      msg: axiosErrorDecode(error),
    };
  }
};
export const editLimitAlgoOrders = async ({instId, algoId, newTpTriggerPx, newSlTriggerPx}: {instId: string, algoId: string, newTpTriggerPx?: string, newSlTriggerPx?: string}): Promise<OKXResponse> => {
  try {
    const body = JSON.stringify({
      instId,
      algoId,
      ...(newTpTriggerPx ? {newTpTriggerPx} : {}),
      ...(newSlTriggerPx ? {newSlTriggerPx} : {}),
    });
    const path = `/api/v5/trade/amend-algos`;
    const res = await axios.post(`${OKX_BASE_API_URL}${path}`, body, {
      headers: makeHeaderAuthenticationOKX("POST", path, body),
    });
    return res?.data;
  } catch (error: any) {
    axiosErrorDecode(error);
    return {
      code: error?.code,
      data: [],
      msg: axiosErrorDecode(error),
    };
  }
};