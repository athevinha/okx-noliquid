import axios from "axios";
import {OKX_BASE_FETCH_API_URL} from "../utils/config";
import {getRandomElementFromArray} from "../utils";
import proxys from "../../proxys.json"
import {HttpsProxyAgent} from "https-proxy-agent";
import {ICcyInfo} from "../type";
export const getCurrencyInfo = async(ccy: string): Promise<ICcyInfo | undefined> => {
    // https://okx.com/priapi/v5/rubik/public/coin-info?ccy=REN
    const proxy: any = getRandomElementFromArray(proxys);
    const proxyHost = proxy.ip;
    const proxyPort = proxy.port;
    const proxyUsername = proxy.username; // If the proxy requires authentication
    const proxyPassword = proxy.password; // If the proxy requires authentication

    const proxyURL = `http://${
      proxyUsername && proxyPassword ? `${proxyUsername}:${proxyPassword}@` : ""
    }${proxyHost}:${proxyPort}`;
    const httpsAgent = new HttpsProxyAgent(proxyURL);

    try {
        const res = await axios.get(`https://www.okx.com/v2/support/info/announce/coinDataInfo?projectName=${ccy}`, {httpsAgent})
        if(res.data.code !== 0) console.log(res.data.msg)
        return (res.data?.data as ICcyInfo);
      } catch (error:any) {
        console.log(error?.message, error?.code, error?.reason)
      }
}