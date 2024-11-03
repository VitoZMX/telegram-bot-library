import { Context } from "telegraf";

export interface LinkPattern {
  regex: RegExp;
  processor: (ctx: Context, url: string, username: string, messageId: string, chatID: number) => Promise<void>;
}