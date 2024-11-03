import { Instagram } from 'vdl-core';
import { InstagramResponseType } from "./typos/instagramType";

/** Метод для получения ссылки на видео файл instagram reels
 @param reelsUrl - ссылку на видео в соц. сети */
export async function getInstagramVideoUrl(reelsUrl: string): Promise<string> {
  try {
    const ins: Instagram = new Instagram(reelsUrl);
    const videos: InstagramResponseType[] = await ins.extractVideos();

    if (Array.isArray(videos) && videos.length > 0 && videos[0]?.url && videos[0]?.url.includes('.mp4')) {
      return videos[0].url;
    }

    throw new Error('В публикации Instagram не найден URL-адрес видео');

  } catch (error) {
    console.error('Ошибка извлечения видео из Instagram:', error instanceof Error ? error.message : String(error));
    throw new Error('Не удалось извлечь URL-адрес видео из Instagram.');
  }
}

// Вызов для отладки:
// const videoUrl: Promise<string | null> = getInstagramVideoUrl('https://www.instagram.com/reel/***********/?utm_source=ig_web_copy_link');
// videoUrl.then((url: string | null) => {
//   if (url) {
//     console.log('Video URL:', url);
//   }
// }).catch((error: Error) => {
//   console.error('Error:', error.message);
// });