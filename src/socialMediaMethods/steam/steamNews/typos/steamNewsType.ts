export interface SteamNewsItem {
  gid: string;
  title: string;
  url: string;
  author: string;
  contents: string;
  date: number;
  appid: number;
}

export interface SteamNewsResponse {
  appnews: {
    appid: number;
    newsitems: SteamNewsItem[];
    count: number;
  };
}