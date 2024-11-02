import fs from 'fs';
import path from 'path';
import { Logger } from "../utils/Logger";

export function checkExistDownloadDirectory(): string {
  const downloadDir = path.join(process.cwd(), './downloads');

  if (!fs.existsSync(downloadDir)) {
    Logger.log('Папка downloads не найдена, создаем новую...');
    fs.mkdirSync(downloadDir);
    Logger.log(`Папка создана по пути: ${downloadDir}`);
  } else {
    Logger.log('Папка downloads уже существует');
  }

  return downloadDir;
}