import { Context } from "telegraf";

export interface SessionData {
  editingNewsId?: string;
}

export interface MyContext extends Context {
  session: SessionData;
}