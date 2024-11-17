import axios from 'axios';
import { Logger } from "../../../utils/Logger";
import { getTopSellersIds } from "../steamGameInfo/steamGameInfo";
import { SteamNewsItem, SteamNewsResponse } from "./typos/steamNewsType";

// Основная функция для получения новостей по всем играм из топа ToDo нужно тестировать и что-то придумывать с ними
export const getTopSteamNews = async (): Promise<SteamNewsItem[]> => {
  try {
    const appIds = await getTopSellersIds();
    let allNews: SteamNewsItem[] = [];

    for (const appId of appIds) {
      try {
        const newsItems = await getSteamNews(appId);
        allNews = allNews.concat(newsItems);
      } catch (error) {
        Logger.red(`Ошибка при получении новостей для игры ${appId}`);
      }
    }

    return allNews;
  } catch (error) {
    Logger.red('Ошибка при формировании общего списка новостей');
    throw error;
  }
};

// Получение новостей ToDo нужно придумать как переводить и переписывать для поста
const getSteamNews = async (appId: number): Promise<SteamNewsItem[]> => {
  try {
    const response = await axios.get<SteamNewsResponse>(
      `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${appId}&count=2&maxlength=300&l=russian`
    );
    Logger.log(`Получены новости Steam для приложения ${appId}`);
    return response.data.appnews.newsitems;
  } catch (error: any) {
    Logger.red(`Ошибка при получении новостей Steam для приложения ${appId}`);
    throw error;
  }
};

