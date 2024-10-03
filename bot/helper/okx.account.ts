import axios from "axios";
import {
  IAccountBalance,
  IInstType,
  IOrderDetails,
  IPendingAlgoOrder,
  IPositionHistory,
  IPositionOpen,
  IPositionRisk,
} from "../type";
import { axiosErrorDecode } from "../utils";
import { DEFAULT_BOT_CONFIG, OKX_BASE_API_URL } from "../utils/config";
import { makeHeaderAuthenticationOKX } from "./auth";

export const getAccountBalance = async (
  maxRetries: number = 3, // default retry count
  retryDelay: number = 1000 // delay between retries in ms
): Promise<IAccountBalance[]> => {
  let attempts = 0;

  while (attempts < maxRetries) {
    try {
      const path = "/api/v5/account/balance";
      const res = await axios.get(`${OKX_BASE_API_URL}${path}`, {
        headers: makeHeaderAuthenticationOKX("GET", path, ""),
      });

      return res?.data?.data as IAccountBalance[];

    } catch (error: any) {
      axiosErrorDecode(error, false);

      attempts += 1;
      if (attempts >= maxRetries) {
        return [];
      }

      console.log(`[BALANCE] Retrying fetch... Attempt ${attempts}/${maxRetries}`);
      await new Promise((resolve) => setTimeout(resolve, retryDelay)); // delay before retrying
    }
  }

  return [];
};
export const getUSDTBalance = async (equityPercent:number = 100) => {
  const [balances] = await getAccountBalance()
  const usdtBal = balances.details.filter(bal => bal.ccy === 'USDT')[0]?.availBal
  return Number(usdtBal) * (equityPercent / 100)
}

export const getAccountPositions = async (
  instType: IInstType,
  instIds?: string[],
  maxRetries: number = 3, // default retry count
  retryDelay: number = 1000 // delay between retries in ms
): Promise<IPositionOpen[]> => {
  let attempts = 0;

  while (attempts < maxRetries) {
    try {
      const path = `/api/v5/account/positions?instType=${instType}`;
      const res = await axios.get(`${OKX_BASE_API_URL}${path}`, {
        headers: makeHeaderAuthenticationOKX("GET", path, ""),
      });

      if (!instIds || instIds.length === 0)
        return res?.data?.data as IPositionOpen[];

      return (res?.data?.data as IPositionOpen[]).filter((r) =>
        instIds?.includes(r.instId),
      );
      
    } catch (error: any) {
      axiosErrorDecode(error,false);

      attempts += 1;
      if (attempts >= maxRetries) {
        return [];
      }

      console.log(`[POSITION] Retrying fetch... Attempt ${attempts}/${maxRetries}`);
      await new Promise((resolve) => setTimeout(resolve, retryDelay)); // delay before retrying
    }
  }

  return [];
};

export const getAccountPosition = async (
  instType: IInstType,
  posId: string,
): Promise<IPositionOpen[]> => {
  try {
    const path = `/api/v5/account/positions?posId=${posId}&instType=${instType}`;
    const res = await axios.get(`${OKX_BASE_API_URL}${path}`, {
      headers: makeHeaderAuthenticationOKX("GET", path, ""),
    });
    return res?.data?.data as IPositionOpen[];
  } catch (error: any) {
    axiosErrorDecode(error);
    return [];
  }
};

export const getAccountOrder = async ({
  instId,
  ordId,
  clOrdId,
}: {
  instId: string;
  ordId?: string;
  clOrdId?: string;
}): Promise<IOrderDetails[]> => {
  try {
    const path = `/api/v5/trade/order?clOrdId=${clOrdId}${
      instId ? `&instId=${instId}` : ""
    }&ordId=${ordId}`;
    const res = await axios.get(`${OKX_BASE_API_URL}${path}`, {
      headers: makeHeaderAuthenticationOKX("GET", path, ""),
    });
    return res?.data?.data as IOrderDetails[];
  } catch (error: any) {
    axiosErrorDecode(error);
    return [];
  }
};
export const getAccountPositionsHistory = async (
  instType: IInstType,
  instIds?: string[],
): Promise<IPositionHistory[]> => {
  try {
    const path = `/api/v5/account/positions-history?instType=${instType}`;
    const res = await axios.get(`${OKX_BASE_API_URL}${path}`, {
      headers: makeHeaderAuthenticationOKX("GET", path, ""),
    });
    if (!instIds || instIds.length === 0)
      return res?.data?.data as IPositionHistory[];
    return (res?.data?.data as IPositionHistory[]).filter((r) =>
      instIds?.includes(r.instId),
    );
  } catch (error: any) {
    axiosErrorDecode(error);
    return [];
  }
};

export const getAccountPositionRisk = async (
  instType: IInstType,
): Promise<IPositionRisk[]> => {
  try {
    const path = `/api/v5/account/account-position-risk?instType=${instType}`;
    const res = await axios.get(`${OKX_BASE_API_URL}${path}`, {
      headers: makeHeaderAuthenticationOKX("GET", path, ""),
    });
    return res?.data?.data as IPositionRisk[];
  } catch (error: any) {
    axiosErrorDecode(error);
    return [];
  }
};

export const getAccountOrdersHistory = async ({
  ordType = "market",
  instType,
  clOrdId,
  limit = 100,
}: {
  ordType?: string;
  instType: IInstType;
  clOrdId?: string;
  limit?: number;
}): Promise<IOrderDetails[]> => {
  try {
    const path = `/api/v5/trade/orders-history?ordType=${ordType}&instType=${instType}&limit=${limit}`;
    const res = await axios.get(`${OKX_BASE_API_URL}${path}`, {
      headers: makeHeaderAuthenticationOKX("GET", path, ""),
    });
    console.log(res.data.data.map((e: any) => e.clOrdId));
    return (res?.data?.data as IOrderDetails[]).filter(
      (r) => r.clOrdId === clOrdId,
    );
  } catch (error: any) {
    axiosErrorDecode(error);
    return [];
  }
};

export const getAccountBillsHistory = async ({
  instType,
  clOrdId,
  limit = 100,
}: {
  instType: IInstType;
  clOrdId?: string;
  limit?: number;
}): Promise<any[]> => {
  try {
    const path = `/api/v5/account/bills&instType=${instType}&limit=${limit}`;
    const res = await axios.get(`${OKX_BASE_API_URL}${path}`, {
      headers: makeHeaderAuthenticationOKX("GET", path, ""),
    });
    console.log(res.data.data.map((e: any) => e.clOrdId));
    return (res?.data?.data as any[]).filter((r) => r.clOrdId === clOrdId);
  } catch (error: any) {
    axiosErrorDecode(error);
    return [];
  }
};
export const getAccountPendingOrders = async (): Promise<any[]> => {
  try {
    const path = `/api/v5/trade/orders-pending`;
    const res = await axios.get(`${OKX_BASE_API_URL}${path}`, {
      headers: makeHeaderAuthenticationOKX("GET", path, ""),
    });
    return res?.data?.data as IAccountBalance[];
  } catch (error: any) {
    axiosErrorDecode(error);
    return [];
  }
};

export const getAccountPendingAlgoOrders = async ({
  ordType = "move_order_stop",
  limit = 100,
  instId,
  maxRetries = 3, // default retry count
  retryDelay = 1000 // delay between retries in ms
}: {
  ordType?: string;
  limit?: number;
  instId?: string;
  maxRetries?: number; // optional parameter for retries
  retryDelay?: number; // optional delay between retries
}): Promise<IPendingAlgoOrder[]> => {
  let attempts = 0;

  while (attempts < maxRetries) {
    try {
      const path = `/api/v5/trade/orders-algo-pending?ordType=${ordType}&limit=${limit}${
        instId ? `&instId=${instId}` : ""
      }`;
      const res = await axios.get(`${OKX_BASE_API_URL}${path}`, {
        headers: makeHeaderAuthenticationOKX("GET", path, ""),
      });

      return res?.data?.data as IPendingAlgoOrder[];

    } catch (error: any) {
      axiosErrorDecode(error, false);

      attempts += 1;
      if (attempts >= maxRetries) {
        return [];
      }

      console.log(`[ALGO ORDERS] Retrying fetch... Attempt ${attempts}/${maxRetries}`);
      await new Promise((resolve) => setTimeout(resolve, retryDelay)); // delay before retrying
    }
  }

  return [];
};


export const getAccountConfig = async (): Promise<any[]> => {
  try {
    const path = `/api/v5/account/config`;
    const res = await axios.get(`${OKX_BASE_API_URL}${path}`, {
      headers: makeHeaderAuthenticationOKX("GET", path, ""),
    });
    return res?.data?.data as IAccountBalance[];
  } catch (error: any) {
    axiosErrorDecode(error);
    return [];
  }
};
