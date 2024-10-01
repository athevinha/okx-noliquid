import WebSocket from "ws";
import { OKX_BASE_WS_URL } from "../utils/config";
import { IWsCandlesReponse, IWsPositionReponse, IWsRequestParams, IWsTickerReponse } from "../type";
import { makeWsAuth } from "./auth";

export const wsCandles = ({
  path = "/ws/v5/business",
  subscribeMessage,
  messageCallBack,
  subcribedCallBack,
  closeCallBack,
  errorCallBack,
}: {
  path?: string;
  subscribeMessage: IWsRequestParams;
  messageCallBack?: (candles: IWsCandlesReponse) => void;
  subcribedCallBack?: (param: IWsRequestParams) => void;
  closeCallBack?: (code: number, reason: Buffer) => void;
  errorCallBack?: (res: Error) => void;
}): WebSocket => {
  const ws = new WebSocket(`${OKX_BASE_WS_URL}${path}`);

  ws.on("open", () => {
    ws.send(JSON.stringify(subscribeMessage));
    if (subcribedCallBack) subcribedCallBack(subscribeMessage);
  });

  ws.on("message", (message: WebSocket.MessageEvent) => {
    if (messageCallBack) {
      const response = JSON.parse(message.toString());
      if (!response?.data) return;
      response.data = response.data.map((res: any) => ({
        ts: res[0],
        o: res[1],
        h: res[2],
        l: res[3],
        c: res[4],
        confirm: res[5],
      }));
      messageCallBack(response as IWsCandlesReponse);
    }
  });

  ws.on("close", (code, reason) => {
    if (closeCallBack) closeCallBack(code, reason);
  });

  ws.on("error", (error: Error) => {
    if (errorCallBack) errorCallBack(error);
  });
  return ws;
};

export const wsTicks = ({
  path = "/ws/v5/public",
  subscribeMessage,
  messageCallBack,
  subcribedCallBack,
  closeCallBack,
  errorCallBack,
}: {
  path?: string;
  subscribeMessage: IWsRequestParams;
  messageCallBack?: (candles: IWsTickerReponse) => void;
  subcribedCallBack?: (param: IWsRequestParams) => void;
  closeCallBack?: (code: number, reason: Buffer) => void;
  errorCallBack?: (res: Error) => void;
}): WebSocket => {
  const ws = new WebSocket(`${OKX_BASE_WS_URL}${path}`);

  ws.on("open", () => {
    ws.send(JSON.stringify(subscribeMessage));
    if (subcribedCallBack) subcribedCallBack(subscribeMessage);
  });

  ws.on("message", (message: WebSocket.MessageEvent) => {
    if (messageCallBack) {
      const response = JSON.parse(message.toString());
      if (!response?.data) return;
      messageCallBack(response as IWsTickerReponse);
    }
  });

  ws.on("close", (code, reason) => {
    if (closeCallBack) closeCallBack(code, reason);
  });

  ws.on("error", (error: Error) => {
    if (errorCallBack) errorCallBack(error);
  });
  return ws;
};

export const wsPositions = ({
  path = "/ws/v5/private",
  subscribeMessage= {
    op: "subscribe",
    args: [
      {
        channel: `positions`,
        instType: 'SWAP',
      },
    ],
  },
  authCallBack,
  messageCallBack,
  subcribedCallBack,
  closeCallBack,
  errorCallBack,
}: {
  path?: string;
  subscribeMessage?: IWsRequestParams;
  authCallBack?: (authConfig: any) => void;
  messageCallBack?: (candles: IWsPositionReponse) => void;
  subcribedCallBack?: (param: IWsRequestParams) => void;
  closeCallBack?: (code: number, reason: Buffer) => void;
  errorCallBack?: (res: Error) => void;
}): WebSocket => {
  const ws = new WebSocket(`${OKX_BASE_WS_URL}${path}`);
  const wsAuth = makeWsAuth();
  ws.on("open", () => {
    ws.send(JSON.stringify(wsAuth));
    if(authCallBack) authCallBack(wsAuth)
  });

  ws.on("message", (message: Buffer) => {
    const response = JSON.parse(message.toString());
    if (
      response.event === "login" &&
      response.msg === "" &&
      response.code === "0"
    ) {
      ws.send(JSON.stringify(subscribeMessage));
      if (subcribedCallBack) subcribedCallBack(subscribeMessage);
    } else {
      if (messageCallBack) {
        const response = JSON.parse(message.toString());
        if (!response?.data) return;
        messageCallBack(response as IWsPositionReponse);
      }
    }
  });

  ws.on("close", (code, reason) => {
    if (closeCallBack) closeCallBack(code, reason);
  });

  ws.on("error", (error: Error) => {
    if (errorCallBack) errorCallBack(error);
  });
  return ws;
};




export const sendOKXWsMessage = ({ws, op, channel, instIds, callback}: {ws?: WebSocket, op: 'subscribe' | 'unsubscribe' | 'login', channel: string, instIds: string[], callback?: (e:any) => void}) => {
  if(!ws || ws?.readyState !== WebSocket.OPEN) return;
  const params =  {
    op,
    args: instIds.map(instId => ({
      channel,
      instId,
    }))
  }
  ws.send(JSON.stringify(params), callback)
}