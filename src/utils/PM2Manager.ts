import { exec } from 'child_process';

import util from 'util';
import { Logger } from "./Logger";

const execPromise = util.promisify(exec);

/**
 * Класс для управления и получения информации от PM2
 */
interface PM2Process {
  name: string;
  id: number;
  pid: number;
  status: string;
  cpu: string;
  memory: string;
  uptime: string;
  restarts: number;
}

/**
 * Класс для управления и получения информации от PM2
 */
export class PM2Manager {
  /**
   * Получает список процессов PM2 в виде таблицы
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
   * Получает подробную информацию о процессах
   */
  async getProcessesInfo(): Promise<PM2Process[]> {
    Logger.log('Получение подробной информации о процессах PM2');
    try {
      const { stdout } = await execPromise('pm2 jlist');
      const processes = JSON.parse(stdout);
      return processes.map((proc: any) => ({
        name: proc.name,
        id: proc.pm_id,
        pid: proc.pid,
        status: proc.pm2_env.status,
        cpu: proc.monit?.cpu?.toString() || '0',
        memory: this.formatMemory(proc.monit?.memory || 0),
        uptime: this.formatUptime(proc.pm2_env?.pm_uptime),
        restarts: proc.pm2_env?.restart_time || 0
      }));
    } catch (error) {
      Logger.red('Ошибка при получении информации о процессах PM2');
      console.error(error);
      throw new Error('Не удалось получить информацию о процессах PM2');
    }
  }

  /**
   * Форматирует информацию о процессах в читаемый вид
   */
  formatProcessesInfo(processes: PM2Process[]): string {
    let output = '📊 <b>Подробная информация о процессах:</b>\n\n';

    processes.forEach(proc => {
      output += `🔹 <b>${proc.name}</b> (ID: ${proc.id})\n`;
      output += `├── Статус: ${this.getStatusEmoji(proc.status)} ${proc.status}\n`;
      output += `├── PID: ${proc.pid}\n`;
      output += `├── CPU: ${proc.cpu}%\n`;
      output += `├── Память: ${proc.memory}\n`;
      output += `├── Аптайм: ${proc.uptime}\n`;
      output += `└── Перезапуски: ${proc.restarts}\n\n`;
    });

    return output;
  }

  /**
   * Получает эмодзи для статуса
   */
  private getStatusEmoji(status: string): string {
    switch (status.toLowerCase()) {
      case 'online':
        return '🟢';
      case 'stopped':
        return '🔴';
      case 'errored':
        return '⛔';
      case 'launching':
        return '🟡';
      default:
        return '⚪';
    }
  }

  /**
   * Форматирует память в читаемый вид
   */
  private formatMemory(bytes: number): string {
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(2)} MB`;
  }

  /**
   * Форматирует время работы в читаемый вид
   */
  private formatUptime(timestamp: number): string {
    if (!timestamp) return 'N/A';

    const uptime = Date.now() - timestamp;
    const days = Math.floor(uptime / (24 * 60 * 60 * 1000));
    const hours = Math.floor((uptime % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((uptime % (60 * 60 * 1000)) / (60 * 1000));

    let result = '';
    if (days > 0) result += `${days}д `;
    if (hours > 0) result += `${hours}ч `;
    result += `${minutes}м`;

    return result;
  }

  /**
   * Получает логи конкретного процесса PM2
   */
  async getProcessLogs(processId: number): Promise<string> {
    Logger.log(`Получение логов процесса PM2 с ID ${processId}`);
    try {
      const { stdout } = await execPromise(`pm2 logs ${processId} --lines 10 --nostream`);
      Logger.blue(`Логи процесса ${processId} успешно получены`);
      return stdout;
    } catch (error) {
      Logger.red(`Ошибка при получении логов процесса ${processId}`);
      console.error(error);
      throw new Error(`Не удалось получить логи процесса ${processId}`);
    }
  }

  /**
   * Форматирует вывод PM2 для отправки в Telegram
   */
  formatOutput(output: string, maxLength: number = 4000): string {
    const cleanOutput = output.replace(/\u001b\[\d+m/g, '');
    return cleanOutput.length > maxLength
      ? cleanOutput.substring(0, maxLength) + '...\n[Сообщение обрезано из-за длины]'
      : cleanOutput;
  }
}