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
import { USDT } from "../utils/config";

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
      let tokensFilter: string[] = [], after: number | undefined = undefined;
      const CampaignConfig = campaigns.get(id);

      if (
        campaigns.has(id) &&
        CampaignConfig &&
        CampaignConfig?.tokenTradingMode
      ) {
        tokensFilter = await getTradeAbleCrypto(
          CampaignConfig?.tokenTradingMode,
        );
        after = CampaignConfig.startTime
      }
      // Fetch positions history
      let positionsHistory = await getAccountPositionsHistory(
        "SWAP",
        tokensFilter,
      );
      if(after !== undefined) {
        positionsHistory = positionsHistory.filter(pos => Number(pos.uTime) >= (Number(after || 0)))
      }

      const algoHistorys = await getAccountHistoryAlgoOrders({});
      if (positionsHistory.length === 0) {
        await ctx.replyWithHTML("<code>No position history found.</code>");
        return;
      }

      // Initialize counters
      let totalFee = 0;
      let totalRealizedPnl = 0;
      let totalPositions = 0;
      let totalVolume = 0;
      let slippageTrailingAverage = 0,
        slippageTrailingCount = 0;
      let feePercentAverage = 0;

      // Get the last 10 positions history
      const recentPositions = positionsHistory.sort(
        (a, b) => Number(b.uTime) - Number(a.uTime),
      );
      console.log(recentPositions[0])
      const showPositionHistory = 10;
      // Generate report for the last 10 positions
      let positionReports =
        tokensFilter.length > 0
          ? `<b>Report for interval: </b> <code>${id}</code>\n`
          : "";
      recentPositions.forEach((position, index) => {
        const algoOrder = algoHistorys.filter(
          (algo) =>
            algo.uTime + algo.instId === position.uTime + position.instId,
        )[0];
        // console.log(position);
        let trailingLossSlippage;
        if (algoOrder?.instId) {
          // Position close by move_trail_stop orders
          const moveTriggerPx = Number(algoOrder.moveTriggerPx); // last trigger price
          const closeAvgPx = Number(position.closeAvgPx);
          trailingLossSlippage = moveTriggerPx
            ? (closeAvgPx - moveTriggerPx) / moveTriggerPx
            : 0;
          slippageTrailingAverage += trailingLossSlippage;
          slippageTrailingCount++;
        }
        const fee = Number(position.fundingFee) + Number(position.fee);
        const realizedPnl = Number(position.realizedPnl);
        const pnlRatio = Number(position.pnlRatio);
        const size =
          (pnlRatio !== 0 ? realizedPnl / pnlRatio : 0) *
          Number(position.lever);
        const feePercent = size ? fee / size : 0;
        feePercentAverage += feePercent;
        if (index < showPositionHistory) {
          const realizedPnlIcon =
            parseFloat(zerofy(position.realizedPnl)) >= 0 ? "🟢" : "🔴";
          const tradeLink = `https://www.okx.com/trade-swap/${position.instId.toLowerCase()}`;
          let report = ``;
          report += `<code>[${position.posSide.toUpperCase()}]</code> <b><a href="${tradeLink}">${
            position.instId.split("-")[0]
          } x${Number(position.lever)}</a></b> | ${decodeTimestampAgo(Number(position.uTime), true)} (<code>${zerofy(size)}${USDT}</code>)\n`;
          report += `• <b>O/C Avg Px:</b> <code>${zerofy(
            position.openAvgPx,
          )}${USDT}</code> | <code>${zerofy(
            position.closeAvgPx,
          )}${USDT}</code>\n`;

          report += `• <b>Fee:</b> <code>${zerofy(
            fee,
          )}${USDT}</code> (<code>${(feePercent * 100).toFixed(2)}%</code>)\n`;
          report += `• <b>R.Pnl:</b> <code>${zerofy(
            position.realizedPnl,
          )}${USDT}</code> (<code>${(Number(position.pnlRatio) * 100).toFixed(2)}%</code>) • ${realizedPnlIcon} \n`;
          report += trailingLossSlippage
            ? `• <b>Slippage:</b> <code>${zerofy(trailingLossSlippage * 100)}%</code>  • ${trailingLossSlippage >= 0 ? "🟢" : "🟡"}\n`
            : "";
          positionReports += report;
        }
        // Accumulate totals
        totalFee += fee;
        totalRealizedPnl += parseFloat(position.realizedPnl);
        totalVolume += parseFloat(position.openMaxPos);
        totalPositions++;
      });
      slippageTrailingAverage = slippageTrailingAverage / slippageTrailingCount;
      feePercentAverage = feePercentAverage / totalPositions;
      // Generate the summary report
      let summaryReport = ``;
      summaryReport += `<code>-----------HISTORYS------------</code>\n`;
      summaryReport += `<b>Total Positions:</b> <code>${totalPositions}</code>\n`;
      summaryReport += `<b>Total Volume:</b> <code>${zerofy(
        totalVolume,
      )}</code>\n`;
      summaryReport += `<b>Total R.PnL:</b> <code>${zerofy(
        totalRealizedPnl,
      )}${USDT}</code> • ${totalRealizedPnl >= 0 ? "🟢" : "🔴"}\n`;
      summaryReport += `<b>Total Fee:</b> <code>${zerofy(
        totalFee,
      )}${USDT}</code> (<code>${(feePercentAverage * 100).toFixed(2)}%</code>)\n`;
      summaryReport += `<b>Avg.Slippage:</b> <code>${zerofy(
        slippageTrailingAverage * 100,
      )}%</code>\n`;
      summaryReport += `<b>Avg.Commision:</b> <code>${zerofy(
        (slippageTrailingAverage + feePercentAverage) * 100,
      )}%</code>\n`;
      // Send the summary and the detailed reports
      await ctx.reply(positionReports + summaryReport, {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      });
    } catch (err: any) {
      await ctx.replyWithHTML(`Error: <code>${axiosErrorDecode(err)}</code>`);
    }
  });
};
