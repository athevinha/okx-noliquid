import { Telegraf } from "telegraf";
import { getAccountPositionsHistory } from "../helper/okx-account";
import {
  decodeTimestamp,
  decodeTimestampAgo,
  formatU,
  generateTableReport,
  generateTelegramTableReport,
  zerofy,
} from "../utils";
import { USDT } from "../utils/config";
import { writeFileSync } from "fs";

export const botReportPositionsHistory = ({ bot }: { bot: Telegraf }) => {
  bot.command("history", async (ctx) => {
    try {
      // Fetch positions history
      const positionsHistory = await getAccountPositionsHistory("SWAP");

      if (positionsHistory.length === 0) {
        await ctx.reply("No position history found.");
        return;
      }

      // Initialize counters
      let totalFee = 0;
      let totalRealizedPnl = 0;
      let totalPositions = 0;
      let totalVolume = 0;

      // Get the last 10 positions history
      const recentPositions = positionsHistory.sort(
        (a, b) => Number(b.uTime) - Number(a.uTime)
      );
      const showPositionHistory = 5;
      // Generate report for the last 10 positions
      let positionReports = "";
      recentPositions.forEach((position, index) => {
        if (index <= showPositionHistory) {
          const realizedPnlIcon =
            parseFloat(zerofy(position.realizedPnl)) >= 0 ? "🟩" : "🟥";

          const tradeLink = `https://www.okx.com/trade-swap/${position.instId.toLowerCase()}`;
          let report = ``;
          report += `<b>[${position.posSide.toUpperCase()}]</b> <b><a href="${tradeLink}">${position.instId
            .split("-")
            .slice(0, 2)
            .join("/")}</a></b> | ${decodeTimestampAgo(
            Number(position.uTime)
          )}\n`;
          report += `• <b>O/C Avg Px:</b> <code>${zerofy(
            position.openAvgPx
          )}${USDT}</code> | <code>${zerofy(
            position.closeAvgPx
          )}${USDT}</code>\n`;
          report += `• <b>Pnl:</b> <code>${zerofy(
            position.realizedPnl
          )}${USDT}</code> ( <code>${zerofy(
            position.fee
          )}${USDT}</code> ) • ${realizedPnlIcon}\n`;

          positionReports += report;
        }
        // Accumulate totals
        totalFee += parseFloat(position.fee);
        totalRealizedPnl += parseFloat(position.realizedPnl);
        totalVolume += parseFloat(position.openMaxPos);
        totalPositions++;
      });

      // Generate the summary report
      let summaryReport = ``;
      summaryReport += `<b>Total Positions:</b> <code>${totalPositions}</code>\n`;
      summaryReport += `<b>Total Volume:</b> <code>${zerofy(
        totalVolume
      )}</code>\n`;
      summaryReport += `<b>Total Fee:</b> <code>${zerofy(
        totalFee
      )}${USDT}</code>\n`;
      summaryReport += `<b>Total Realized PnL:</b> <code>${zerofy(
        totalRealizedPnl
      )}${USDT}</code> • ${totalRealizedPnl >= 0 ? "🟩" : "🟥"}\n`;
      summaryReport += `<code>-------------------------------</code>\n`;

      // Send the summary and the detailed reports
      await ctx.reply(summaryReport + positionReports, {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      });
    } catch (err: any) {
      console.error("Error fetching position history: ", err.message || err);
      await ctx.reply("Error fetching position history.");
    }
  });
};
