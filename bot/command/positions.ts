import {Telegraf} from "telegraf";
import {getAccountPendingAlgoOrders, getAccountPositions} from "../helper/okx.account";
import {axiosErrorDecode, estimatePnl, getTradeAbleCrypto, zerofy} from "../utils";
import {USDT} from "../utils/config";
import {IntervalConfig, IPosSide} from "../type";

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
      let trailingLossOrders = (await getAccountPendingAlgoOrders({}));
      trailingLossOrders = tokensFilter.length === 0 ? trailingLossOrders : trailingLossOrders.filter((order => tokensFilter.includes(order.instId)))
      if (positions.length === 0) {
        await ctx.replyWithHTML("<code>No positions found.</code>");
        return;
      }

      // Create the report for open positions
      let positionReports = tokensFilter.length > 0 ? `<b>Report for interval: </b> <code>${id}</code>\n` :"" ;
      let totalPnl = 0;
      let totalRealizedPnl = 0;
      let totalTrailingLossPnl = 0;
      let totalBet = 0;
      // Create the report for open positions
      positions.forEach((position, _) => {
        const pnlIcon = parseFloat(zerofy(position.upl)) >= 0 ? "🟩" : "🟥";
        const realizedPnl = parseFloat(position.realizedPnl) + parseFloat(position.upl)
        const realizedPnlIcon = realizedPnl >= 0 ? "🟩" : "🟥";
        const trailingLossOrder = trailingLossOrders.filter(order => order.instId === position.instId)?.[0]
        const {estPnlStopLoss, estPnlStopLossPercent, estPnlStopLossIcon} = estimatePnl({posSide: position.posSide as IPosSide, sz: position.notionalUsd, e: position.avgPx, c: trailingLossOrder.moveTriggerPx })
        totalTrailingLossPnl += estPnlStopLoss
        totalPnl += parseFloat(position.upl);
        totalRealizedPnl += realizedPnl;
        totalBet += (Number(position.notionalUsd) / Number(position.lever))
        if(_ > 10) return;
        const tradeLink = `https://www.okx.com/trade-swap/${position.instId.toLowerCase()}`
        // Split the += into logical chunks for easier debugging
        let report = `[<code>${position.posSide.toUpperCase()}</code>] <b><a href="${tradeLink}">${position.instId.split('-')[0]} <code>${zerofy(position.lever)}x</code></a></b> (<code>${zerofy(position.notionalUsd)}${USDT}</code>)\n`;
        report += `• <b>Avg. E:</b> <code>${zerofy(position.avgPx)}${USDT}</code>\n`;
        report += `• <b>PnL:</b> <code>${zerofy(position.upl)}${USDT}</code> (<code>${zerofy(Number(position.uplRatio) * 100)}</code>%) • ${pnlIcon}\n`;
        report += `• <b>Real. Pnl:</b> <code>${zerofy(realizedPnl)}${USDT}</code> • ${realizedPnlIcon}\n`;
        report += trailingLossOrder ? `• <b>Trail. S/L:</b> <code>${zerofy(estPnlStopLoss)}${USDT}</code> (<code>${zerofy(estPnlStopLossPercent * 100)}</code>%) • ${estPnlStopLossIcon}\n` : '';
        positionReports += report;
      });
      let summaryReport = ``;
      summaryReport += `<b>Est. PnL:</b> <code>${zerofy(totalPnl)}${USDT}</code> • ${totalPnl >= 0 ? "🟩" : "🟥"}\n`;
      summaryReport += `<b>Est. Realized PnL:</b> <code>${zerofy(totalRealizedPnl)}${USDT}</code> • ${totalRealizedPnl >= 0 ? "🟩" : "🟥"}\n`;
      summaryReport += `<b>Est. Trigs. loss:</b> <code>${zerofy(totalTrailingLossPnl)}${USDT}</code> • ${totalTrailingLossPnl >= 0 ? "🟪" : "🟧"}\n`;
      summaryReport += `<b>Total Bet:</b> <code>${zerofy(totalBet)}${USDT}</code> (<code>${zerofy((totalRealizedPnl / totalBet) * 100)}</code>%)\n`;
      summaryReport += `<code>----------POSITIONS------------</code>\n`;
      
      // Send the report to the user
      await ctx.reply(summaryReport + positionReports, { parse_mode: "HTML", link_preview_options:{is_disabled: true} });
    } catch (err: any) {
      await ctx.replyWithHTML(`Error: <code>${axiosErrorDecode(err)}</code>`);
    }
  });
};
