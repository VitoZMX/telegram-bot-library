import * as fs from 'fs';
import { Logger } from "../utils/Logger";

/** Метод удаляет файл.
 @param filePath - путь к файлу который будет удален. */
export async function deleteFile(filePath: string): Promise<void> {
  try {
    // Проверяем существует ли файл
    if (fs.existsSync(filePath)) {
      // Удаляем файл
      fs.unlinkSync(filePath);
      Logger.log(`Файл успешно удален: ${filePath}`);
    } else {
      Logger.red(`При удаление файл не найден по пути: ${filePath}`);
    }
  } catch (error) {
    console.error(`Ошибка при удалении файла: ${error}`);
    throw new Error(`Не удалось удалить файл: ${error}`);
  }
}
