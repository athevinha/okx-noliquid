import { Telegraf } from "telegraf";
import {
  getAccountPendingAlgoOrders,
  getAccountPositions,
} from "../helper/okx.account";
import {
  axiosErrorDecode,
  estimatePnl,
  getTradeAbleCrypto,
  zerofy,
} from "../utils";
import { ATR_PERIOD, USDT } from "../utils/config";
import { CampaignConfig, ICandle, ICandles, IPosSide } from "../type";
import { getSymbolCandles } from "../helper/okx.candles";
import { calculateATR } from "../signals/atr";

export const botReportPositions = ({
  bot,
  campaigns,
}: {
  bot: Telegraf;
  campaigns: Map<string, CampaignConfig>;
}) => {
  bot.command("positions", async (ctx) => {
    try {
      // Fetch open positions
      const id = ctx.message.text.split(" ")[1];
      let tokensFilter: string[] = [];
      const campaignConfig = campaigns.get(id);

      if (
        campaigns.has(id) &&
        campaignConfig &&
        campaignConfig?.tokenTradingMode
      ) {
        tokensFilter = await getTradeAbleCrypto(
          campaignConfig?.tokenTradingMode,
        );
      }
      const positions = await getAccountPositions("SWAP", tokensFilter);
      let tradeAbleCryptoCandles: { [instId: string]: ICandles } = {};
      if (campaignConfig) {
        await Promise.all(
          tokensFilter.map(async (instId) => {
            tradeAbleCryptoCandles[instId] = await getSymbolCandles({
              instID: instId,
              before: 0,
              bar: campaignConfig?.bar,
              limit: 300,
            });
          }),
        );
      }

      let trailingLossOrders = await getAccountPendingAlgoOrders({});
      trailingLossOrders =
        tokensFilter.length === 0
          ? trailingLossOrders
          : trailingLossOrders.filter((order) =>
              tokensFilter.includes(order.instId),
            );
      if (positions.length === 0) {
        await ctx.replyWithHTML("ℹ️ <code>No positions found.</code>");
        return;
      }

      // Create the report for open positions
      let positionReports =
        tokensFilter.length > 0
          ? `🔍 <b>Active Positions Report</b>\n<b>Campaign:</b> <code>${id}</code>\n\n`
          : `🔍 <b>Active Positions Report</b>\n\n`;
      let totalPnl = 0;
      let totalRealizedPnl = 0;
      let totalTrailingLossPnl = 0;
      let totalBet = 0;
      
      // Create the report for open positions
      positions.forEach((position, index) => {
        if (index > 10) return;
        
        const realizedPnl = parseFloat(position.realizedPnl) + parseFloat(position.upl);
        const trailingLossOrder = trailingLossOrders.filter(
          (order) => order.instId === position.instId,
        )?.[0];
        
        const { estPnlStopLoss, estPnlStopLossPercent, estPnlStopLossIcon } =
          estimatePnl({
            posSide: position.posSide as IPosSide,
            sz: position.notionalUsd,
            e: position.avgPx,
            c: trailingLossOrder?.moveTriggerPx,
          });
          
        totalTrailingLossPnl += estPnlStopLoss;
        let markPrice = 0, estTriggerPrice = 0;
        
        if (!trailingLossOrder && campaignConfig) {
          const multiple = campaignConfig.variance
            ? Number(
                campaignConfig.variance === "auto"
                  ? [1, "auto"]
                  : campaignConfig.variance.split(",")[0],
              )
            : 0.05;
          const instCandle = tradeAbleCryptoCandles[position.instId];
          markPrice = instCandle.slice(-1)[0].c;
          const currentAtr = calculateATR(instCandle, ATR_PERIOD).slice(-1)[0];
          estTriggerPrice = Number(position.avgPx) + currentAtr?.atr * multiple;
        }
        
        totalPnl += parseFloat(position.upl);
        totalRealizedPnl += realizedPnl;
        totalBet += Number(position.notionalUsd) / Number(position.lever);
        
        const tradeLink = `https://www.okx.com/download?deeplink=okx://trading/trade?instId=${position.instId.toLowerCase()}`;
        const symbol = position.instId.split("-")[0];
        const posSideIcon = position.posSide.toUpperCase() === "LONG" ? "📈" : "📉";
        const pnlIcon = parseFloat(zerofy(position.upl)) >= 0 ? "🟢" : "🔴";
        const realizedPnlIcon = realizedPnl >= 0 ? "🟢" : "🔴";
        
        // Format position with consistent styling similar to history report
        let report = `${posSideIcon} <b><a href="${tradeLink}">${symbol} x${zerofy(position.lever)}</a></b> | <code>${zerofy(position.notionalUsd)}${USDT}</code>\n`;
        report += `├ <b>Entry:</b> <code>${zerofy(position.avgPx)}${USDT}</code>\n`;
        report += `├ <b>PnL:</b> ${pnlIcon} <code>${zerofy(position.upl)}${USDT}</code> (<code>${zerofy(Number(position.uplRatio) * 100)}%</code>)\n`;
        report += `├ <b>Realized PnL:</b> ${realizedPnlIcon} <code>${zerofy(realizedPnl)}${USDT}</code>\n`;
        
        if (trailingLossOrder) {
          report += `└ <b>Trail.:</b> ${estPnlStopLossIcon} <code>${zerofy(estPnlStopLoss)}${USDT}</code> (<code>${zerofy(estPnlStopLossPercent * 100)}%</code>)\n`;
        } else if (campaignConfig) {
          const triggerIcon = markPrice > estTriggerPrice ? "🟢" : "🔴";
          report += `└ <b>Trig/Mark:</b> ${triggerIcon} <code>${zerofy(estTriggerPrice)}</code> | <code>${zerofy(markPrice)}</code>\n`;
        } else {
          report += `└───────────────\n`;
        }
        
        positionReports += `${report}`;
      });
      
      // Format summary with consistent styling
      let summaryReport = `📊 <b>SUMMARY</b>\n`;
      summaryReport += `├ <b>PnL:</b> ${totalPnl >= 0 ? "🟢" : "🔴"} <code>${zerofy(totalPnl)}${USDT}</code>\n`;
      summaryReport += `├ <b>Realized PnL:</b> ${totalRealizedPnl >= 0 ? "🟢" : "🔴"} <code>${zerofy(totalRealizedPnl)}${USDT}</code>\n`;
      summaryReport += `├ <b>Est. Trail Loss:</b> ${totalTrailingLossPnl >= 0 ? "🟣" : "🟠"} <code>${zerofy(totalTrailingLossPnl)}${USDT}</code>\n`;
      summaryReport += `└ <b>Total Bet:</b> <code>${zerofy(totalBet)}${USDT}</code> (<code>${zerofy((totalRealizedPnl / totalBet) * 100)}%</code>)\n`;

      // Send the report to the user
      await ctx.replyWithHTML(positionReports + summaryReport, {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      });
    } catch (err: any) {
      await ctx.replyWithHTML(`❌ <b>Error:</b> <code>${axiosErrorDecode(err)}</code>`);
    }
  });
};