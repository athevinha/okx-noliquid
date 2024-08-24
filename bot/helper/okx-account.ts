import axios from "axios"
import {OKX_BASE_API_URL, OKX_BASE_FETCH_API_URL} from "../utils/config"
import {IAccountBalance, ICandles} from "../type"
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
/api/v5/account/positions

/api/v5/account/positions-history

/api/v5/account/account-position-risk