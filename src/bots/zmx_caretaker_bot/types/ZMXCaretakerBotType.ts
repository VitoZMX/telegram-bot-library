import { Context } from "telegraf";

export interface LinkPattern {
  regex: RegExp;
  processor: (ctx: Context, url: string, messageId: string, chatID: number, botName?: string) => Promise<void>;
}

export interface QueueTask {
  ctx: Context;
  messageId: string;
  timestamp: number;
}