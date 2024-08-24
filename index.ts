import {bot} from "./bot";
import dotenv from 'dotenv'
dotenv.config()
bot(process.env.TELEGRAM_BOT_API)