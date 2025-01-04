import { exec } from 'child_process';

import util from 'util';
import { Logger } from "./Logger";

const execPromise = util.promisify(exec);

/**
 * Класс для управления и получения информации от PM2
 */
export class PM2Manager {
  /**
   * Получает список процессов PM2
   */
  async getProcessList(): Promise<string> {
    Logger.log('Получение списка процессов PM2');
    try {
      const { stdout } = await execPromise('pm2 list');
      Logger.blue('Список процессов PM2 успешно получен');
      return stdout;
    } catch (error) {
      Logger.red('Ошибка при получении списка процессов PM2');
      console.error(error);
      throw new Error('Не удалось получить список процессов PM2');
    }
  }

  /**
   * Получает логи всех процессов PM2
   */
  async getLogs(): Promise<string> {
    Logger.log('Получение логов PM2');
    try {
      // Получаем только последние 20 строк логов
      const { stdout } = await execPromise('pm2 logs --lines 20 --nostream');
      Logger.blue('Логи PM2 успешно получены');
      return stdout;
    } catch (error) {
      Logger.red('Ошибка при получении логов PM2');
      console.error(error);
      throw new Error('Не удалось получить логи PM2');
    }
  }

  /**
   * Форматирует вывод PM2 для отправки в Telegram
   */
  formatOutput(output: string): string {
    // Убираем ANSI escape коды (цвета и форматирование)
    const cleanOutput = output.replace(/\u001b\[\d+m/g, '');
    // Ограничиваем длину сообщения до 4000 символов (лимит Telegram)
    return cleanOutput.length > 4000
      ? cleanOutput.substring(0, 4000) + '...\n[Сообщение обрезано из-за длины]'
      : cleanOutput;
  }
}