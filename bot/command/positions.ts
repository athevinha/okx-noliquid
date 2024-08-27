import { Telegraf } from "telegraf";
import { getAccountPositions } from "../helper/okx-account";
import { zerofy } from "../utils";
import {USDT} from "../utils/config";

export const botReportPositions = ({ bot }: { bot: Telegraf }) => {
  bot.command("positions", async (ctx) => {
    try {
      // Fetch open positions
      const positions = await getAccountPositions("SWAP");

      if (positions.length === 0) {
        await ctx.reply("No open positions found.");
        return;
      }

      // Create the report for open positions
      let positionReports = "";
      let totalPnl = 0;
      let totalRealizedPnl = 0;
      // Create the report for open positions
      positions.forEach(position => {
        const pnlIcon = parseFloat(zerofy(position.upl)) >= 0 ? "🟩" : "🟥";
        const realizedPnl = parseFloat(position.realizedPnl) + parseFloat(position.upl)
        const realizedPnlIcon = realizedPnl >= 0 ? "🟩" : "🟥";
        const tradeLink = `https://www.okx.com/trade-swap/${position.instId.toLowerCase()}`
        // Split the += into logical chunks for easier debugging
        let report = `<b>[${position.posSide.toUpperCase()}]</b> <b><a href="${tradeLink}">${position.instId.split('-').slice(0,2).join('/')}</a></b> (<code>${zerofy(position.notionalUsd)}${USDT}</code>)\n`;
        report += `• <b>Avg Entry:</b> <code>${zerofy(position.avgPx)}${USDT}</code>\n`;
        report += `• <b>Margin Ratio:</b> <code>${zerofy(position.mgnRatio)}</code>%\n`;
        report += `• <b>Leverage:</b> <code>${zerofy(position.lever)}</code>x\n`;
        report += `• <b>PnL:</b> <code>${zerofy(Number(position.uplRatio) * 100)}</code>% (<code>${zerofy(position.upl)}${USDT}</code>) • ${pnlIcon}\n`;
        report += `• <b>Realized Pnl:</b> <code>${zerofy(realizedPnl)}${USDT}</code> • ${realizedPnlIcon}\n`;
        positionReports += report;
        totalPnl += parseFloat(position.upl);
        totalRealizedPnl += realizedPnl;
      });
      positionReports += `<code>-------------------------------</code>\n`;
      positionReports += `<b>Est. PnL:</b> <code>${zerofy(totalPnl)}${USDT}</code> • ${totalPnl >= 0 ? "🟩" : "🟥"}\n`;
      positionReports += `<b>Est. Realized PnL:</b> <code>${zerofy(totalRealizedPnl)}${USDT}</code> • ${totalRealizedPnl >= 0 ? "🟩" : "🟥"}\n`;
  
      // Send the report to the user
      await ctx.reply(positionReports, { parse_mode: "HTML", link_preview_options:{is_disabled: true} });
    } catch (err: any) {
      console.error("Error fetching positions: ", err.message || err);
      await ctx.reply("Error fetching positions.");
    }
  });
};
