import { Telegraf } from "telegraf";
import {
  getAccountHistoryAlgoOrders,
  getAccountPositionsHistory,
} from "../helper/okx.account";
import { CampaignConfig } from "../type";
import {
  axiosErrorDecode,
  decodeTimestampAgo,
  getTradeAbleCrypto,
  zerofy,
} from "../utils";
import { TOLERANCE_MS, USDT } from "../utils/config";

export const botReportPositionsHistory = ({
  bot,
  campaigns,
}: {
  bot: Telegraf;
  campaigns: Map<string, CampaignConfig>;
}) => {
  bot.command("history", async (ctx) => {
    try {
      const id = ctx.message.text.split(" ")[1];
      let tokensFilter: string[] = [];
      let after: number | undefined = undefined;
      
      // Check if campaign exists and apply filters
      const campaignConfig = campaigns.get(id);
      if (campaignConfig?.tokenTradingMode) {
        tokensFilter = await getTradeAbleCrypto(campaignConfig.tokenTradingMode);
        after = campaignConfig.startTime;
      }
      
      // Fetch positions history
      let positionsHistory = await getAccountPositionsHistory("SWAP", tokensFilter);
      if (after !== undefined) {
        positionsHistory = positionsHistory.filter(pos => Number(pos.uTime) >= Number(after));
      }

      const algoHistorys = await getAccountHistoryAlgoOrders({});
      
      // Handle empty positions
      if (positionsHistory.length === 0) {
        await ctx.replyWithHTML("ℹ️ <code>No position history found.</code>");
        return;
      }

      // Initialize summary stats
      let totalFee = 0;
      let totalRealizedPnl = 0;
      let totalPositions = 0;
      let totalVolume = 0;
      let slippageTrailingSum = 0;
      let slippageTrailingCount = 0;
      let feePercentSum = 0;

      // Sort positions by time (newest first)
      const recentPositions = positionsHistory.sort(
        (a, b) => Number(b.uTime) - Number(a.uTime)
      );
      
      const showPositionHistory = 10;
      
      // Generate header for the report
      let positionReports = tokensFilter.length > 0
        ? `🔍 <b>Position History Report</b>\n<b>Campaign:</b> <code>${id}</code>\n\n`
        : `🔍 <b>Position History Report</b>\n\n`;
      
      // Process each position
      recentPositions.forEach((position, index) => {
        const algoOrder = algoHistorys.find(
          (algo) =>
            algo.instId === position.instId &&
            Math.abs(Number(algo.uTime) - Number(position.uTime)) <= TOLERANCE_MS
        );
        
        // Calculate trailing stop loss slippage
        let trailingLossSlippage;
        if (algoOrder?.instId) {
          const moveTriggerPx = Number(algoOrder.moveTriggerPx);
          const closeAvgPx = Number(position.closeAvgPx);
          trailingLossSlippage = moveTriggerPx
            ? (closeAvgPx - moveTriggerPx) / moveTriggerPx
            : 0;
          slippageTrailingSum += trailingLossSlippage;
          slippageTrailingCount++;
        }
        
        // Calculate position metrics
        const fee = Number(position.fundingFee) + Number(position.fee);
        const realizedPnl = Number(position.realizedPnl);
        const pnlRatio = Number(position.pnlRatio);
        const size = (pnlRatio !== 0 ? realizedPnl / pnlRatio : 0) * Number(position.lever);
        const feePercent = size ? fee / size : 0;
        feePercentSum += feePercent;
        
        // Format position report (only for the first 'showPositionHistory' positions)
        if (index < showPositionHistory) {
          const realizedPnlIcon = parseFloat(zerofy(position.realizedPnl)) >= 0 ? "🟢" : "🔴";
          const slippageIcon = trailingLossSlippage || 0 >= 0 ? "🟢" : "🟡";
          const tradeLink = `https://www.okx.com/download?deeplink=okx://trading/trade?instId=${position.instId.toLowerCase()}`;
          const symbol = position.instId.split("-")[0];
          const timeAgo = decodeTimestampAgo(Number(position.uTime), true);
          const posSideIcon = position.posSide.toUpperCase() === "LONG" ? "📈" : "📉";

          // Build the position entry with better formatting
          let report = `${posSideIcon} <b><a href="${tradeLink}">${symbol} x${Number(position.lever)}</a></b> | ${timeAgo} • <code>${zerofy(size)}${USDT}</code>\n`;
          report += `├ <b>Entry/Exit:</b> <code>${zerofy(position.openAvgPx)}${USDT}</code> → <code>${zerofy(position.closeAvgPx)}${USDT}</code>\n`;
          report += `├ <b>Fee:</b> <code>${zerofy(fee)}${USDT}</code> (<code>${(feePercent * 100).toFixed(2)}%</code>)\n`;
          report += `├ <b>PnL:</b> ${realizedPnlIcon} <code>${zerofy(position.realizedPnl)}${USDT}</code> (<code>${(Number(position.pnlRatio) * 100).toFixed(2)}%</code>)\n`;
          
          if (trailingLossSlippage !== undefined) {
            report += `└ <b>Slippage:</b> ${slippageIcon} <code>${zerofy(trailingLossSlippage * 100)}%</code>\n`;
          } else {
            report += `└───────────────\n`;
          }
          
          positionReports += `${report}`;
        }
        
        // Accumulate totals
        totalFee += fee;
        totalRealizedPnl += parseFloat(position.realizedPnl);
        totalVolume += parseFloat(position.openMaxPos);
        totalPositions++;
      });
      
      // Calculate averages
      const slippageTrailingAverage = slippageTrailingCount > 0 ? slippageTrailingSum / slippageTrailingCount : 0;
      const feePercentAverage = totalPositions > 0 ? feePercentSum / totalPositions : 0;
      const totalCommission = slippageTrailingAverage + feePercentAverage;
      
      // Generate the summary section
      let summaryReport = `📊 <b>SUMMARY</b>\n`;
      summaryReport += `├ <b>Total Positions:</b> <code>${totalPositions}</code>\n`;
      summaryReport += `├ <b>Total Volume:</b> <code>${zerofy(totalVolume)}</code>\n`;
      summaryReport += `├ <b>Total PnL:</b> ${totalRealizedPnl >= 0 ? "🟢" : "🔴"} <code>${zerofy(totalRealizedPnl)}${USDT}</code>\n`;
      summaryReport += `├ <b>Total Fees:</b> <code>${zerofy(totalFee)}${USDT}</code>\n`;
      summaryReport += `├ <b>Avg Fee:</b> <code>${(feePercentAverage * 100).toFixed(2)}%</code>\n`;
      
      if (slippageTrailingCount > 0) {
        summaryReport += `├ <b>Avg Slippage:</b> <code>${zerofy(slippageTrailingAverage * 100)}%</code>\n`;
        summaryReport += `└ <b>Avg Commission:</b> <code>${zerofy(totalCommission * 100)}%</code>\n`;
      } else {
        summaryReport += `└ <b>Avg Fee:</b> <code>${(feePercentAverage * 100).toFixed(2)}%</code>\n`;
      }
      
      // Send the formatted report
      await ctx.replyWithHTML(positionReports + summaryReport, {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      });
    } catch (err: any) {
      await ctx.replyWithHTML(`❌ <b>Error:</b> <code>${axiosErrorDecode(err)}</code>`);
    }
  });
};