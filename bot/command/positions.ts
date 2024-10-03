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
import {getSymbolCandles} from "../helper/okx.candles";
import {calculateATR} from "../signals/atr";

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
      const CampaignConfig = campaigns.get(id);

      if (
        campaigns.has(id) &&
        CampaignConfig &&
        CampaignConfig?.tokenTradingMode
      ) {
        tokensFilter = await getTradeAbleCrypto(
          CampaignConfig?.tokenTradingMode,
        );
      }
      const positions = await getAccountPositions("SWAP", tokensFilter);
      let tradeAbleCryptoCandles: { [instId: string]: ICandles } = {};
      if(CampaignConfig) {
        await Promise.all(tokensFilter.map(async instId => {
          tradeAbleCryptoCandles[instId] = await getSymbolCandles({
            instID: instId,
            before: 0,
            bar: CampaignConfig?.bar,
            limit: 300,
          })
        }))
      }
    
      let trailingLossOrders = await getAccountPendingAlgoOrders({});
      trailingLossOrders =
        tokensFilter.length === 0
          ? trailingLossOrders
          : trailingLossOrders.filter((order) =>
              tokensFilter.includes(order.instId),
            );
      if (positions.length === 0) {
        await ctx.replyWithHTML("<code>No positions found.</code>");
        return;
      }

      // Create the report for open positions
      let positionReports =
        tokensFilter.length > 0
          ? `<b>Report for interval: </b> <code>${id}</code>\n`
          : "";
      let totalPnl = 0;
      let totalRealizedPnl = 0;
      let totalTrailingLossPnl = 0;
      let totalBet = 0;
      // Create the report for open positions
      positions.forEach((position, _) => {
        const pnlIcon = parseFloat(zerofy(position.upl)) >= 0 ? "🟢" : "🔴";
        const realizedPnl =
          parseFloat(position.realizedPnl) + parseFloat(position.upl);
        const realizedPnlIcon = realizedPnl >= 0 ? "🟢" : "🔴";
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
        let markPrice = 0, estTriggerPrice = 0
        if(!trailingLossOrder && CampaignConfig) {
            const multiple = CampaignConfig.variance
          ? Number(
              CampaignConfig.variance === "auto"
                ? [1, "auto"]
                : CampaignConfig.variance.split(",")[0]
            )
          : 0.05;
          const instCandle = tradeAbleCryptoCandles[position.instId]
          markPrice = instCandle.slice(-1)[0].c
          const currentAtr = calculateATR(instCandle, ATR_PERIOD).slice(-1)[0];
          estTriggerPrice = Number(position.avgPx) + (currentAtr?.atr * multiple)
        }
        totalPnl += parseFloat(position.upl);
        totalRealizedPnl += realizedPnl;
        totalBet += Number(position.notionalUsd) / Number(position.lever);
        if (_ > 10) return;
        const tradeLink = `https://www.okx.com/trade-swap/${position.instId.toLowerCase()}`;
        // Split the += into logical chunks for easier debugging
        let report = `[<code>${position.posSide.toUpperCase()}</code>] <b><a href="${tradeLink}">${position.instId.split("-")[0]} <code>${zerofy(position.lever)}x</code></a></b> (<code>${zerofy(position.notionalUsd)}${USDT}</code>)\n`;
        report += `• <b>Avg. E:</b> <code>${zerofy(position.avgPx)}${USDT}</code>\n`;
        report += `• <b>PnL:</b> <code>${zerofy(position.upl)}${USDT}</code> (<code>${zerofy(Number(position.uplRatio) * 100)}</code>%) • ${pnlIcon}\n`;
        report += `• <b>Real. Pnl:</b> <code>${zerofy(realizedPnl)}${USDT}</code> • ${realizedPnlIcon}\n`;
        report += trailingLossOrder
          ? `• <b>Trail:</b> <code>${zerofy(estPnlStopLoss)}${USDT}</code> (<code>${zerofy(estPnlStopLossPercent * 100)}</code>%) • ${estPnlStopLossIcon}\n`
          : (CampaignConfig ? `• <b>Trig | mark:</b> <code>${zerofy(estTriggerPrice)}</code> | <code>${zerofy(markPrice)}</code> • ${markPrice > estTriggerPrice ? "🟢" : "🔴" }\n` : '');
        positionReports += report;
      });
      let summaryReport = ``;
      summaryReport += `<code>----------POSITIONS------------</code>\n`;
      summaryReport += `<b>Est. PnL:</b> <code>${zerofy(totalPnl)}${USDT}</code> • ${totalPnl >= 0 ? "🟢" : "🔴"}\n`;
      summaryReport += `<b>Est. Realized PnL:</b> <code>${zerofy(totalRealizedPnl)}${USDT}</code> • ${totalRealizedPnl >= 0 ? "🟢" : "🔴"}\n`;
      summaryReport += `<b>Est. Trigs. loss:</b> <code>${zerofy(totalTrailingLossPnl)}${USDT}</code> • ${totalTrailingLossPnl >= 0 ? "🟣" : "🟠"}\n`;
      summaryReport += `<b>Total Bet:</b> <code>${zerofy(totalBet)}${USDT}</code> (<code>${zerofy((totalRealizedPnl / totalBet) * 100)}</code>%)\n`;

      // Send the report to the user
      await ctx.reply(positionReports + summaryReport, {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      });
    } catch (err: any) {
      await ctx.replyWithHTML(`Error: <code>${axiosErrorDecode(err)}</code>`);
    }
  });
};
