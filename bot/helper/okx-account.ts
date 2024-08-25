import axios from "axios"
import {OKX_BASE_API_URL, OKX_BASE_FETCH_API_URL} from "../utils/config"
import {IAccountBalance, ICandles, IInstType} from "../type"
import {makeHeaderAuthenticationOKX} from "./auth"

export const getAccountBalance = async (): Promise<IAccountBalance[]> => {
    try {
        const path = '/api/v5/account/balance'
        const res = await axios.get(`${OKX_BASE_API_URL}${path}`, {
            headers: makeHeaderAuthenticationOKX('GET', path, '')
        })
        return res?.data?.data as IAccountBalance[]
    } catch (error) {
        console.log(error)
        return []
    }
}


export const getAccountPositions = async (instType: IInstType): Promise<any[]> => {
    try {
        const path = `/api/v5/account/positions?instType=${instType}`
        const res = await axios.get(`${OKX_BASE_API_URL}${path}`, {
            headers: makeHeaderAuthenticationOKX('GET', path, ''),
        })
        return res?.data?.data as any[]
    } catch (error) {
        console.log(error)
        return []
    }
}

export const getAccountPositionsHistory = async (instType: IInstType): Promise<any[]> => {
    try {
        const path = `/api/v5/account/positions-history?instType=${instType}`
        const res = await axios.get(`${OKX_BASE_API_URL}${path}`, {
            headers: makeHeaderAuthenticationOKX('GET', path, ''),
        })
        return res?.data?.data as any[]
    } catch (error) {
        console.log(error)
        return []
    }
}

export const getAccountPositionRisk = async (instType: IInstType): Promise<any[]> => {
    try {
        const path = `/api/v5/account/account-position-risk?instType=${instType}`
        const res = await axios.get(`${OKX_BASE_API_URL}${path}`, {
            headers: makeHeaderAuthenticationOKX('GET', path, ''),
        })
        return res?.data?.data as IAccountBalance[]
    } catch (error) {
        console.log(error)
        return []
    }
}

export const getAccountOrdersHistory = async (instType: IInstType): Promise<any[]> => {
    try {
        const path = `/api/v5/trade/orders-history?ordType=limit,market,mmp,post_only,optimal_limit_ioc,mmp_and_post_only&instType=${instType}`
        const res = await axios.get(`${OKX_BASE_API_URL}${path}`, {
            headers: makeHeaderAuthenticationOKX('GET', path, ''),
        })
        return res?.data?.data as IAccountBalance[]
    } catch (error) {
        console.log(error)
        return []
    }
}
export const getAccountOrders = async (instType: IInstType): Promise<any[]> => {
    try {
        const path = `/api/v5/trade/orders-pending?ordType=limit,market,mmp,post_only,optimal_limit_ioc,mmp_and_post_only&instType=${instType}`
        const res = await axios.get(`${OKX_BASE_API_URL}${path}`, {
            headers: makeHeaderAuthenticationOKX('GET', path, ''),
        })
        return res?.data?.data as IAccountBalance[]
    } catch (error) {
        console.log(error)
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
    } catch (error) {
        console.log(error)
        return []
    }
}

