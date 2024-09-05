import {ImgnMode, IntervalConfig} from "../type";

export const parseConfigInterval = (configString: string) => {
    const configParts = configString.split(" ");
  
    let bar = "1Dutc";
    let leve = 5;
    let mgnMode: ImgnMode = "isolated";
    let sz = 500;
    let intervalDelay = 30 * 1000;
    let slopeThresholdUp: number | undefined;
    let slopeThresholdUnder: number | undefined;
    let slopeThreshAverageMode: boolean | undefined;
    let tokenTradingMode: "all" | "whitelist" | string = "whitelist";
  
    configParts.forEach((part) => {
      if (part.startsWith("bar-")) {
        bar = part.replace("bar-", "");
      } else if (part.startsWith("leve-")) {
        leve = parseInt(part.replace("leve-", ""));
      } else if (part.startsWith("mgnMode-")) {
        mgnMode = part.replace("mgnMode-", "") as ImgnMode;
      } else if (part.startsWith("sz-")) {
        sz = parseFloat(part.replace("sz-", ""));
      } else if (part.startsWith("delay-")) {
        intervalDelay = parseInt(part.replace("delay-", ""));
      } else if (part.startsWith("slopeUp-")) {
        slopeThresholdUp = parseFloat(part.replace("slopeUp-", ""));
      } else if (part.startsWith("slopeUnder-")) {
        slopeThresholdUnder = parseFloat(part.replace("slopeUnder-", ""));
      } else if (part.startsWith("avgMode-")) {
        slopeThreshAverageMode = part.replace("avgMode-", "") === "true";
      } else if (part.startsWith("tokenMode-")) {
        tokenTradingMode = part.replace("tokenMode-", "") as "all" | "whitelist" | string;
      }
    });
  
    return {
      bar,
      leve,
      mgnMode,
      sz,
      intervalDelay,
      slopeThresholdUp,
      slopeThresholdUnder,
      slopeThreshAverageMode,
      tokenTradingMode,
    };
  };
  
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