import axios from "axios";
import { Readable } from "stream";

/** Метод для получения потока instagram reels
 @param reelsUrl - ссылку на видео в соц. сети */
export async function getInstagramVideo(reelsUrl: string): Promise<Readable> {
  const { igdl } = require('ruhend-scraper')
  try {
    let res = await igdl(reelsUrl);

    const response = await axios({
      method: 'GET',
      url: res.data[0].url,
      responseType: 'stream'
    });
    return response.data;

    throw new Error('В публикации Instagram не найден URL-адрес видео');

  } catch (error) {
    console.error('Ошибка извлечения видео из Instagram:', error instanceof Error ? error.message : String(error));
    throw new Error('Не удалось извлечь URL-адрес видео из Instagram.');
  }
}

// Вызов для отладки:
// getInstagramVideoUrl('https://www.instagram.com/reel/*************/?igsh=MTh1YTg2cHVsa21uOA==').then(res=> console.log(res))