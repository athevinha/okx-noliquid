import { Telegraf } from "telegraf";

export const botCatchError = ({ bot }: { bot: Telegraf }) => {
  bot.catch(async (err: any, ctx) => {
    console.error("ERROR: ", err.reason || err.message || err.code);
    await ctx.reply(
      `An error occurred: ${err.reason || err.message || err.code}`,
    );
  });
};
