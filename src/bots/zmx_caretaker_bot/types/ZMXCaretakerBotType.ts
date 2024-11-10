import { Context } from "telegraf";

export interface LinkPattern {
  regex: RegExp;
  processor: (ctx: Context, url: string, messageId: string, chatID: number) => Promise<void>;
}