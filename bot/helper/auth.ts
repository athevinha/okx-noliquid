// OK-ACCESS-KEY The API Key as a String.
// OK-ACCESS-SIGN The Base64-encoded signature (see Signing Messages subsection for details).
// OK-ACCESS-TIMESTAMP The UTC timestamp of your request .e.g : 2020-12-08T09:08:57.715Z
// OK-ACCESS-PASSPHRASE The passphrase you specified when creating the APIKey.

import WebSocket from "ws";
import { IMethod } from "../type";
import { createSignature, decodeTimestamp } from "../utils";
import dotenv from "dotenv";
dotenv.config();

export const makeHeaderAuthenticationOKX = (
  method: IMethod,
  path: string,
  body: string,
) => {
  return {
    "OK-ACCESS-KEY": process.env.OKX_API_KEY,
    "OK-ACCESS-PASSPHRASE": process.env.OKX_PASSPHRASE,
    "OK-ACCESS-TIMESTAMP": decodeTimestamp(Date.now(), 0),
    "Content-Type": "application/json",
    "x-simulated-trading": process.env.DEMO_TRADING,
    "OK-ACCESS-SIGN": createSignature(
      decodeTimestamp(Date.now(), 0),
      method,
      path,
      body,
      process.env.OKX_SECRET_KEY,
    ),
  };
};


export const wsAuth = (
  ws: WebSocket,
) => {
  return {
    "OK-ACCESS-KEY": process.env.OKX_API_KEY,
    "OK-ACCESS-PASSPHRASE": process.env.OKX_PASSPHRASE,
    "OK-ACCESS-TIMESTAMP": decodeTimestamp(Date.now(), 0),
    "Content-Type": "application/json",
    "x-simulated-trading": process.env.DEMO_TRADING,
    "OK-ACCESS-SIGN": createSignature(
      decodeTimestamp(Date.now(), 0),
      method,
      path,
      body,
      process.env.OKX_SECRET_KEY,
    ),
  };
};
