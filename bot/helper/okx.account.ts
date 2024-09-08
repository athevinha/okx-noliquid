import axios from "axios"
import {OKX_BASE_API_URL, OKX_BASE_FETCH_API_URL} from "../utils/config"
import {IAccountBalance, ICandles, IInstType, IOrderDetails, IPositionHistory, IPositionOpen, IPositionRisk} from "../type"
import {makeHeaderAuthenticationOKX} from "./auth"

export const getAccountBalance = async (): Promise<IAccountBalance[]> => {
    try {
        const path = '/api/v5/account/balance'
        const res = await axios.get(`${OKX_BASE_API_URL}${path}`, {
            headers: makeHeaderAuthenticationOKX('GET', path, '')
        })
        return res?.data?.data as IAccountBalance[]
    } catch (error:any) {
        console.error(error?.reason || "", error?.message || "", error.code || "")
        return []
    }
}


export const getAccountPositions = async (instType: IInstType, instIds?:string[] ): Promise<IPositionOpen[]> => {
    try {
        const path = `/api/v5/account/positions?instType=${instType}`
        const res = await axios.get(`${OKX_BASE_API_URL}${path}`, {
            headers: makeHeaderAuthenticationOKX('GET', path, ''),
        })
        if(!instIds || instIds.length === 0) return (res?.data?.data as IPositionOpen[])
        return (res?.data?.data as IPositionOpen[]).filter(r => instIds?.includes(r.instId))
    } catch (error:any) {
        console.error(error?.reason || "", error?.message || "", error.code || "")
        return []
    }
}

export const getAccountPosition = async (instType: IInstType, posId: string, ): Promise<IPositionOpen[]> => {
    try {
        const path = `/api/v5/account/positions?posId=${posId}&instType=${instType}`
        const res = await axios.get(`${OKX_BASE_API_URL}${path}`, {
            headers: makeHeaderAuthenticationOKX('GET', path, ''),
        })
        return res?.data?.data as IPositionOpen[]
    } catch (error:any) {
        console.error(error?.reason || "", error?.message || "", error.code || "")
        return []
    }
}

export const getAccountOrder = async ({instId, ordId, clOrdId}:{instId: string, ordId?: string, clOrdId?:string}): Promise<IOrderDetails[]> => {
    try {
        const path = `/api/v5/trade/order?instId=${instId}&clOrdId=${clOrdId}&ordId=${ordId}`
        const res = await axios.get(`${OKX_BASE_API_URL}${path}`, {
            headers: makeHeaderAuthenticationOKX('GET', path, ''),
        })
        return res?.data?.data as IOrderDetails[]
    } catch (error:any) {
        console.error(error?.reason || "", error?.message || "", error.code || "")
        return []
    }
}
export const getAccountPositionsHistory = async (instType: IInstType, instIds?: string[]): Promise<IPositionHistory[]> => {
    try {
        const path = `/api/v5/account/positions-history?instType=${instType}`
        const res = await axios.get(`${OKX_BASE_API_URL}${path}`, {
            headers: makeHeaderAuthenticationOKX('GET', path, ''),
        })
        if(!instIds || instIds.length === 0) return (res?.data?.data as IPositionHistory[])
        return (res?.data?.data as IPositionHistory[]).filter(r => instIds?.includes(r.instId))
    } catch (error:any) {
        console.error(error?.reason || "", error?.message || "", error.code || "")
        return []
    }
}

export const getAccountPositionRisk = async (instType: IInstType): Promise<IPositionRisk[]> => {
    try {
        const path = `/api/v5/account/account-position-risk?instType=${instType}`
        const res = await axios.get(`${OKX_BASE_API_URL}${path}`, {
            headers: makeHeaderAuthenticationOKX('GET', path, ''),
        })
        return res?.data?.data as IPositionRisk[]
    } catch (error:any) {
        console.error(error?.reason || "", error?.message || "", error.code || "")
        return []
    }
}

export const getAccountOrdersHistory = async ({ordType= 'market', instType, clOrdId, limit =100}:{ordType?: string, instType: IInstType, clOrdId?:string, limit?:number}): Promise<IOrderDetails[]> => {
    try {
        const path = `/api/v5/trade/orders-history?ordType=${ordType}&instType=${instType}&limit=${limit}`
        const res = await axios.get(`${OKX_BASE_API_URL}${path}`, {
            headers: makeHeaderAuthenticationOKX('GET', path, ''),
        })
        console.log(res.data.data.map((e:any) => e.clOrdId))
        return (res?.data?.data as IOrderDetails[]).filter(r => r.clOrdId === clOrdId)
    } catch (error:any) {
        console.error(error?.reason || "", error?.message || "", error.code || "")
        return []
    }
}

export const getAccountBillsHistory = async ({instType, clOrdId, limit =100}:{ instType: IInstType, clOrdId?:string, limit?:number}): Promise<any[]> => {
    try {
        const path = `/api/v5/account/bills&instType=${instType}&limit=${limit}`
        const res = await axios.get(`${OKX_BASE_API_URL}${path}`, {
            headers: makeHeaderAuthenticationOKX('GET', path, ''),
        })
        console.log(res.data.data.map((e:any) => e.clOrdId))
        return (res?.data?.data as any[]).filter(r => r.clOrdId === clOrdId)
    } catch (error:any) {
        console.error(error?.reason || "", error?.message || "", error.code || "")
        return []
    }
}
export const getAccountPendingOrders = async (instType: IInstType): Promise<any[]> => {
    try {
        const path = `/api/v5/trade/orders-pending`
        const res = await axios.get(`${OKX_BASE_API_URL}${path}`, {
            headers: makeHeaderAuthenticationOKX('GET', path, ''),
        })
        return res?.data?.data as IAccountBalance[]
    } catch (error:any) {
        console.error(error?.reason || "", error?.message || "", error.code || "")
        return []
    }
}

export const getAccountConfig = async (): Promise<any[]> => {
    try {
        const path = `/api/v5/account/config`
        const res = await axios.get(`${OKX_BASE_API_URL}${path}`, {
            headers: makeHeaderAuthenticationOKX('GET', path, ''),
        })
        return res?.data?.data as IAccountBalance[]
    } catch (error:any) {
        console.error(error?.reason || "", error?.message || "", error.code || "")
        return []
    }
}

