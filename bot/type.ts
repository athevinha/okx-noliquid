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
export type IInstType = 'MARGIN' | 'SWAP' | 'FUTURES'|'OPTION' | 'SPOT'

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

export type IPositionOpen = {
    adl: string
    availPos: string
    avgPx: string
    cTime: string
    ccy: string
    deltaBS: string
    deltaPA: string
    gammaBS: string
    gammaPA: string
    imr: string
    instId: string
    instType: string
    interest: string
    idxPx: string
    usdPx: string
    bePx: string
    last: string
    lever: string
    liab: string
    liabCcy: string
    liqPx: string
    markPx: string
    margin: string
    mgnMode: string
    mgnRatio: string
    mmr: string
    notionalUsd: string
    optVal: string
    pendingCloseOrdLiabVal: string
    pTime: string
    pos: string
    baseBorrowed: string
    baseInterest: string
    quoteBorrowed: string
    quoteInterest: string
    posCcy: string
    posId: string
    posSide: string
    spotInUseAmt: string
    spotInUseCcy: string
    clSpotInUseAmt: string
    maxSpotInUseAmt: string
    bizRefId: string
    bizRefType: string
    thetaBS: string
    thetaPA: string
    tradeId: string
    uTime: string
    upl: string
    uplLastPx: string
    uplRatio: string
    uplRatioLastPx: string
    vegaBS: string
    vegaPA: string
    realizedPnl: string
    pnl: string
    fee: string
    fundingFee: string
    liqPenalty: string
    closeOrderAlgo: Array<{
      algoId: string
      slTriggerPx: string
      slTriggerPxType: string
      tpTriggerPx: string
      tpTriggerPxType: string
      closeFraction: string
    }>
  }
  
  export type IPositionHistory = {
    cTime: string
    ccy: string
    closeAvgPx: string
    closeTotalPos: string
    instId: string
    instType: string
    lever: string
    mgnMode: string
    openAvgPx: string
    openMaxPos: string
    realizedPnl: string
    fee: string
    fundingFee: string
    liqPenalty: string
    pnl: string
    pnlRatio: string
    posId: string
    posSide: string
    direction: string
    triggerPx: string
    type: string
    uTime: string
    uly: string
  }
  
  
  export type IPositionRisk = {
    adjEq: string
    balData: Array<{
      ccy: string
      disEq: string
      eq: string
    }>
    posData: Array<{
      baseBal: string
      ccy: string
      instId: string
      instType: string
      mgnMode: string
      notionalCcy: string
      notionalUsd: string
      pos: string
      posCcy: string
      posId: string
      posSide: string
      quoteBal: string
    }>
    ts: string
  }
  
  export type OKXResponse = {
    code: string,
    data: any[],
    msg: string
  }

  export type IContracConvertResponse = {
    instId: string
    px: string,
    sz:string,
    type: string,
    unit: string
  }

  export type ISymbolPriceTicker = {
    instId:string,
    idxPx:string,
    high24h: string,
    sodUtc0: string,
    open24h: string,
    low24h: string,
    sodUtc8: string,
    ts: number
  }

export type IInstrumentsData = {
  alias: string
  baseCcy: string
  category: string
  ctMult: string
  ctType: string
  ctVal: string
  ctValCcy: string
  expTime: string
  instFamily: string
  instId: string
  instType: string
  lever: string
  listTime: string
  lotSz: string
  maxIcebergSz: string
  maxLmtAmt: string
  maxLmtSz: string
  maxMktAmt: string
  maxMktSz: string
  maxStopSz: string
  maxTriggerSz: string
  maxTwapSz: string
  minSz: string
  optType: string
  quoteCcy: string
  settleCcy: string
  state: string
  ruleType: string
  stk: string
  tickSz: string
  uly: string
}
export type ICcyInfo = {
  dayChangePercentage: string
  dayHigh: number
  dayLow: number
  exchangeVol: number
  flowTotal: string
  fullyDilutedMC: string
  fullyDilutedValuation: string
  highPriceDate: number
  high_price: number
  historyLowPrice: number
  historyLowPriceTime: number
  holdTime: number
  issuePrice: number
  issueTime: number
  last: number
  marketCap: number
  marketCapRank: string
  maxFlowTotal: string
  name: string
  sevenDayChangePercentage: string
  vol: number
}
  export type IPosSide = "long" | "short"
  export type ISide = "buy" | 'sell'
  export type ImgnMode = "isolated" | "cross"
