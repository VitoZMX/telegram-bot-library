import axios from 'axios';
import { knownGameIds } from "../data/steamData";
import { iGameData, iGameInfo } from "./typos/steamGameInfoType";

// Конфигурирует краткую информацию об игре + онлайн на текущий момент
export const getGameInfo = async (appId: number): Promise<iGameInfo> => {
  try {
    const [currentPlayers, gameInfo] = await Promise.all([
      getCurrentPlayers(appId),
      getSteamGameInfo(appId)
    ]);

    if (!gameInfo) {
      throw new Error(`Информация об игре не найдена для appId: ${appId}`);
    }

    return {
      appid: appId,
      nameGame: gameInfo.name,
      urlImg: gameInfo.header_image,
      urlSteam: `https://store.steampowered.com/app/${appId}`,
      description: gameInfo.short_description,
      grade: {
        score: gameInfo.metacritic?.score,
        url: gameInfo.metacritic?.url
      },
      averagePlayers: 0,
      currentPlayers: currentPlayers,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Не удалось получить информацию об игре.: ${errorMessage}`);
  }
};

// getGameInfo(730).then((res)=> {
//   console.log(res);
// })

// Текущий онлайн в игре по id
const getCurrentPlayers = async (appId: number): Promise<number> => {
  const response = await axios.get(`https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${appId}`);
  return response.data.response.player_count || 0;
};

// Получить всю информацию об игре по id
export const getSteamGameInfo = async (appId: number): Promise<iGameData['data']> => {
  const url = `https://store.steampowered.com/api/appdetails?appids=${appId}&l=russian`;

  try {
    const response = await axios.get(url);
    const data: iGameData = response.data[appId];

    if (!data || !data.success) {
      throw new Error(`Failed to fetch game data for appId: ${appId}`);
    }

    return data.data;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Error fetching data from Steam API: ${errorMessage}`);
  }
};

// getSteamGameInfo(271590).then((gameData) => {
//   if (gameData) {
//     console.log(gameData);
//   } else {
//     console.log("Game data not found.");
//   }
// });

// Получить массив топ игры стима + игры из списка
export const getTopSellersIds = async (): Promise<number[]> => {
  const url = 'https://store.steampowered.com/search/results?sort_by=_ASC&category1=998&supportedlang=russian&filter=topsellers&page=1';
  try {
    const response = await axios.get(url);
    const html = response.data;

    // Извлекаем все app ID с помощью регулярного выражения
    const appIdRegex = /data-ds-appid="(\d+)"/g;
    const matches = html.matchAll(appIdRegex);

    let ids: number[] = knownGameIds;
    for (const match of matches) {
      ids.push(parseInt(match[1]));
    }

    // Возвращаем только первые 50 игр или меньше
    ids = [...new Set(ids)];
    return ids.slice(0, 50);
  } catch (error) {
    console.error(`Error fetching top sellers: ${error}`);
    return [];
  }
};

// getTopSellersIds().then(ids => {
//   console.log('Top sellers IDs:', ids);
// });
