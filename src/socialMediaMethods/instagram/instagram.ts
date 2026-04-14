import axios from "axios";
import { Readable } from "stream";

/** Метод для получения потока instagram reels
 @param reelsUrl - ссылку на видео в соц. сети
 @param maxRetries - кол-во попыток повторить запрос */
export async function getInstagramVideo(reelsUrl: string, maxRetries: number = 3): Promise<Readable> {
  const { igdl } = require('ruhend-scraper');
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Instagram] Попытка ${attempt} из ${maxRetries} получить видео...`);

      let res = await igdl(reelsUrl);

      if (!res?.data?.[0]?.url) {
        throw new Error('В публикации Instagram не найден URL-адрес видео');
      }

      const response = await axios({
        method: 'GET',
        url: res.data[0].url,
        responseType: 'stream',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      console.log(`[Instagram] Видео успешно получено с ${attempt} попытки`);
      return response.data;

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[Instagram] Ошибка при попытке ${attempt}:`, lastError.message);

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.log(`[Instagram] Повторная попытка через ${delay/1000} сек`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`Не удалось извлечь видео из Instagram после ${maxRetries} попыток: ${lastError?.message}`);
}

// Вызов для отладки:
//getInstagramVideo('https://www.instagram.com/reel/*************/?igsh=MTh1YTg2cHVsa21uOA==').then(res=> console.log(res))