import { decodeSymbol, decodeTimestamp, decodeTimestampAgo } from ".";
import { CampaignConfig } from "../type";

export const formatReportInterval = (
  id: string,
  config: CampaignConfig,
  isStart: boolean,
  tradeAbleCrypto?: string[],
) => {
  const currencies: string[] =
    (tradeAbleCrypto
      ? tradeAbleCrypto.map((token) => decodeSymbol(token))
      : config.tokenTradingMode
          ?.split("/")
          .map((token) => decodeSymbol(token))) || [];
  let report = isStart
    ? `<b>Start Trading ID:</b> <code>${id}</code>\n`
    : `<b>Trading ID:</b> <code>${id}</code>\n`;

  report += `• <b>Bar:</b> <code>${config.bar}</code>\n`;
  report += `• <b>Leve:</b> <code>${config.leve}</code>\n`;
  report += `• <b>Mgn mode:</b> <code>${config.mgnMode}</code>\n`;
  if (config.sz) report += `• <b>Size:</b> <code>${config.sz}</code>\n`;
  if (config.equityPercent)
    report += `• <b>Equity Percent:</b> <code>${config.equityPercent}%</code>\n`;
  report += `• <b>Variance:</b> <code>${config.variance ? `${!config.variance.includes("auto") ? Number(config.variance) * 100 + "%" : config.variance}` : "N/A"}</code>\n`;
  report += `• <b>Trade direction:</b> <code>${config.tradeDirection}</code>\n`;
  report += `• <b>Slope:</b> <code>${config.slopeThresholdUp || "N/A"}</code> | <code>${config.slopeThresholdUnder || "N/A"}</code>\n`;
  report += `• <b>Ccys:</b> <code>${currencies.length}</code> (${currencies.slice(0, 15).map((ccy) => ` <code>${ccy}</code> `)}) \n`;
  report += `• <b>Start time:</b> <code>${decodeTimestamp(config.startTime)}</code> (<code>${decodeTimestampAgo(config.startTime )}</code>)`;

  return report;
};
