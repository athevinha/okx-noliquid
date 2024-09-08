import axios from "axios";
import {
    ImgnMode,
    IPosSide,
    OKXResponse
} from "../type";
import {OKX_BASE_API_URL} from "../utils/config";
import {makeHeaderAuthenticationOKX} from "./auth";
import {convertUSDToContractOrderSize} from "./okx.trade";

export const openTrailingStopOrder = async ({
    instId,
    mgnMode,
    posSide,
    callbackRatio,
    size,
    reduceOnly = false,
  }: {
    instId: string;
    mgnMode: ImgnMode;
    posSide: IPosSide;
    callbackRatio: string;
    size: number;
    reduceOnly?: boolean
  }): Promise<OKXResponse> => {
    try {
      const sz = await convertUSDToContractOrderSize({ instId, sz: size });
      if(!sz) return {
        code: '',
        msg: 'Convert USD contract error',
        data: []
      }
      const _side = posSide === 'long' ? 'sell' : (posSide === 'short' ? 'buy' : 'net')
      const body = JSON.stringify({
        instId,
        tdMode: mgnMode,
        side: _side,
        posSide,
        callbackRatio,
        ordType: 'move_order_stop',
        sz,
        reduceOnly,
      });
      const path = `/api/v5/trade/order-algo`;
      const res = await axios.post(`${OKX_BASE_API_URL}${path}`, body, {
        headers: makeHeaderAuthenticationOKX("POST", path, body),
      });
      return res?.data;
    } catch (error: any) {
      console.error(error?.reason ,error?.message ,error?.code);
      return {
        code: error?.code,
        data: [],
        msg: `${error?.reason} ${error?.message}`,
      };
    }
  };
  