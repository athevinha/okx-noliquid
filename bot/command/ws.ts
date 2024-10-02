import { Telegraf } from "telegraf";
import { axiosErrorDecode, generateTelegramTableReport } from "../utils";
import { CampaignConfig } from "../type";
import WebSocket from "ws";

export const botWSManagement = ({
  bot,
  campaigns,
}: {
  bot: Telegraf;
  campaigns: Map<string, CampaignConfig>;
}) => {
  bot.command("wss", async (ctx) => {
    try {
      const id = ctx.message.text.split(" ")[1];

      // Helper function to determine WebSocket status and return it with an icon
      const wsStatus = (ws?: WebSocket) => {
        if (!ws) return "🔴 Not connected";
        switch (ws.readyState) {
          case 0: return "🟡 Connecting";
          case 1: return "🟢 Open";
          case 2: return "🟠 Closing";
          case 3: return "🔴 Closed";
          default: return "⚪️ Unknown";
        }
      };

      // Helper function to build table data for a specific campaign
      const buildTableData = (campaignId: string, campaignConfig: CampaignConfig) => [
        { Service: `Trade [${campaignId}]`, Status: wsStatus(campaignConfig.WS) },
        { Service: `Trailing [${campaignId}]`, Status: wsStatus(campaignConfig.WSTrailing) },
        { Service: `Ticker [${campaignId}]`, Status: wsStatus(campaignConfig.WSTicker) },
      ];

      let sortedTableData: any[] = [];

      if (id) {
        // If ID is provided, show status for that specific campaign
        const campaignConfig = campaigns.get(id);
        if (!campaignConfig) {
          await ctx.replyWithHTML(`Campaign with ID <code>${id}</code> not found.`);
          return;
        }
        sortedTableData = buildTableData(id, campaignConfig);
      } else {
        // If no ID is provided, loop through all campaigns
        campaigns.forEach((campaignConfig, campaignId) => {
          sortedTableData.push(...buildTableData(campaignId, campaignConfig));
        });

        if (sortedTableData.length === 0) {
          await ctx.replyWithHTML(`No active campaigns found.`);
          return;
        }
      }

      // Define headers for your table
      const tableHeaders = ["Service", "Status"];

      // Generate the report
      const fullReport = generateTelegramTableReport(sortedTableData, tableHeaders);

      // Send the full report
      await ctx.reply(fullReport, { parse_mode: "HTML" });

    } catch (err: any) {
      console.log(axiosErrorDecode(err));
      await ctx.replyWithHTML(`Error: <code>${axiosErrorDecode(err)}</code>`);
    }
  });
};
