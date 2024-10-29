import axios from 'axios';
import { TikTokResponse } from "./types/typeTikTok";

/** Метод для получения данных со ссылки на TikTok
 @param videoUrl - принимает ссылку на видео.
 @return TikTokResponse - данные о видео. Нужно брать нужную ссылку для скачивания из него, обычно это *.play. */
export async function getTikTokInfo(videoUrl: string): Promise<TikTokResponse> {
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

    /* Для удобной отладки. */
    // console.log('TikTok video info:', response);
    // console.log('Download URL:', response.data.data.play);
    // console.log('Download URL HD:', response.data.data.hdplay);
    // console.log('Download URL WM:', response.data.data.wmplay);
    // console.log('Music URL:', response.data.data.music_info.play);

    return response.data;
  } catch (error) {
    console.error('Error fetching TikTok data:', error);
    throw error;
  }
}
