import {IntervalConfig} from "../type";

  export const formatReportInterval = (id: string, config: IntervalConfig, isStart: boolean) => {
    let report = isStart
      ? `<b>Start Trading ID:</b> <code>${id}</code>\n`
      : `<b>Trading ID:</b> <code>${id}</code>\n`;
  
    report += `• <b>Bar:</b> <code>${config.bar}</code>\n`;
    report += `• <b>Leve:</b> <code>${config.leve}</code>\n`;
    report += `• <b>Mgn mode:</b> <code>${config.mgnMode}</code>\n`;
    report += `• <b>Size:</b> <code>${config.sz}</code>\n`;
    report += `• <b>Delay:</b> <code>${config.intervalDelay}ms</code>\n`;
    report += `• <b>Slope:</b> <code>${config.slopeThresholdUp || "N/A"}</code> | <code>${config.slopeThresholdUnder || "N/A"}</code>\n`;
    report += `• <b>Ccys:</b> <code>${config.tokenTradingMode}</code>`;
  
    return report;
  };