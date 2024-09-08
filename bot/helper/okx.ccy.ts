import axios from "axios";
import {ICcyInfo} from "../type";
import {getRandomeHttpAgent} from "../utils";
export const getCurrencyInfo = async(ccy: string): Promise<ICcyInfo | undefined> => {
    const httpsAgent = getRandomeHttpAgent()
    try {
        const res = await axios.get(`https://www.okx.com/v2/support/info/announce/coinDataInfo?projectName=${ccy}`, {httpsAgent})
        if(res.data.code !== 0) console.log(res.data.msg)
        return (res.data?.data as ICcyInfo);
      } catch (error:any) {
        console.log(error?.message, error?.code, error?.reason)
      }
}