// OK-ACCESS-KEY The API Key as a String.
// OK-ACCESS-SIGN The Base64-encoded signature (see Signing Messages subsection for details).
// OK-ACCESS-TIMESTAMP The UTC timestamp of your request .e.g : 2020-12-08T09:08:57.715Z
// OK-ACCESS-PASSPHRASE The passphrase you specified when creating the APIKey.

import WebSocket from "ws";
import { IMethod } from "../type";
import { createSignature, decodeTimestamp } from "../utils";
import dotenv from "dotenv";
import crypto from "crypto"
import {OKX_BASE_WS_URL} from "../utils/config";
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

export const makeWsAuth = () => {
  const apiKey = process.env.OKX_API_KEY;
  const passphrase = process.env.OKX_PASSPHRASE;
  const secretKey = process.env.OKX_SECRET_KEY; // Assuming this is also stored as an environment variable
  const timestamp = Math.round(Date.now() / 1000).toString();
  const method = 'GET';
  const requestPath = '/users/self/verify';

  // Concatenate timestamp, method, and requestPath
  const prehashString = timestamp + method + requestPath;

  // Sign the string with HMAC SHA256 using the secretKey and encode it to Base64
  const hmac = crypto.createHmac('sha256', secretKey || '');
  const sign = hmac.update(prehashString).digest('base64');

  // Return the params with the generated sign
  const params = {
    "op": "login",
    "args": [
      {
        "apiKey": apiKey,
        "passphrase": passphrase,
        "timestamp": timestamp,
        "sign": sign
      }
    ]
  };

  return params;
};