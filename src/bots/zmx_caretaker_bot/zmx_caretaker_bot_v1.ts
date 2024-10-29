import { Context, Input } from 'telegraf';
import { deleteFile } from "../../fileHelpers/deleteFile";
import { downloadFile } from "../../fileHelpers/downloadFile";
import { getTikTokInfo } from "../../socialMediaMethods/TikTok/tikTok";

// Инициализация бота по ключу
require('dotenv').config({ path: '.env.tokens' }); // Укажите путь к вашему файлу

const { Telegraf } = require('telegraf');
const bot = new Telegraf(process.env.ZMX_CARETAKER_BOT_V1);

// Регулярное выражение для поиска ссылок TikTok
const tiktokRegex = /(https?:\/\/)?(vm\.|www\.|m\.)?tiktok\.com\/[@A-Za-z0-9_\-.\/]+/i;

bot.on('message', async (ctx: Context) => {
  // Проверяем, содержит ли сообщение текст
  if (ctx.message && 'text' in ctx.message) {
    const text = ctx.message.text;
    const username = ctx.message.from.username || ctx.message.from.first_name;
    console.log('Имя пользователя:', username);
    console.log('Получено сообщение:', text);

    const match = text.match(tiktokRegex);
    console.log('Результат поиска ссылки:', match);

    if (match) {
      console.log('----------------//----------------');
      try {
        console.log('Найдена ссылка TikTok:', match[0]);

        // Удаляем исходное сообщение
        await ctx.deleteMessage();
        console.log('Исходное сообщение удалено');

        // Отправляем уведомление об удалении ссылки
        await ctx.reply(`@${username} ссылка удалена`, { disable_notification: true });
        console.log('Уведомление об удалении ссылки отправлено');

        // Получаем URL видео
        const videoUrl = await getTikTokInfo(match[0]).then((res) => res.data.play);
        console.log('URL видео получен:', videoUrl);

        // Скачиваем видео
        const localFilePath = await downloadFile(videoUrl);
        console.log('Видео скачано:', localFilePath);

        // Отправляем видео
        await ctx.sendVideo(Input.fromLocalFile(localFilePath), {
          disable_notification: true
        });
        console.log('Видео отправлено');

        // Удаляем скачанный файл
        await deleteFile(localFilePath);
        console.log('Скачанный файл удален');

      } catch (error) {
        console.error('Ошибка при обработке видео TikTok:', error);
        await ctx.reply('Произошла ошибка при обработке видео', { disable_notification: true });
      }
    } else {
      console.log('Ссылка TikTok не найдена');
    }
    console.log('----------------//----------------');
  }
});

// Запускаем бота
bot.launch()
  .then(() => console.log('Бот запущен'))
  .catch((error: any) => console.error('Ошибка запуска бота:', error));

// Обеспечиваем корректное завершение работы
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));