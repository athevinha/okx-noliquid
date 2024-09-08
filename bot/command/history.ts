import {Telegraf} from "telegraf";
import {getAccountPositionsHistory} from "../helper/okx.account";
import {IntervalConfig} from "../type";
import {
  axiosErrorDecode,
  decodeTimestampAgo,
  getTradeAbleCrypto,
  zerofy
} from "../utils";
import {USDT} from "../utils/config";

export const botReportPositionsHistory = ({ bot, intervals }: { bot: Telegraf, intervals: Map<string, IntervalConfig>  })  => {
  bot.command("history", async (ctx) => {
    try {
      const id = ctx.message.text.split(" ")[1];
      let tokensFilter:string[] = []
      const intervalConfig = intervals.get(id);

      if (intervals.has(id) && intervalConfig && intervalConfig?.tokenTradingMode) {
        tokensFilter = await getTradeAbleCrypto(intervalConfig?.tokenTradingMode)
      }

      // Fetch positions history
      const positionsHistory = await getAccountPositionsHistory("SWAP", tokensFilter);

      if (positionsHistory.length === 0) {
        await ctx.replyWithHTML("<code>No position history found.</code>");
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
      let positionReports = tokensFilter.length > 0 ? `<b>Report for interval: </b> <code>${id}</code>\n` :"" ;
      recentPositions.forEach((position, index) => {
        if (index <= showPositionHistory) {
          const realizedPnlIcon =
            parseFloat(zerofy(position.realizedPnl)) >= 0 ? "🟢" : "🔴";

          const tradeLink = `https://www.okx.com/trade-swap/${position.instId.toLowerCase()}`;
          let report = ``;
          report += `<code>[${position.posSide.toUpperCase()}]</code> <b><a href="${tradeLink}">${position.instId
            .split("-")[0]}</a></b> | ${decodeTimestampAgo(
            Number(position.uTime), true
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
      summaryReport += `<code>-----------HISTORYS------------</code>\n`;
      summaryReport += `<b>Total Positions:</b> <code>${totalPositions}</code>\n`;
      summaryReport += `<b>Total Volume:</b> <code>${zerofy(
        totalVolume
      )}</code>\n`;
      summaryReport += `<b>Total Fee:</b> <code>${zerofy(
        totalFee
      )}${USDT}</code>\n`;
      summaryReport += `<b>Total Realized PnL:</b> <code>${zerofy(
        totalRealizedPnl
      )}${USDT}</code> • ${totalRealizedPnl >= 0 ? "🟢" : "🔴"}\n`;

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
