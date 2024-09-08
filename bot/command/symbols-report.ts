import {Telegraf} from "telegraf";
import {getAccountPositionsHistory} from "../helper/okx.account";
import {
    generateTelegramTableReport,
    getTradeAbleCrypto,
    zerofy
} from "../utils";
import {IntervalConfig} from "../type";

export const botReportSymbolReport= ({ bot, intervals }: { bot: Telegraf, intervals: Map<string, IntervalConfig>  })  => {

  bot.command("symbols", async (ctx) => {
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
        await ctx.reply("No position history found.");
        return;
      }
      const symbolPnLMap: Record<string, number> = {};

      positionsHistory.forEach((position) => {
        const symbol = position.instId.split("-").slice(0, 2).join("/");
        const pnl = parseFloat(zerofy(position.realizedPnl));
        if (!symbolPnLMap[symbol]) {
          symbolPnLMap[symbol] = 0;
        }
        symbolPnLMap[symbol] += pnl;
      });
      // ========================================

      const tableData = Object.entries(symbolPnLMap)
        .map(([symbol, pnl]) => ({
          Symbol: symbol,
          "Realized PnL": `${zerofy(pnl)} USD`,
          Icon: pnl >= 0 ? "🟩" : "🟥",
          PnLValue: pnl,
        }))
        .slice(0, 50);

      const sortedTableData = tableData.sort((a, b) => b.PnLValue - a.PnLValue);
      const tableHeaders = ["Symbol", "Realized PnL", "Icon"];
      const fullReport = generateTelegramTableReport(
        sortedTableData,
        tableHeaders
      );
      if (tokensFilter.length  > 0) {
        await ctx.reply(`<b>Report for interval: </b> <code>${id}</code>\n`, {
          parse_mode: "HTML",
        });
      }
      await ctx.reply(fullReport, {
        parse_mode: "HTML",
      });
    } catch (err: any) {
      console.error("Error fetching symbol rank: ", err.message || err);
      await ctx.reply("Error fetching symbol rank: ", err.message || err);
    }
  });
};
