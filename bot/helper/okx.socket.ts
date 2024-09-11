import WebSocket from "ws";
import { OKX_BASE_WS_URL } from "../utils/config";
import { IWsCandlesReponse, IWsRequestParams } from "../type";

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
