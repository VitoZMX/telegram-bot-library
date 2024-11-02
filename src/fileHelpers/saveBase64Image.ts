import fs from 'fs';
import path from 'path';
import { checkExistDownloadDirectory } from "./checkExistDownloadDirectory";

export async function saveBase64Image(base64String: string): Promise<string> {
  try {
    // Получаем папку для сохранений
    const downloadDir = checkExistDownloadDirectory()

    // Генерируем имя файла
    const filename = `Screenshot_${Date.now()}.png`;
    const filePath = path.join(downloadDir, filename);

    // Убираем заголовок Data URL если он есть
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');

    // Сохраняем файл
    fs.writeFileSync(filePath, base64Data, { encoding: 'base64' });

    return filePath;

  } catch (error) {
    console.error('Error saving image:', error);
    throw error;
  }
}