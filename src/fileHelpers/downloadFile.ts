import * as fs from 'fs';
import axios from 'axios';
import * as path from 'path';

/** Метод скачивает файл по ссылке и сохраняет в папку "downloads".
 @param url - ссылка на файл, который нужно скачать.
 @return string - путь к сохраненному файлу. */
export async function downloadFile(url: string): Promise<string> {
  // Проверяем расширение файла
  if (url.toLowerCase().endsWith('.mp3')) {
    console.log('Обнаружена попытка скачать mp3 файл. Операция прервана.');
    throw new Error('Скачивание mp3 файлов запрещено');
  }

  try {
    console.log('Начинаем загрузку файла...');
    console.log(`URL файла: ${url}`);

    // Создаем папку downloads если она не существует
    const downloadDir = path.join(process.cwd(), './downloads');
    if (!fs.existsSync(downloadDir)) {
      console.log('Папка downloads не найдена, создаем новую...');
      fs.mkdirSync(downloadDir);
      console.log(`Папка создана по пути: ${downloadDir}`);
    } else {
      console.log('Папка downloads уже существует');
    }

    // Генерируем уникальное имя файла используя текущую метку времени
    const filename = `./temp_${Date.now()}.mp4`;
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

    // Возвращаем промис, который разрешится когда файл будет полностью записан
    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log('Файл успешно загружен и сохранен');
        console.log(`Полный путь к файлу: ${filepath}`);
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
