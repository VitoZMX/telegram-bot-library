import fs from "fs";
import path from "path";
import sharp from "sharp";
import axios from "axios";
import { Logger } from "../../utils/Logger";
import { Markup, Telegraf } from 'telegraf';
import { MessageEntity } from 'telegraf/types';
import { PM2Manager } from "../../utils/PM2Manager";
import { DateHelper } from "../../utils/dateHelper";
import { formatNumber } from "../../utils/formatNumber";
import { MediaItem, MyContext } from "./types/ZMXQuillBotType";
import { getGameInfo, getTopSellersIds } from "../../socialMediaMethods/steam/steamGameInfo/steamGameInfo";

require('dotenv').config({ path: '.env.tokens' });

class BotQuill {
  private bot: Telegraf<MyContext>;
  private readonly adminId: number;
  private readonly channelZMXGamesId: string;
  private readonly channelZMXGamesName: string;
  private readonly token_ZMX_QUILL_BOT: string;
  private pm2Manager: PM2Manager;
  private isProcessing: boolean = false;
  private mediaGroups: { [key: string]: any[] } = {}; // Хранилище для медиа групп
  private newsCheckInterval: NodeJS.Timeout | null = null;
  private processingGroups: { [key: string]: boolean } = {}; // Хранилище флагов обработки групп
  private messageQueue: { ctx: MyContext; messageId: string }[] = [];

  constructor() {
    this.token_ZMX_QUILL_BOT = process.env.ZMX_QUILL_BOT!
    this.bot = new Telegraf<MyContext>(this.token_ZMX_QUILL_BOT);
    this.pm2Manager = new PM2Manager();
    this.adminId = Number(process.env.ADMIN_ID);
    this.channelZMXGamesId = process.env.CHANNEL_ZMXGAMES_ID!;
    this.channelZMXGamesName = process.env.CHANNEL_ZMXGAMES_NAME!;

    this.bot.use((ctx, next) => {
      ctx.session = ctx.session || {};
      return next();
    });

    this.initializeBot();
  }

  private initializeBot(): void {
    this.bot.action(/^publish_(.+)$/, (ctx) => this.handlePublish(ctx));
    this.bot.action(/^edit_(.+)$/, (ctx) => this.handleEdit(ctx));
    this.bot.action(/^delete_(.+)$/, (ctx) => this.handleDelete(ctx));

    this.bot.command('online', (ctx) => this.sendOnlineInGames(ctx));
    this.bot.command('stat', (ctx) => this.handleStat(ctx));
    this.bot.on('message', (ctx) => this.handleMessage(ctx));
  }

  private addToQueue(ctx: MyContext, messageId: string): void {
    this.messageQueue.push({ ctx, messageId });
    Logger.log(`Сообщение добавлено в очередь c id: [${messageId}]`);
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.messageQueue.length === 0) return;
    this.isProcessing = true;

    while (this.messageQueue.length > 0) {
      const { ctx, messageId } = this.messageQueue[0];
      try {
        console.log(`Обработка сообщения с id: ${messageId}`);
        await this.handleMessage(ctx);
      } catch (error) {
        console.error(`Ошибка при обработке сообщения: ${messageId}`, error);
      }
      this.messageQueue.shift();
    }
    this.isProcessing = false;
  }

  async addWatermarkToPhotos(mediaGroup: MediaItem[],  chatId: number, watermarkPath?: string, watermarkPathToTelegram?: boolean): Promise<MediaItem[]> {
    if(!watermarkPath){
      watermarkPath = 'file://' + path.resolve(__dirname, '../../img/zmx.png').replace(/\\/g, '/');
    }

    Logger.log(`Добавление водяного знака на картинки`)
    const updatedMediaGroup: MediaItem[] = [];
    let watermarkBuffer: Buffer;

    try {
      if (watermarkPathToTelegram) {
        // Если true - получаем URL файла из Telegram
        const watermarkUrl = await this.getTelegramFileUrl(watermarkPath);
        const watermarkResponse = await axios.get(watermarkUrl, { responseType: 'arraybuffer' });
        watermarkBuffer = Buffer.from(watermarkResponse.data);
      } else if (watermarkPath.startsWith('http://') || watermarkPath.startsWith('https://')) {
        // Если обычная URL-ссылка на изображение
        const watermarkResponse = await axios.get(watermarkPath, { responseType: 'arraybuffer' });
        watermarkBuffer = Buffer.from(watermarkResponse.data);
      } else if (watermarkPath.startsWith('file://')) {
        // Если локальный файл
        watermarkBuffer = await fs.promises.readFile(watermarkPath.replace('file://', ''));
      } else {
        // Если передан file_id из Telegram
        const watermarkUrl = await this.getTelegramFileUrl(watermarkPath);
        const watermarkResponse = await axios.get(watermarkUrl, { responseType: 'arraybuffer' });
        watermarkBuffer = Buffer.from(watermarkResponse.data);
      }

    } catch (error) {
      console.error('Ошибка при загрузке водяного знака:', error);
      throw error;
    }

    for (const item of mediaGroup) {
      if (item.type === 'photo') {
        try {
          // Скачать изображение по file_id
          const fileUrl = await this.getTelegramFileUrl(item.media); // Метод для получения URL файла Telegram
          const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });

          // Определить размер исходного изображения
          const imageBuffer = Buffer.from(response.data);
          const metadata = await sharp(imageBuffer).metadata();

          if (!metadata.width || !metadata.height) {
            Logger.red('Не удалось получить размеры исходного изображения');
            return updatedMediaGroup
          }

          // Рассчитать масштабирование водяного знака (10% от ширины исходного изображения)
          const watermarkWidth = Math.round(metadata.width * 0.1);

          // Масштабировать водяной знак
          const resizedWatermarkBuffer = await sharp(watermarkBuffer)
            .resize({ width: watermarkWidth })
            .toBuffer();

          // Добавить водяной знак
          const watermarkedImageBuffer = await sharp(imageBuffer)
            .composite([
              {
                input: resizedWatermarkBuffer, // Масштабированный водяной знак
                gravity: 'northeast', // Размещение в правом верхнем углу
                blend: 'over'
              }
            ])
            .toBuffer();

          // Загрузить обработанное изображение обратно в Telegram
          const uploadedFile = await this.uploadToTelegram(watermarkedImageBuffer, chatId); // Метод загрузки файла в Telegram

          // Обновить объект media с новым file_id
          updatedMediaGroup.push({
            ...item,
            media: uploadedFile.file_id // Новый file_id
          });
        } catch (error) {
          console.error('Ошибка при обработке изображения:', error);
          updatedMediaGroup.push(item); // Если произошла ошибка, оставить оригинал
        }
      } else {
        updatedMediaGroup.push(item); // Не фото, оставить оригинал
      }
    }

    return updatedMediaGroup;
  }

  async getTelegramFileUrl(fileId: string): Promise<string> {
    Logger.log(`Загрузка файла из телеграмма`)

    // Получения URL файла Telegram по file_id, с использованием Telegram Bot API
    const file = await this.bot.telegram.getFile(fileId);
    return `https://api.telegram.org/file/bot${this.token_ZMX_QUILL_BOT}/${file.file_path}`;
  }

  async uploadToTelegram(buffer: Buffer, chatId: number): Promise<{ file_id: string }> {
    const response = await this.bot.telegram.sendPhoto(chatId, { source: buffer });
    Logger.blue(`Файл отправлен в телеграмм`)

    await this.bot.telegram.deleteMessage(chatId, response.message_id);
    Logger.blue(`Сообщение с файлом удалено из чата`)

    return response.photo[response.photo.length - 1]; // Вернуть самый крупный вариант фото
  }

  async createMediaGroup(messages: any[]): Promise<MediaItem[]> {
    Logger.log(`Создание медиа группы`)
    const mediaGroup: MediaItem[] = [];

    // Проверяем, есть ли caption в первом сообщении
    const firstMessageCaption = messages[0]?.caption || '';
    const firstMessageCaptionEntities = messages[0]?.caption_entities || [];

    for (const message of messages) {
      // Если сообщение содержит фото
      if (message.photo) {
        const largestPhoto = message.photo[message.photo.length - 1]; // Самое большое фото
        const mediaItem: MediaItem = {
          type: 'photo',
          media: largestPhoto.file_id,
        };

        mediaGroup.push(mediaItem);
      }

      // Если сообщение содержит видео
      if (message.video) {
        mediaGroup.push({
          type: 'video',
          media: message.video.file_id,
        });
      }
    }

    // У первого элемента в массиве вставляется текст в HTML разметке
    mediaGroup[0] = {
      ...mediaGroup[0],
      caption: await this.parseMessageLinks(firstMessageCaption, firstMessageCaptionEntities),
      parse_mode: 'HTML'
    };

    return mediaGroup;
  }

  private async handleMessage(ctx: MyContext): Promise<void> {
    if (ctx.from?.id !== this.adminId) return;
    const message = ctx.message;
    if (!message) return;
    Logger.magenta(`Обработка сообщения с id: ${message.message_id}`);

    try {
      // Проверяем, содержит ли сообщение media_group_id
      // @ts-ignore
      if (message.media_group_id) {
        Logger.magenta(`В сообщение обнаружена медиа группа`)
        await this.handleMediaGroupMessage(ctx, message);
      } else {
        Logger.magenta(`Обнаружена простое сообщение`)
        await this.handleSingleMessage(ctx, message);
      }

    } catch (error) {
      Logger.red('Ошибка при обработке сообщения');
      console.error(error);
      await ctx.reply('Произошла ошибка при обработке сообщения');
    }
  }

  private async handleMediaGroupMessage(ctx: MyContext, message: any): Promise<void> {
    // @ts-ignore
    const groupId = message.media_group_id;

    // Инициализация массива для группы, если ещё нет
    if (!this.mediaGroups[groupId]) {
      this.mediaGroups[groupId] = [];
    }

    // Добавляем сообщение в группу
    this.mediaGroups[groupId].push(message);
    Logger.log(`Сообщение добавлено в медиа группу ${groupId}`);

    // Если группа уже обрабатывается, не запускаем новый таймер
    if (!this.processingGroups[groupId]) {
      this.processingGroups[groupId] = true; // Устанавливаем флаг обработки

      // Обрабатываем группу через некоторое время
      setTimeout(async () => {
        try {
          const group = this.mediaGroups[groupId];

          if (group) {
            // Формируем массив для медиа группы
            const mediaGroup = await this.createMediaGroup(group);

            // @ts-ignore
            const mediaGroupWithWaterMark = await this.addWatermarkToPhotos(
              mediaGroup,
              //@ts-ignore
              ctx.chat?.id
            );

            if (mediaGroup.length > 0) {
              // @ts-ignore
              const messages = await ctx.replyWithMediaGroup(mediaGroupWithWaterMark);
              Logger.blue(`Медиа группа отправлена в чат`)
              const messageIds = messages.map((message) => message.message_id);

              Logger.green(`Медиа группа ${groupId} обработана и удалена.`);
            }

            // Удаляем медиа группу из хранилища после обработки
            delete this.mediaGroups[groupId];
          }
        } catch (error) {
          console.error(`Ошибка при обработке медиа группы ${groupId}:`, error);
        }
      }, 2000); // Ждём 2 секунды для получения всех сообщений в группе
    }
  }

  private async handleSingleMessage(ctx: MyContext, message: any): Promise<void> {
    // Проверяем, есть ли фото в сообщении
    if (message.photo || message.video) {
      const mediaItem: MediaItem[] = [];

      if (message.photo) {
        const largestPhoto = message.photo[message.photo.length - 1];
        mediaItem.push({
          type: 'photo',
          media: largestPhoto.file_id,
          caption: await this.parseMessageLinks(message.caption || '', message.caption_entities),
          parse_mode: 'HTML'
        });
      } else if (message.video) {
        mediaItem.push({
          type: 'video',
          media: message.video.file_id,
          caption: await this.parseMessageLinks(message.caption || '', message.caption_entities),
          parse_mode: 'HTML'
        });
      }

      const mediaWithWatermark = await this.addWatermarkToPhotos(
        mediaItem,
        // @ts-ignore
        ctx.chat?.id
      );

      if (mediaWithWatermark.length > 0) {
        // @ts-ignore
        await ctx.replyWithMediaGroup(mediaWithWatermark);
        Logger.blue(`сообщение без медиа группа отправлен в чат`)
      }
    }
  }

  private async sendKeyboard(ctx: MyContext, messageID: number[], media_group_id: number): Promise<void> {
    Logger.log(`Отправка клавиатуры`)

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('Опубликовать', `publish_${media_group_id}`),
        Markup.button.callback('Редактировать', `edit_${messageID}`),
        Markup.button.callback('Удалить', `delete_${messageID.join('_')}`)
      ]
    ]);

    await ctx.reply('Выберите действие:', keyboard);
    Logger.blue(`Клавиатура отправлена в чат`)
  }

  private async getChannelTitle(): Promise<string> {
    try {
      Logger.log(`Получение имени новостного канала`)
      const channelInfo = await this.bot.telegram.getChat(this.channelZMXGamesId);
      // @ts-ignore
      return channelInfo.title || 'на новости';
    } catch (error) {
      Logger.red(`Ошибка получения информации о канале`)
      console.error('Ошибка получения информации о канале:', error);
      return 'на новости';
    }
  }

  private async parseMessageLinks(caption: string, caption_entities?: MessageEntity[]): Promise<string> {
    const chanelName = this.channelZMXGamesName.replace('@', '');
    const channelTitle = await this.getChannelTitle();
    const followingText = `\n\nПодписаться: <a href="https://t.me/${chanelName}"><b>${channelTitle}</b></a>`

    // Если нет caption или caption_entities, возвращаем оригинальный caption
    if (!caption || !caption_entities) {
      return caption || '';
    }
    Logger.log(`Формирования текста со ссылками для публикации`)

    // Сортируем сущности по смещению в обратном порядке
    const sortedEntities = caption_entities
      .filter(entity => entity.type === 'text_link')
      .sort((a, b) => b.offset - a.offset);

    // Создаем копию текста для модификации
    let formattedCaption = caption;

    // Заменяем ссылки HTML-тегами
    sortedEntities.forEach(entity => {
      if (entity.type === 'text_link' && entity.url) {
        const linkText = caption.substring(entity.offset, entity.offset + entity.length);
        const replacement = `<a href="${entity.url}">${linkText}</a>`;
        formattedCaption =
          formattedCaption.slice(0, entity.offset) +
          replacement +
          formattedCaption.slice(entity.offset + entity.length);
      }
    });

    return formattedCaption + followingText;
  }

  private async handlePublish(ctx: MyContext): Promise<void> {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;
    const messageIds = ctx.callbackQuery.data.replace('delete_', '').split("_").map(Number);

    try {
      // Проверяем, содержит ли переданные сообщения media_group_id
      // @ts-ignore
      const firstMessage = await ctx.telegram.getMessage(ctx.chat!.id, messageIds[0]);
      // @ts-ignore
      const mediaGroupId = firstMessage.media_group_id;

      if (mediaGroupId) {
        const groupMessages = [];

        // Собираем все сообщения из медиа группы по переданным ID
        for (const id of messageIds) {
          // @ts-ignore
          const message = await ctx.telegram.getMessage(ctx.chat!.id, id);
          groupMessages.push(message);
        }

        // Формируем массив для медиа группы
        const mediaGroup = await this.createMediaGroup(groupMessages);

        if (mediaGroup.length > 0) {
          // Отправляем медиа группу в канал
          // @ts-ignore
          const messages = await ctx.telegram.sendMediaGroup(this.channelZMXGamesId, mediaGroup);
          console.log(`Медиа группа с ID ${mediaGroupId} успешно опубликована.`);
          Logger.blue(`Медиа группа опубликована в канале`)

          // Опционально: обработка отправленных сообщений, например, добавление кнопок
          const sentMessageIds = messages.map((msg) => msg.message_id);
          // @ts-ignore
          await this.sendKeyboard(ctx, sentMessageIds, messages[0].media_group_id);
        }
      } else {
        // Если это не медиа группа, пересылаем сообщения по отдельности
        for (const id of messageIds) {
          await ctx.telegram.copyMessage(this.channelZMXGamesId, ctx.chat!.id, id);
        }
        console.log(`Сообщения с ID ${messageIds} успешно опубликованы.`);
      }

      // Редактируем сообщение с клавиатурой, добавляя информацию об успешной публикации
      await ctx.editMessageText(
        '✅ Сообщение успешно опубликовано в канале.',
        { parse_mode: 'HTML' }
      );

    } catch (error) {
      console.error(`Ошибка при публикации сообщений:`, error);
      await ctx.reply('Произошла ошибка при публикации сообщений.');
    }
  }

  private async handleEdit(ctx: MyContext): Promise<void> {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;

    const newsId = ctx.callbackQuery.data.replace('edit_', '');
    await ctx.reply(
      'Отправьте отредактированный текст новости:',
      { reply_markup: { force_reply: true } }
    );
    ctx.session.editingNewsId = newsId;
  }

  sendOnlineInGames = async (ctx: MyContext) => {
    Logger.log('Получение онлайна игр steam')

    try {
      const gameIds = await getTopSellersIds();

      let message = '<b>🔥 Онлайн популярных игр в Steam:</b>\n\n';

      for (const id of gameIds) {
        try {
          const gameInfo = await getGameInfo(id);
          message += `<b><a href="${gameInfo.urlSteam}">${gameInfo.nameGame}</a></b>\n`;
          message += `🟢 ${formatNumber(gameInfo.currentPlayers)} онлайн\n\n`;
        } catch (error) {
          Logger.red(`Ошибка обработки игры ${id}: ${error}`);
          console.log(`Ошибка обработки игры ${id}:`, error);
        }
      }

      message += `\n📅 <i>${DateHelper.getCurrentDate()}</i>`;

      await ctx.reply(message, {
        parse_mode: 'HTML',
        // @ts-ignore
        disable_web_page_preview: true
      });

      Logger.blue(`Статистика онлайна в играх отправлена в чат`)
    } catch (error) {
      Logger.red(`Ошибка при получении лидеров продаж: ${error}`);
      console.log('Ошибка при получении лидеров продаж:', error);
    }
  };

  private async handleStat(ctx: MyContext): Promise<void> {
    if (ctx.from?.id !== this.adminId) {
      await ctx.reply('У вас нет прав для выполнения этой команды');
      return;
    }

    try {
      Logger.log('Обработка команды /stat');

      // Отправляем сообщение о начале получения статистики
      const statusMessage = await ctx.reply('Получение статистики PM2...');

      // Получаем список процессов
      const processList = await this.pm2Manager.getProcessList();
      const formattedProcessList = this.pm2Manager.formatOutput(processList);

      // Отправляем список процессов
      await ctx.reply(`<b>📊 Список процессов PM2:</b>\n<pre>${formattedProcessList}</pre>`, {
        parse_mode: 'HTML'
      });

      // Получаем логи
      const logs = await this.pm2Manager.getLogs();
      const formattedLogs = this.pm2Manager.formatOutput(logs);

      // Отправляем логи
      await ctx.reply(`<b>📝 Последние логи PM2:</b>\n<pre>${formattedLogs}</pre>`, {
        parse_mode: 'HTML'
      });

      // Обновляем статусное сообщение
      await ctx.telegram.editMessageText(
        ctx.chat!.id,
        statusMessage.message_id,
        undefined,
        '✅ Статистика PM2 успешно получена'
      );

      Logger.green('Команда /stat успешно выполнена');
    } catch (error) {
      Logger.red(`Ошибка при выполнении команды /stat: ${error}`);
      await ctx.reply('❌ Произошла ошибка при получении статистики PM2');
    }
  }

  private async handleDelete(ctx: MyContext): Promise<void> {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;

    const messageIdToDelete = ctx.callbackQuery.data.replace('delete_', '').split("_").map(Number);

    try {
      // Удаляем сообщение с клавиатурой (текущее сообщение)
      await ctx.deleteMessage();

      for (const messageId of messageIdToDelete) {
        try {
          await ctx.telegram.deleteMessage(ctx.chat!.id, messageId);
        } catch (err) {
          console.error(`Ошибка удаления сообщения ${messageId}:`, err);
        }
      }

      Logger.green(`Сообщения с ID ${messageIdToDelete} и клавиатура удалены`);
    } catch (error) {
      Logger.red(`Ошибка при удалении сообщения: ${error}`);
      await ctx.reply('Ошибка при удалении сообщения');
    }
  }

  public async start(): Promise<void> {
    try {
      await this.bot.launch();
      Logger.green('ZMX iQuill Bot запущен');
    } catch (error) {
      console.error('Ошибка запуска бота:', error);
      await this.restart();
    }
  }

  public async stop(reason: string): Promise<void> {
    if (this.newsCheckInterval) {
      clearInterval(this.newsCheckInterval);
    }
    Logger.red(`Остановка бота по причине: ${reason}`);
    this.bot.stop(reason);
  }

  public async restart(): Promise<void> {
    await this.stop('RESTART');
    Logger.red('Перезапуск бота через 10 секунд...');
    setTimeout(async () => {
      this.bot = new Telegraf<MyContext>(process.env.ZMX_QUILL_BOT!);
      this.initializeBot();
      await this.start();
    }, 10000);
  }
}

const steamNewsBot = new BotQuill();
steamNewsBot.start();