import * as fs from 'fs';
import axios from 'axios';
import * as path from 'path';
import { checkExistDownloadDirectory } from "./checkExistDownloadDirectory";

/** Метод скачивает файл по ссылке и сохраняет в папку "downloads".
 @param url - ссылка на файл, который нужно скачать.
 @return string - путь к сохраненному файлу. */
export async function downloadFile(url: string): Promise<string> {
  try {
    console.log('Начинаем загрузку файла...');
    console.log(`URL файла: ${url}`);

    // Получаем папку для сохранений
    const downloadDir = checkExistDownloadDirectory()

    // Определяем тип и расширение файла из URL
    const isAudio = url.toLowerCase().endsWith('.mp3');
    const fileExtension = isAudio ? '.mp3' : '.mp4';
    const prefix = isAudio ? 'Audio' : 'Video';

    // Генерируем уникальное имя файла
    const filename = `./${prefix}_temp_${Date.now()}${fileExtension}`;
    const filepath = path.join(downloadDir, filename);
    console.log(`Файл будет сохранен как: ${filepath}`);

    // Скачиваем файл используя axios
    console.log('Начинаем скачивание файла...');
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream'
    });
    console.log('Получен ответ от сервера, начинаем сохранение...');

    // Создаем поток записи и сохраняем файл
    const writer = fs.createWriteStream(filepath);
    response.data.pipe(writer);

    // Возвращаем promise, который разрешится когда файл будет полностью записан
    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log('Файл успешно загружен');
        const stats = fs.statSync(filepath);
        const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
        console.log(`Итоговый размер файла: ${fileSizeInMB} MB`);
        resolve(filepath);
      });
      writer.on('error', (error) => {
        console.error('Произошла ошибка при записи файла:', error);
        reject(error);
      });
    });

  } catch (error) {
    console.error('Произошла ошибка при загрузке файла:', error);
    throw new Error(`Ошибка загрузки файла: ${error}`);
  }
}
