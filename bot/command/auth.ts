import {Telegraf} from "telegraf";

export const botLoginCommand = ({bot, authenticated, validUsername }:{bot: Telegraf, authenticated:boolean, validUsername:string}) => {
    bot.command("login", async (ctx) => {
        const username = ctx.from?.username;
        if (username === validUsername) {
            authenticated = true;
            await ctx.reply("You are successfully logged in!");
        } else {
            await ctx.reply("Unauthorized user. You cannot use this bot.");
        }
    });
       
    bot.use((ctx, next) => {
        if (authenticated) {
            return next();
        } else {
            return ctx.reply("Please login using /login to authenticate.");
        }
    });
}