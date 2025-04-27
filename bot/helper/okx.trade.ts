import axios from "axios";
import {
  IContracConvertResponse,
  ImgnMode,
  IPosSide,
  ISide,
  ISymbolPriceTicker,
  OKXResponse,
} from "../type";
import {
  axiosErrorDecode,
  decodeClOrdId,
  decodeTag,
  getRandomeHttpAgent,
  okxReponseChecker,
  okxReponseDecode,
} from "../utils";
import { OKX_BASE_API_URL } from "../utils/config";
import { makeHeaderAuthenticationOKX } from "./auth";
import {
  closeAlgoWithInstId,
  openTPSLAlgoOrder,
  openTrailingStopOrder,
} from "./okx.trade.algo";

export const setLeveragePair = async (
  instId: string,
  lever: number,
  mgnMode: string,
  posSide: string,
): Promise<OKXResponse> => {
  const path = `/api/v5/account/set-leverage`;
  
  const trySetLeverage = async (): Promise<OKXResponse> => {
    try {
      const body = JSON.stringify({ instId, lever, mgnMode, posSide });
      const res = await axios.post(`${OKX_BASE_API_URL}${path}`, body, {
        headers: makeHeaderAuthenticationOKX("POST", path, body),
      });
      return res?.data;
    } catch (error: any) {
      return {
        code: error?.code || "-1",
        data: [],
        msg: `${error?.reason || "Unknown reason"} ${error?.message || ""}`,
      };
    }
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await trySetLeverage();
    if (response.code === "0") {
      return response;
    }
    if (attempt < 2) {
      await new Promise(resolve => setTimeout(resolve, 1500)); // wait 2 seconds before next attempt
    }
  }

  // After 3 failed attempts
  return {
    code: "-1",
    data: [],
    msg: "Failed to set leverage after 3 attempts",
  };
};

export const setPositionMode = async (
  mode: string = "long_short_mode",
): Promise<OKXResponse> => {
  try {
    const body = {
      posMode: mode,
    };
    const path = `/api/v5/account/set-position-mode`;
    const res = await axios.post(
      `${OKX_BASE_API_URL}${path}`,
      JSON.stringify(body),
      {
        headers: makeHeaderAuthenticationOKX(
          "POST",
          path,
          JSON.stringify(body),
        ),
      },
    );
    return res?.data;
  } catch (error: any) {
    return {
      code: error?.code,
      data: [],
      msg: `${error?.reason} ${error?.message}`,
    };
  }
};

export const convertUSDToContractOrderSize = async ({
  type = 1,
  instId,
  sz,
  opType,
}: {
  type?: number;
  instId: string;
  sz: number;
  opType: "close" | "open";
}): Promise<string> => {
  try {
    let _sz = "";
    const maxRetries = 5;
    let attempts = 0;

    const convert = async () => {
      const _instId = `${instId.split("-")[0]}-${instId.split("-")[1]}`;
      const [{ idxPx }] = await getSymbolPriceTicker({ instId: _instId });
      const path = `/api/v5/public/convert-contract-coin?type=${type}&opType=${opType}&instId=${instId}&sz=${
        sz / Number(idxPx)
      }`;
      const res = await axios.get(`${OKX_BASE_API_URL}${path}`, {
        headers: makeHeaderAuthenticationOKX("GET", path, ""),
      });
      const [response] = res?.data?.data as IContracConvertResponse[];
      return response.sz;
    };

    while (attempts < maxRetries) {
      attempts += 1;
      try {
        _sz = await convert();
        if (_sz.length > 0) break;
      } catch (error) {
        axiosErrorDecode(error);
      }
    }

    return _sz;
  } catch (error: any) {
    axiosErrorDecode(error);
    return "0";
  }
};
export const getSymbolPriceTicker = async ({
  quoteCcy = "USDT",
  instId,
}: {
  quoteCcy?: string;
  instId: string;
}): Promise<ISymbolPriceTicker[]> => {
  try {
    const path = `/api/v5/market/index-tickers?quoteCcy=${quoteCcy}&instId=${instId}`;
    const res = await axios.get(`${OKX_BASE_API_URL}${path}`, {
      headers: makeHeaderAuthenticationOKX("GET", path, ""),
    });
    return res?.data?.data as ISymbolPriceTicker[];
  } catch (error: any) {
    axiosErrorDecode(error);
    return [];
  }
};

export const placeOrder = async ({
  instId,
  tdMode,
  side,
  posSide,
  ordType,
  szUSD,
  tpOrdPx,
  tpTriggerPx,
  slTriggerPx,
  clOrdId = "",
  tag = "",
}: {
  instId: string;
  tdMode: string;
  side: ISide;
  posSide: IPosSide;
  ordType: string;
  szUSD: number;
  tpOrdPx?: string;
  clOrdId?: string;
  tag?: string;
  tpTriggerPx?:string,
  slTriggerPx?:string,
}): Promise<OKXResponse> => {
  try {
    const sz = await convertUSDToContractOrderSize({
      instId,
      sz: szUSD,
      opType: "open",
    });
    if (!sz)
        return {
          code: "",
          msg: "Convert USD contract error",
        data: [],
      };
    const tpBody = {
      tpTriggerPx,
      tpOrdPx: -1
    }
    const slBody = {
      slTriggerPx,
      slOrdPx: -1
    }
    const body = JSON.stringify({
      instId,
      tdMode,
      side,
      posSide,
      ordType,
      sz,
      ...(tpTriggerPx ? tpBody : {}),
      ...(slTriggerPx ? slBody : {}),
      // slTriggerPx,
      // tpOrdPx: -1,
      // slOrdPx: -1
      // clOrdId,
      // tag,
    });
    console.log(body)
    const path = `/api/v5/trade/order`;
    const res = await axios.post(`${OKX_BASE_API_URL}${path}`, body, {
      headers: makeHeaderAuthenticationOKX("POST", path, body),
    });
    return res?.data;
  } catch (error: any) {
    return {
      code: error?.code,
      data: [],
      msg: axiosErrorDecode(error),
    };
  }
};

export const openFuturePosition = async ({
  instId,
  leverage,
  mgnMode,
  size,
  posSide,
  ordType = "market",
  campaignId = "",
  callbackRatio, // active trailing loss
  trailActiveAvgPx,
  tpTriggerPx,
  slTriggerPx,
}: {
  instId: string;
  mgnMode: ImgnMode;
  posSide: IPosSide;
  ordType?: string;
  leverage: number;
  size: number;
  campaignId?: string;
  callbackRatio?: string;
  trailActiveAvgPx?: string;
  tpTriggerPx?:string,
  slTriggerPx?:string,
}): Promise<{
  openPositionRes: OKXResponse;
  openAlgoOrderRes: OKXResponse;
}> => {
  const maxRetries = 3;
  let attempts = 0;
  let openPositionRes: OKXResponse = {
    code: "0",
    data: [] as any[],
    msg: "",
  };
  let openAlgoOrderRes: OKXResponse = {
    code: "0",
    data: [] as any[],
    msg: "",
  };
  const openPosition = async (): Promise<OKXResponse> => {
    try {
      const clOrdId = decodeClOrdId({
        campaignId,
        instId,
        posSide,
        leverage,
        size,
      });
      const tag = decodeTag({ campaignId, instId, posSide, leverage, size });
      const side: ISide = posSide === "long" ? "buy" : "sell";
      // await setPositionMode("long_short_mode");
      await setLeveragePair(instId, leverage, mgnMode, posSide);
      return await placeOrder({
        instId,
        tdMode: mgnMode,
        side,
        posSide,
        ordType,
        szUSD: size,
        clOrdId,
        tag,
      });
    } catch (error: any) {
      return {
        code: error?.code,
        data: [],
        msg: "Open pos: " + axiosErrorDecode(error),
      };
    }
  };
  const openTPSLOrder = async (): Promise<OKXResponse> => {
    try {
      return await openTPSLAlgoOrder({
        instId,
        size,
        posSide,
        mgnMode,
        tpTriggerPx,
        slTriggerPx
      });
    } catch (error: any) {
      return {
        code: error?.code,
        data: [],
        msg: "Trailing: " + axiosErrorDecode(error),
      };
    }
  };
  // while (attempts < maxRetries) {
  //   attempts += 1;
  //   openPositionRes = await openPosition();

  //   if (okxReponseChecker(openPositionRes)) {
  //     break;
  //   }
  // }
  // attempts = 0;

  // if (okxReponseChecker(openPositionRes)) {
  //   while (attempts < maxRetries) {
  //     attempts += 1;
  //     openAlgoOrderRes = await openTPSLOrder();
  //     if (okxReponseChecker(openAlgoOrderRes)) {
  //       break;
  //     }
  //   }
  // }
  openPositionRes = await openPosition();
  if(okxReponseChecker(openPositionRes) && (!!tpTriggerPx || !!slTriggerPx) )
    openAlgoOrderRes = await openTPSLOrder();
  return {
    openPositionRes: {
      ...openPositionRes,
      msg: okxReponseDecode(openPositionRes),
    },
    openAlgoOrderRes: {
      ...openAlgoOrderRes,
      msg: okxReponseDecode(openAlgoOrderRes),
    },
  };
};

export const closeFuturePosition = async ({
  instId,
  mgnMode,
  posSide,
  clOrdId = "",
  tag = "",
  isCloseAlgoOrders = true,
}: {
  instId: string;
  mgnMode: ImgnMode;
  posSide: IPosSide;
  clOrdId?: string;
  tag?: string;
  isCloseAlgoOrders?: boolean;
}): Promise<{
  closePositionRes: OKXResponse;
  closeAlgoOrderRes: OKXResponse;
}> => {
  const maxRetries = 2;
  let attempts = 0;
  let closePositionRes: OKXResponse = {
    code: "0",
    data: [] as any[],
    msg: "",
  };
  let closeAlgoOrderRes: OKXResponse = {
    code: "0",
    data: [] as any[],
    msg: "",
  };
  const closePosition = async (): Promise<OKXResponse> => {
    try {
      await setPositionMode("long_short_mode");
      const body = JSON.stringify({
        instId,
        mgnMode,
        posSide,
        // clOrdId,
        // tag,
      });
      const path = `/api/v5/trade/close-position`;
      const res = await axios.post(`${OKX_BASE_API_URL}${path}`, body, {
        headers: makeHeaderAuthenticationOKX("POST", path, body),
      });
      return res.data as OKXResponse;
    } catch (error: any) {
      return {
        code: error?.code,
        data: [],
        msg: axiosErrorDecode(error),
      };
    }
  };
  // const closeAlgoOrders = async (): Promise<OKXResponse> => {
  //   try {
  //     return await closeAlgoWithInstId({ instId });
  //   } catch (error: any) {
  //     return {
  //       code: error?.code,
  //       data: [],
  //       msg: axiosErrorDecode(error),
  //     };
  //   }
  // };
  
  while (attempts < maxRetries) {
    attempts += 1;
    closePositionRes = await closePosition();
    if (closePositionRes.code === "51023") {
      break;
    }
    if (okxReponseChecker(closePositionRes, false)) {
      break;
    }
  }
  // attempts = 0;
  // if (isCloseAlgoOrders) {
  //   while (attempts < maxRetries) {
  //     attempts += 1;
  //     closeAlgoOrderRes = await closeAlgoOrders();
  //     if (closeAlgoOrderRes.code === "404") {
  //       break;
  //     }
  //     if (okxReponseChecker(closeAlgoOrderRes)) {
  //       break;
  //     }
  //   }
  // }

  return {
    closePositionRes: {
      ...closePositionRes,
      msg: okxReponseDecode(closePositionRes),
    },
    closeAlgoOrderRes: {
      ...closeAlgoOrderRes,
      msg: okxReponseDecode(closeAlgoOrderRes),
    },
  };
};
