import { Context } from "telegraf";

export interface SessionData {
  editingNewsId?: string;
}

export interface MyContext extends Context {
  session: SessionData;
}

export interface MediaItem {
  type: 'photo' | 'video';
  media: string,
  caption?: string,
  parse_mode?: string
}