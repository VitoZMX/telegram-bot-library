import axios from 'axios';
import { TikTokResponseType } from "./types/tikTokType";

/** Метод для получения данных со ссылки на TikTok
 @param videoUrl - принимает ссылку на видео.
 @return TikTokResponseType - данные о видео. Нужно брать нужную ссылку для скачивания из него, обычно это *.play. */
export async function getTikTokInfo(videoUrl: string): Promise<TikTokResponseType> {
  const retryConfig = {
    maxRetries: 3, // максимальное количество попыток выполнения запроса
    delayMs: 1000, // задержка между попытками в миллисекундах
    timeoutMs: 5000 // максимальное время ожидания ответа от сервера в миллисекундах
  };

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      const response = await axios({
        method: 'GET',
        url: 'https://www.tikwm.com/api/',
        params: {
          url: videoUrl,
          hd: 1
        },
        headers: {
          'accept': 'application/json',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
        }
      });

      return response.data;

    } catch (error) {
      lastError = error as Error;

      if (attempt === retryConfig.maxRetries) break;  // Выходим из цикла на последней попытке

      await new Promise(resolve => setTimeout(resolve, retryConfig.delayMs));
    }
  }

  throw lastError || new Error('Unknown error occurred');
}
