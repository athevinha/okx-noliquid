import {Telegraf} from "telegraf";
import {getAccountPositions} from "../helper/okx.account";
import {getTradeAbleCrypto, zerofy} from "../utils";
import {USDT} from "../utils/config";
import {IntervalConfig} from "../type";

export const botReportPositions = ({ bot, intervals }: { bot: Telegraf, intervals: Map<string, IntervalConfig>  })  => {
  bot.command("positions", async (ctx) => {
    try {
      // Fetch open positions
      const id = ctx.message.text.split(" ")[1];
      let tokensFilter:string[] = []
      const intervalConfig = intervals.get(id);

      if (intervals.has(id) && intervalConfig && intervalConfig?.tokenTradingMode) {
        tokensFilter = await getTradeAbleCrypto(intervalConfig?.tokenTradingMode)
      }
      const positions = await getAccountPositions("SWAP", tokensFilter);

      if (positions.length === 0) {
        await ctx.reply("No open positions found.");
        return;
      }

      // Create the report for open positions
      let positionReports = tokensFilter.length > 0 ? `<b>Report for interval: </b> <code>${id}</code>\n` :"" ;
      let totalPnl = 0;
      let totalRealizedPnl = 0;
      let totalBet = 0;
      // Create the report for open positions
      positions.forEach((position, _) => {
        const pnlIcon = parseFloat(zerofy(position.upl)) >= 0 ? "🟩" : "🟥";
        const realizedPnl = parseFloat(position.realizedPnl) + parseFloat(position.upl)
        const realizedPnlIcon = realizedPnl >= 0 ? "🟩" : "🟥";
        totalPnl += parseFloat(position.upl);
        totalRealizedPnl += realizedPnl;
        totalBet += (Number(position.notionalUsd) / Number(position.lever))
        if(_ > 10) return;
        const tradeLink = `https://www.okx.com/trade-swap/${position.instId.toLowerCase()}`
        // Split the += into logical chunks for easier debugging
        let report = `<b>[${position.posSide.toUpperCase()}]</b> <b><a href="${tradeLink}">${position.instId.split('-').slice(0,2).join('/')}</a></b> (<code>${zerofy(position.notionalUsd)}${USDT}</code>)\n`;
        report += `• <b>Avg Entry:</b> <code>${zerofy(position.avgPx)}${USDT}</code>\n`;
        report += `• <b>Margin Ratio:</b> <code>${zerofy(position.mgnRatio)}</code>%\n`;
        report += `• <b>Leverage:</b> <code>${zerofy(position.lever)}</code>x\n`;
        report += `• <b>PnL:</b> <code>${zerofy(Number(position.uplRatio) * 100)}</code>% (<code>${zerofy(position.upl)}${USDT}</code>) • ${pnlIcon}\n`;
        report += `• <b>Realized Pnl:</b> <code>${zerofy(realizedPnl)}${USDT}</code> • ${realizedPnlIcon}\n`;
        positionReports += report;
      });
      positionReports += `<code>-------------------------------</code>\n`;
      positionReports += `<b>Est. PnL:</b> <code>${zerofy(totalPnl)}${USDT}</code> • ${totalPnl >= 0 ? "🟩" : "🟥"}\n`;
      positionReports += `<b>Est. Realized PnL:</b> <code>${zerofy(totalRealizedPnl)}${USDT}</code> • ${totalRealizedPnl >= 0 ? "🟩" : "🟥"}\n`;
      positionReports += `<b>Est. Total Bet:</b> <code>${zerofy(totalBet)}${USDT}</code> (<code>${zerofy((totalRealizedPnl / totalBet) * 100)}%</code>)\n`;
      // Send the report to the user
      await ctx.reply(positionReports, { parse_mode: "HTML", link_preview_options:{is_disabled: true} });
    } catch (err: any) {
      console.error("Error fetching positions: ", err.message || err);
      await ctx.reply("Error fetching positions.");
    }
  });
};
