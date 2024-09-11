import { Telegraf } from "telegraf";
import { getAccountPositionsHistory } from "../helper/okx.account";
import {
  axiosErrorDecode,
  generateTelegramTableReport,
  getTradeAbleCrypto,
  zerofy,
} from "../utils";
import { CampaignConfig } from "../type";
import { USDT } from "../utils/config";

export const botReportSymbolReport = ({
  bot,
  intervals,
}: {
  bot: Telegraf;
  intervals: Map<string, CampaignConfig>;
}) => {
  bot.command("symbols", async (ctx) => {
    try {
      const id = ctx.message.text.split(" ")[1];
      let tokensFilter: string[] = [];
      const CampaignConfig = intervals.get(id);

      if (
        intervals.has(id) &&
        CampaignConfig &&
        CampaignConfig?.tokenTradingMode
      ) {
        tokensFilter = await getTradeAbleCrypto(
          CampaignConfig?.tokenTradingMode,
        );
      }

      // Fetch positions history
      const positionsHistory = await getAccountPositionsHistory(
        "SWAP",
        tokensFilter,
      );

      if (positionsHistory.length === 0) {
        await ctx.replyWithHTML("<code>No symbols found.</code>");
        return;
      }
      const symbolPnLMap: Record<string, number> = {};

      positionsHistory.forEach((position) => {
        const symbol = position.instId.split("-")[0];
        const pnl = parseFloat(zerofy(position.realizedPnl));
        if (!symbolPnLMap[symbol]) {
          symbolPnLMap[symbol] = 0;
        }
        symbolPnLMap[symbol] += pnl;
      });
      // ========================================

      const tableData = Object.entries(symbolPnLMap)
        .map(([symbol, pnl]) => ({
          Ccy: symbol,
          PnL: `${zerofy(pnl)}${USDT}`,
          Ic: pnl >= 0 ? "🟢" : "🔴",
          PnLValue: pnl,
        }))
        .slice(0, 50);

      const sortedTableData = tableData.sort((a, b) => b.PnLValue - a.PnLValue);
      const tableHeaders = ["Ccy", "PnL", "Ic"];
      const fullReport = generateTelegramTableReport(
        sortedTableData,
        tableHeaders,
      );
      if (tokensFilter.length > 0) {
        await ctx.reply(`<b>Report for interval: </b> <code>${id}</code>\n`, {
          parse_mode: "HTML",
        });
      }
      await ctx.reply(fullReport, {
        parse_mode: "HTML",
      });
    } catch (err: any) {
      console.log(axiosErrorDecode(err));
      await ctx.replyWithHTML(`Error: <code>${axiosErrorDecode(err)}</code>`);
    }
  });
};
