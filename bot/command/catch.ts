
import {Telegraf} from "telegraf";

export const botCatchError = ({bot }:{bot: Telegraf}) => {
    bot.catch(async (err: any, ctx) => {
        console.error("ERROR: ", err.reason || err.message || err.code);
        if (JSON.stringify(err).includes("TimeoutError")) return;
        await ctx.reply("An error occurred!");
    });
}