import {Telegraf} from "telegraf";

export const botBarCommand = ({ bot, bar }: { bot: Telegraf, bar: string }) => {
    bot.command("bar", async (ctx) => {
        const messageText = ctx.message.text;
        const args = messageText.split(" ").slice(1);

        if (args.length > 0) {
            bar = args.join(" ");
            await ctx.reply(`Bar updated to: ${bar}`);
        } else {
            await ctx.reply(`Current value of bar: ${bar}`);
        }
    });
};
