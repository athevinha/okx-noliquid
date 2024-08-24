export type ICandles = Array<{
    ts: number
    o: number
    h: number
    l: number
    c: number
    vol: number
    volCcy: number
    volCcyQuote: number
    confirm: number
}>
  
export type ICandlesEMACrossovers = Array<{
    ts: number
    o: number
    h: number
    l: number
    c: number
    vol: number
    volCcy: number
    volCcyQuote: number
    confirm: number,
    type: 'bullish' | 'bearish',
    shortEMA: number,
    longEMA: number
}>

export type IMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

export type IAccountBalance = {
    adjEq: string
    borrowFroz: string
    details: Array<{
      accAvgPx: string
      availBal: string
      availEq: string
      borrowFroz: string
      cashBal: string
      ccy: string
      clSpotInUseAmt: string
      crossLiab: string
      disEq: string
      eq: string
      eqUsd: string
      fixedBal: string
      frozenBal: string
      imr: string
      interest: string
      isoEq: string
      isoLiab: string
      isoUpl: string
      liab: string
      maxLoan: string
      maxSpotInUse: string
      mgnRatio: string
      mmr: string
      notionalLever: string
      openAvgPx: string
      ordFrozen: string
      rewardBal: string
      smtSyncEq: string
      spotBal: string
      spotInUseAmt: string
      spotIsoBal: string
      spotUpl: string
      spotUplRatio: string
      stgyEq: string
      totalPnl: string
      totalPnlRatio: string
      twap: string
      uTime: string
      upl: string
      uplLiab: string
    }>
    imr: string
    isoEq: string
    mgnRatio: string
    mmr: string
    notionalUsd: string
    ordFroz: string
    totalEq: string
    uTime: string
    upl: string
  }
  