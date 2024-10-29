import * as fs from 'fs';

/** Метод удаляет файл.
 @param filePath - путь к файлу который будет удален. */
export async function deleteFile(filePath: string): Promise<void> {
  try {
    console.log(`Попытка удаления файла: ${filePath}`);

    // Проверяем существует ли файл
    if (fs.existsSync(filePath)) {
      // Удаляем файл
      fs.unlinkSync(filePath);
      console.log(`Файл успешно удален: ${filePath}`);
    } else {
      console.log(`Файл не найден по пути: ${filePath}`);
    }
  } catch (error) {
    console.error(`Ошибка при удалении файла: ${error}`);
    throw new Error(`Не удалось удалить файл: ${error}`);
  }
}
