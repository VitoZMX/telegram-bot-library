import { Logger } from "../../utils/Logger";
import { Context, Telegraf } from 'telegraf';
import { LinkPattern } from "./types/ZMXCaretakerBotType";
import { getTikTokInfo } from "../../socialMediaMethods/TikTok/tikTok";
import { getPageScreenshot } from "../../socialMediaMethods/webPage/webPage";
import { getInstagramVideoUrl } from "../../socialMediaMethods/instagram/instagram";
import { ScreenshotResponseType } from "../../socialMediaMethods/webPage/typos/webPageTypos";

require('dotenv').config({ path: '.env.tokens' });

enum LinkType {
  TIKTOK = 'TIKTOK',
  INSTAGRAM = 'INSTAGRAM',
  WEBPAGE = 'WEBPAGE',
}

class ZMXCaretakerBot {
  private readonly tiktokUrlRegex = /(https?:\/\/)?(vm\.|www\.|m\.)?tiktok\.com\/[@A-Za-z0-9_\-.\/]+/i;
  private readonly instagramReelsRegex = /(https?:\/\/)?(www\.|m\.)?instagram\.com\/(reels?|reel)\/([\w\-.]+)(\/?\?[^\/]*)?/i;
  private readonly webPageUrlRegex = /https?:\/\/(www\.)?[a-zA-Z0-9-._~:/?#\[\]@!$&'()*+,;=]{2,}/gi;
  private messageQueue: { ctx: Context; messageId: string }[] = [];
  private linkPatterns: Map<LinkType, LinkPattern> = new Map();
  private isProcessing: boolean = false;
  private bot: Telegraf;

  constructor() {
    const { Telegraf } = require('telegraf');
    this.bot = new Telegraf(process.env.ZMX_CARETAKER_BOT);
    this.initializeLinkPatterns();
    this.initializeBot();
  }

  private initializeLinkPatterns(): void {
    this.linkPatterns.set(LinkType.TIKTOK, {
      regex: this.tiktokUrlRegex,
      processor: this.chatServiceWithTikTokVideo.bind(this)
    });

    this.linkPatterns.set(LinkType.INSTAGRAM, {
      regex: this.instagramReelsRegex,
      processor: this.chatServiceWithInstagramReelsVideo.bind(this)
    });

    this.linkPatterns.set(LinkType.WEBPAGE, {
      regex: this.webPageUrlRegex,
      processor: this.chatServiceWithWebPageUrl.bind(this)
    });
  }

  private initializeBot(): void {
    this.bot.on('message', async (ctx: Context) => {
      const messageId = `${ctx.message?.message_id}-${Date.now()}`;
      this.addToQueue(ctx, messageId);
    });
  }

  private addToQueue(ctx: Context, messageId: string): void {
    this.messageQueue.push({ ctx, messageId });
    console.log(`[${messageId}] Сообщение добавлено в очередь. Размер очереди: ${this.messageQueue.length}`);
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.messageQueue.length === 0) return;

    this.isProcessing = true;

    while (this.messageQueue.length > 0) {
      const { ctx, messageId } = this.messageQueue[0];
      try {
        console.log(`[${messageId}] ----------------//----------------`);
        console.log(`[${messageId}] Начало обработки ${this.messageQueue.length} сообщения из очереди`);
        await this.handleMessage(ctx, messageId);
      } catch (error) {
        console.error(`[${messageId}] Ошибка при обработке сообщения из очереди:`, error);
      }
      this.messageQueue.shift(); // Удаляем обработанное сообщение из очереди
      Logger.yellow(`Сообщений в очереди: ${this.messageQueue.length}`);

      console.log(`[${messageId}] ----------------//----------------`);
    }

    this.isProcessing = false;
  }

  private async getChatInfo(ctx: Context): Promise<{ chatName: string; chatType: string; chatID: number }> {
    const chat = await ctx.getChat();
    let chatName: string;
    const chatType = chat.type; // 'private', 'group', 'supergroup', или 'channel'
    const chatID = chat.id;

    switch (chat.type) {
      case 'private':
        chatName = (chat as any).first_name || 'Private Chat';
        break;
      case 'group':
      case 'supergroup':
        chatName = (chat as any).title || 'Group Chat';
        break;
      case 'channel':
        chatName = (chat as any).title || 'Channel';
        break;
      default:
        chatName = 'Unknown Chat';
    }

    return { chatName, chatType, chatID };
  }

  private async handleMessage(ctx: Context, messageId: string): Promise<void> {
    if (!ctx.message || !('text' in ctx.message)) return;

    const text = ctx.message.text;
    const userName = ctx.message.from.username || ctx.message.from.first_name;
    const { chatName, chatType, chatID } = await this.getChatInfo(ctx);

    Logger.magenta(`[${messageId}] Чат: ${chatName} (${chatType})`);
    Logger.magenta(`[${messageId}] Пользователь: ${userName}`);
    Logger.magenta(`[${messageId}] Сообщение: ${text}`);

    // Проверяем все паттерны ссылок
    for (const [type, pattern] of this.linkPatterns) {
      const match = text.match(pattern.regex);
      if (match) {
        Logger.yellow(`[${messageId}] В чате найдена ссылка типа ${type}: ${match[0]}`);
        try {
          await pattern.processor(ctx, match[0], userName, messageId, chatID);
        } catch (error) {
          await this.handleError(error, ctx, messageId);
        }
        break; // Прекращаем поиск после первого совпадения
      }
    }
  }

  private async chatServiceWithTikTokVideo(
    ctx: Context,
    url: string,
    username: string,
    messageId: string,
  ): Promise<void> {
    const tilTokData = await getTikTokInfo(url).then((res) => res.data);
    const tilTokUrl = tilTokData.play;
    const tilTokAuthor = tilTokData.author.nickname;
    console.log(`[${messageId}] URL TikTok получен:`, tilTokUrl);
    console.log(`[${messageId}] Автор TikTok получен:`, tilTokAuthor);

    await ctx.deleteMessage();
    Logger.log(`[${messageId}] Исходное сообщение удалено`);

    await ctx.reply(`@${username} ссылка удалена`, { disable_notification: true });
    Logger.blue(`[${messageId}] Уведомление об удалении ссылки отправлено в чат`);

    // Определяем тип файла по расширению
    if (tilTokUrl.toLowerCase().endsWith('.mp3')) {
      await ctx.sendAudio(tilTokUrl, {
        disable_notification: true
      });
      Logger.blue(`[${messageId}] Аудио отправлено в чат`);
    } else {
      await ctx.sendVideo(tilTokUrl, {
        disable_notification: true,
        caption: `Автор видео: «${tilTokAuthor}»`
      });

      Logger.blue(`[${messageId}] Видео отправлено в чат`);
    }

    Logger.green(`[${messageId}] Обработка ссылки TikTok завершено УСПЕШНО!`);
  }

  private async chatServiceWithInstagramReelsVideo(
    ctx: Context,
    url: string,
    username: string,
    messageId: string,
  ): Promise<void> {

    try {
      const instagramReelsUrl = await getInstagramVideoUrl(url);
      console.log(`[${messageId}] URL Instagram Reels получен:`, instagramReelsUrl);

      await ctx.deleteMessage();
      Logger.log(`[${messageId}] Исходное сообщение удалено`);

      await ctx.reply(`@${username} Instagram ссылка удалена`, { disable_notification: true });
      Logger.blue(`[${messageId}] Уведомление об удалении ссылки отправлено в чат`);

      await ctx.sendVideo(instagramReelsUrl, {
        disable_notification: true
      });
      Logger.blue(`[${messageId}] Видео отправлено в чат`);

    } catch (error) {
      console.error('Ошибка получения ссылки Instagram Reels:', error);

      await ctx.reply('Не удаётся открыть видео', {
        // @ts-ignore
        reply_to_message_id: ctx.message.message_id,
      });
      Logger.blue(`[${messageId}] Уведомление о неудаче получения видео отправлено в чат`);
    }

    Logger.green(`[${messageId}] Обработка ссылки Instagram Reels Url завершено УСПЕШНО!`);
  }

  private async chatServiceWithWebPageUrl(
    ctx: Context,
    url: string,
    messageId: string,
  ): Promise<void> {
    const logPrefix = `[${messageId}]`;

    try {
      console.log(`${logPrefix} Начало обработки скриншота для ${url}`);

      const screenshotData: ScreenshotResponseType = await getPageScreenshot(url);
      Logger.log(`${logPrefix} Скриншот создан`);

      const photoOptions = {
        source: screenshotData.screenshot
      };

      if (ctx.message?.message_id) {
        try {
          await ctx.replyWithPhoto(photoOptions, {
            // @ts-ignore
            reply_to_message_id: ctx.message.message_id,
          });
        } catch {
          Logger.log(`${logPrefix} Не удалось ответить на исходное сообщение, отправляю новым сообщением`);
          await ctx.sendPhoto(photoOptions, {
            disable_notification: true,
            caption: `Скриншот станицы: ${url}`
          });
        }
      } else {
        await ctx.sendPhoto(photoOptions, {
          disable_notification: true
        });
      }

      Logger.blue(`${logPrefix} Скриншот отправлен в чат`);
      Logger.green(`${logPrefix} Обработка ссылки WebPage завершена УСПЕШНО!`);
    } catch (error) {
      console.error(`${logPrefix} Ошибка при обработке WebPage:`, error);
      throw new Error(`Ошибка обработки WebPage: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    }
  }

  private async handleError(error: any, ctx: Context, messageId: string): Promise<void> {
    Logger.red(`[${messageId}] Ошибка: ${error.message}`);
    console.log(error);

    await ctx.reply('Произошла ошибка', { disable_notification: true });
    Logger.blue('В чат отправлено сообщение об ошибке')

    if (error.message === 'Promise timeout') {
      Logger.red(`[${messageId}] Обнаружен таймаут, перезапуск бота...`);
      await this.restart();
    }
  }

  public async start(): Promise<void> {
    try {
      await this.bot.launch();
      console.log('Бот запущен');
    } catch (error) {
      console.error('Ошибка запуска бота:', error);
      await this.restart();
    }
  }

  public async stop(reason: string): Promise<void> {
    Logger.red(`Остановка бота по причине: ${reason}`);
    await this.bot.stop(reason);
  }

  public async restart(): Promise<void> {
    await this.stop('RESTART');
    Logger.red('Перезапуск бота через 10 секунд...');
    setTimeout(async () => {
      const { Telegraf } = require('telegraf');
      this.bot = new Telegraf(process.env.ZMX_CARETAKER_BOT);
      this.initializeBot();
      await this.start();
    }, 10000);
  }
}

// Создание и запуск бота
const zmxCaretakerBot = new ZMXCaretakerBot();
zmxCaretakerBot.start();