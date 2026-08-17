import {Readable} from "stream";
import {Logger} from "../../utils/Logger";
import {sleep} from "../../scripts/helpers";
import {Context, Input, Telegraf} from 'telegraf';
import {formatNumber} from "../../utils/formatNumber";
import {StringHelper} from "../../utils/stringHelper";
import {InputMediaPhoto} from "@telegraf/types/methods";
import {LinkPattern, QueueTask} from "./types/ZMXCaretakerBotType";
import {getPageScreenshot} from "../../socialMediaMethods/webPage/webPage";
import {getInstagramVideo} from "../../socialMediaMethods/instagram/instagram";
import {getMistralResponse} from "../../socialMediaMethods/assistants/mistral/mistral";
import {textToAudioVoiceBuffer} from "../../socialMediaMethods/textToAudio/textToAudio";
import {ScreenshotResponseType} from "../../socialMediaMethods/webPage/typos/webPageTypos";
import {getTikTokInfo, getTikTokVideoStream} from "../../socialMediaMethods/TikTok/tikTok";
import HuggingFaceChatBot from "../../socialMediaMethods/assistants/huggingface/huggingFace";
import {getYouTubeShortsVideoBuffer} from "../../socialMediaMethods/youTubeShorts/youTubeShorts";

require('dotenv').config({ path: '.env.tokens' });

enum LinkType {
  TIKTOK = 'TIKTOK',
  INSTAGRAM = 'INSTAGRAM',
  YOUTUBE_SHORTS = 'YOUTUBE_SHORTS',
  WEBPAGE = 'WEBPAGE',
  BOT_MENTION = 'BOT_MENTION',
}

class ZMXCaretakerBot {
  private readonly MAX_CONCURRENT_TASKS: number = 3;

  private readonly tiktokUrlRegex = /(https?:\/\/)?(vt\.|vm\.|www\.|m\.)?tiktok\.com\/[@A-Za-z0-9_\-.\/]+/i;
  private readonly instagramReelsRegex = /(https?:\/\/)?(www\.|m\.)?instagram\.com\/.*/i;
  private readonly youTubeShortsRegex = /https?:\/\/(?:www\.)?youtube\.com\/shorts\/[\w-]+(?:\?[^\s]*)?/i;
  private readonly webPageUrlRegex = /https?:\/\/(www\.)?[a-zA-Z0-9-._~:/?#\[\]@!$&'()*+,;=]{2,}/gi;
  private readonly botMentionRegex = /^@zmx_caretaker_bot\s+.+/i;

  private messageQueue: QueueTask[] = [];
  private linkPatterns: Map<LinkType, LinkPattern> = new Map();
  private activeTasks: number = 0;
  private isProcessing: boolean = false;
  private bot: Telegraf;

  constructor() {
    const { Telegraf } = require('telegraf');
    this.bot = new Telegraf(process.env.ZMX_CARETAKER_BOT);
    this.initializeLinkPatterns();
    this.initializeBot();

    Logger.cyan(`🚀 Бот запущен с максимальным количеством параллельных потоков: ${this.MAX_CONCURRENT_TASKS}`);
  }

  private initializeLinkPatterns(): void {
    this.linkPatterns.set(LinkType.BOT_MENTION, {
      regex: this.botMentionRegex,
      processor: this.chatServiceBotMention.bind(this)
    });

    this.linkPatterns.set(LinkType.TIKTOK, {
      regex: this.tiktokUrlRegex,
      processor: this.chatServiceWithTikTokVideo.bind(this)
    });

    this.linkPatterns.set(LinkType.INSTAGRAM, {
      regex: this.instagramReelsRegex,
      processor: this.chatServiceWithInstagramReelsVideo.bind(this)
    });

    this.linkPatterns.set(LinkType.YOUTUBE_SHORTS, {
      regex: this.youTubeShortsRegex,
      processor: this.chatServiceWithYouTubeShortsVideo.bind(this)
    });

    this.linkPatterns.set(LinkType.WEBPAGE, {
      regex: this.webPageUrlRegex,
      processor: this.chatServiceWithWebPageUrl.bind(this)
    });
  }

  private initializeBot(): void {
    this.bot.command('party', (ctx) => this.sendPartyPoll(ctx));

    this.bot.on('message', async (ctx: Context) => {
      const messageId = `${ctx.message?.message_id}-${ctx.message?.chat.id}`;
      this.addToQueue(ctx, messageId);
    });
  }

  private addToQueue(ctx: Context, messageId: string): void {
    this.messageQueue.push({ ctx, messageId, timestamp: Date.now() });
    Logger.log(`📥 Сообщение добавлено в очередь. ID: [${messageId}]. Очередь: ${this.messageQueue.length}`);
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    // Проверяем, не достигнут ли лимит активных задач
    if (this.activeTasks >= this.MAX_CONCURRENT_TASKS) {
      Logger.log(`⏳ Достигнут лимит потоков (${this.MAX_CONCURRENT_TASKS}). Ожидание...`);
      return;
    }

    // Если очередь пуста, останавливаем обработку
    if (this.messageQueue.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;

    // Запускаем задачи, пока есть свободные потоки и очередь не пуста
    while (this.activeTasks < this.MAX_CONCURRENT_TASKS && this.messageQueue.length > 0) {
      const task = this.messageQueue.shift()!;
      this.activeTasks++;

      Logger.cyan(`🔄 Запуск задачи [${task.messageId}]. Активных потоков: ${this.activeTasks}/${this.MAX_CONCURRENT_TASKS}`);

      // Запускаем задачу асинхронно без await
      this.processTask(task);
    }

    // Если очередь опустела, сбрасываем флаг
    if (this.messageQueue.length === 0) {
      this.isProcessing = false;
    }
  }

  private async processTask(task: QueueTask): Promise<void> {
    const { ctx, messageId } = task;

    try {
      Logger.log(`\n----------------//----------------//----------------//----------------\n`);
      console.log(`▶️ Начало обработки сообщения [${messageId}] в потоке ${this.activeTasks}`);
      await this.handleMessage(ctx, messageId);
      Logger.green(`✅ Завершена обработка [${messageId}]`);
    } catch (error) {
      console.error(`❌ [${messageId}] Ошибка при обработке сообщения:`, error);
    } finally {
      // Уменьшаем счетчик активных задач
      this.activeTasks--;
      Logger.cyan(`🔄 Завершена задача [${messageId}]. Активных потоков: ${this.activeTasks}/${this.MAX_CONCURRENT_TASKS}`);

      // Проверяем, есть ли еще задачи в очереди
      if (this.messageQueue.length > 0) {
        // Используем setImmediate для асинхронного запуска следующей задачи
        setImmediate(() => this.processQueue());
      }

      Logger.log(`\n----------------//----------------//----------------//----------------\n`);
    }
  }

  // Остальные методы остаются без изменений...
  private async getChatInfo(ctx: Context): Promise<{ chatName: string; chatType: string; chatID: number }> {
    const chat = await ctx.getChat();
    let chatName: string;
    const chatType = chat.type;
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

    // Получаем информацию о пользователе из контекста
    const username = ctx.message.from?.username || ctx.message.from?.first_name || 'unknown';
    const botName = `@${this.bot.botInfo?.username}`;

    const dateMessage = new Date(ctx.message.date * 1000).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    const text = ctx.message.text.replace(/[\r\n]+/g, ' ');
    const { chatName, chatType, chatID } = await this.getChatInfo(ctx);

    Logger.magenta('┌ Детали сообщения');
    Logger.magenta(`├ Чат: ${chatName} (${chatType})`);
    Logger.magenta(`├ Дата: ${dateMessage}`);
    Logger.magenta(`├ Пользователь: ${username}`);
    Logger.magenta(`└ Сообщение: ${text}`);

    // Проверяем все паттерны ссылок
    for (const [type, pattern] of this.linkPatterns) {
      const match = text.match(pattern.regex);
      if (match) {
        Logger.yellow(`[${messageId}] В чате найдена ссылка типа ${type}: ${match[0]}`);
        try {
          await pattern.processor(ctx, match[0], messageId, chatID, botName);
        } catch (error) {
          await this.handleError(error, ctx, messageId);
        }
        break; // Прекращаем поиск после первого совпадения
      }
    }
  }

  private createUserMention(ctx: Context): string {
    const user = ctx.message?.from;

    if (!user) {
      return 'unknown';
    }

    const userId = user.id;
    const displayName = user.username || user.first_name || 'unknown';

    return `<a href="tg://user?id=${userId}">${displayName}</a>`;
  }

  private async chatServiceBotMention(
    ctx: Context,
    url: string,
    messageId: string,
    chatID: number,
    botName?: string
  ): Promise<void> {
    // Ранняя валидация входных данных
    if (!ctx.message || !('text' in ctx.message) || !botName) return;

    const text = ctx.message.text || '';
    const processedText = text.replaceAll(botName, '').trim();

    // Проверяем, начинается ли сообщение с упоминания бота
    if (!text.startsWith(botName) || !ctx.message?.message_id) return;
    Logger.log(`Сформированный текст запроса: "${processedText}"`);

    try {
      // Параллельный запуск с резервным вариантом
      const mistralResponse = await getMistralResponse(processedText)
        .catch(() => null);

      // Если Mistral не вернул результат, пробуем HuggingFace
      const responseText = mistralResponse?.trim() ||
        await new HuggingFaceChatBot().generateResponse(processedText)
          .catch(() => null);

      // Если ни один сервис не вернул ответ, бросаем ошибку
      if (!responseText) {
        throw new Error('Не удалось получить ответ от AI');
      }

      // Отправка ответа
      try {
        const maxLengthMess: number = 333;
        const codeInText: boolean = responseText.includes('```');
        let audioBuffer: Buffer | undefined;

        console.log(`Длинна ответа ${responseText.length}, максимум: ${maxLengthMess} и в ней ${codeInText} элемент кода`)

        if (responseText.length <= maxLengthMess || !codeInText) {
          audioBuffer = await textToAudioVoiceBuffer(responseText)
        } else {
          Logger.log(`Текст ответа не будет преобразован в аудио`);
        }

        if (audioBuffer) {
          await ctx.replyWithVoice({
            source: audioBuffer
          }, {
            caption: StringHelper.escapeMarkdown(responseText),
            parse_mode: 'MarkdownV2'
          });
          Logger.blue(`[${messageId}] Ответ с аудио успешно отправлен`);
        } else {
          await ctx.replyWithMarkdownV2(StringHelper.escapeMarkdown(responseText));
          Logger.blue(`[${messageId}] Ответ текстом успешно отправлен`);
        }
      } catch (replyError) {
        Logger.red(`[${messageId}] Не удалось отправить сообщение, попытка резервного отправления`);

        // Резервный вариант отправки
        await ctx.reply(responseText, {
          disable_notification: true
        });
        Logger.blue(`[${messageId}] Резервное сообщение отправлено в чат`)
      }
    } catch (error) {
      Logger.red(`[${messageId}] Не удалось получить ответ от AI`);
      await ctx.reply('Извините, сейчас я не могу ответить. Попробуйте позже!', {
        disable_notification: true
      });
      Logger.blue(`[${messageId}] Уведомление о невозможности ответить отправлено в чат`);
    }
  }

  private async chatServiceWithTikTokVideo(
    ctx: Context,
    url: string,
    messageId: string,
  ): Promise<void> {
    const tilTokData = await getTikTokInfo(url).then((res) => res.data);
    const tilTokUrl = tilTokData.play;
    const tilTokAuthor = tilTokData.author.nickname;
    const tilTokPlayCount = tilTokData.play_count;
    const tilTokLikeCount = tilTokData.digg_count;
    const tilTokCommentCount = tilTokData.comment_count;
    const textDescriptionTikTokPost = `🎥 Автор: «${tilTokAuthor}»\n👀 Просмотров: ${formatNumber(tilTokPlayCount)}\n🤍️ Лайков: ${formatNumber(tilTokLikeCount)}\n💬 Комментариев: ${formatNumber(tilTokCommentCount)}`
    console.log(`[${messageId}] URL TikTok получен:`, tilTokUrl);
    console.log(`[${messageId}] TikTok информация: \n${textDescriptionTikTokPost}`);

    try {
      await ctx.deleteMessage();
      Logger.log(`[${messageId}] Исходное сообщение удалено`);
      const userMention = this.createUserMention(ctx);
      await ctx.reply(`${userMention} TikTok ссылка удалена`, {
        disable_notification: true,
        parse_mode: 'HTML'
      });
      Logger.blue(`[${messageId}] Уведомление об удалении ссылки отправлено в чат`);
    } catch (error) {
      Logger.red(`[${messageId}] Не удалось удалить сообщение: недостаточно прав.`);
      // Продолжаем выполнение без удаления сообщения
    }

    // Проверка наличия картинок из поста
    if (tilTokData.images) {
      try {
        // Разбиваем массив картинок на группы по 10 штук
        const chunkSize = 10;
        const imageChunks = [];

        for (let i = 0; i < tilTokData.images.length; i += chunkSize) {
          imageChunks.push(tilTokData.images.slice(i, i + chunkSize));
        }

        // Обрабатываем каждую группу картинок
        for (let i = 0; i < imageChunks.length; i++) {
          const mediaGroup: InputMediaPhoto<string>[] = imageChunks[i].map((url: string) => ({
            type: 'photo',
            media: url,
          }));

          // Добавляем caption только к первой группе
          if (i === 0) {
            mediaGroup[0] = {
              ...mediaGroup[0],
              caption: textDescriptionTikTokPost,
              parse_mode: 'HTML'
            };
          }

          try {
            await ctx.replyWithMediaGroup(mediaGroup);
            Logger.blue(`[${messageId}] Отправлена группа ${i + 1} из ${imageChunks.length} с ${mediaGroup.length} изображениями`);
          } catch (error: any) {

            if (error?.response?.parameters?.retry_after) {
              const retryAfter = error.response.parameters.retry_after;
              Logger.red(`[${messageId}] Ошибка. Ждём ${retryAfter} секунд перед повторной попыткой...`);
              await sleep(retryAfter * 1000);

              await ctx.replyWithMediaGroup(mediaGroup);
              Logger.blue(`[${messageId}] Отправлена группа ${i + 1} из ${imageChunks.length} с ${mediaGroup.length} изображениями`);

            } else {
              Logger.red(`[${messageId}] Ошибка отправки медиа групп TikTok: ${error}`);
              throw error;
            }
          }

          // Задержка между группами
          await sleep(7000);
        }

        Logger.blue(`[${messageId}] Все медиа группы с TikTok успешно отправлены в чат`);
      } catch (error) {
        Logger.red(`[${messageId}] Ошибка отправки медиа групп TikTok: ${error}`);
        console.error(error);
      }
    }

    // Определяем тип файла по расширению
    if (tilTokUrl.toLowerCase().endsWith('.mp3')) {
      await ctx.sendAudio(tilTokUrl, {
        disable_notification: true
      });
      Logger.blue(`[${messageId}] Аудио отправлено в чат`);
    } else {
      try {
        await ctx.sendVideo(tilTokUrl, {
          disable_notification: true,
          caption: textDescriptionTikTokPost
        });
      } catch {
        /* Обработка когда видео могло не отправиться из-за большого объема потока */
        Logger.log(`[${messageId}] Попытка отправить видео через поток`);
        let tikTokVideoStream: Readable | null = await getTikTokVideoStream(tilTokUrl)
        const videoInputFile = { source: tikTokVideoStream as Readable };

        try {
          await ctx.sendMediaGroup([
            {
              type: 'video',
              media: videoInputFile,
              supports_streaming: true,
              caption: textDescriptionTikTokPost,
              parse_mode: 'HTML'
            }])
          Logger.blue(`[${messageId}] Видео отправлено в чат`);
        } finally {
          // Очищаем поток после использования
          if (tikTokVideoStream && tikTokVideoStream.destroy) {
            tikTokVideoStream.destroy();
            tikTokVideoStream = null;
          }
        }
      }
    }
    Logger.green(`[${messageId}] Обработка ссылки TikTok завершено УСПЕШНО!`);
  }

  private async chatServiceWithInstagramReelsVideo(
    ctx: Context,
    url: string,
    messageId: string,
  ): Promise<void> {
    let instagramReelsStream: Readable | null = null;

    try {
      instagramReelsStream = await getInstagramVideo(url);
      if (typeof instagramReelsStream?.pipe === 'function') {
        console.log(`[${messageId}] Поток Instagram Reels получен`);
      }

      try {
        await ctx.deleteMessage();
        Logger.log(`[${messageId}] Исходное сообщение удалено`);
        const userMention = this.createUserMention(ctx);
        await ctx.reply(`${userMention} Instagram ссылка удалена`, {
          disable_notification: true,
          parse_mode: 'HTML'
        });
        Logger.blue(`[${messageId}] Уведомление об удалении Instagram ссылки отправлено в чат`);
      } catch (error) {
        Logger.red(`[${messageId}] Не удалось удалить сообщение: недостаточно прав.`);
        // Продолжаем выполнение без удаления сообщения
      }

      await ctx.sendVideo(
        Input.fromReadableStream(instagramReelsStream),
        {
          width: 720,
          height: 1280,
          supports_streaming: true,
        }
      );
      Logger.blue(`[${messageId}] Видео отправлено в чат`);

    } catch (error) {
      console.error('Ошибка получения ссылки Instagram Reels:', error);

      await ctx.reply('Не удаётся открыть видео', {
        // @ts-ignore
        reply_to_message_id: ctx.message.message_id,
      });
      Logger.blue(`[${messageId}] Уведомление о неудаче получения видео отправлено в чат`);
    } finally {
      if (instagramReelsStream && typeof instagramReelsStream.destroy === 'function') {
        instagramReelsStream.destroy();
        instagramReelsStream = null;
      }
    }

    Logger.green(`[${messageId}] Обработка ссылки Instagram Reels завершено УСПЕШНО!`);
  }

  private async chatServiceWithYouTubeShortsVideo(
    ctx: Context,
    url: string,
    messageId: string,
  ): Promise<void> {
    try {
      console.log(`[${messageId}] Начало обработки YouTube Shorts: ${url}`);

      const { buffer, info } = await getYouTubeShortsVideoBuffer(url);
      const captionParts = [
        info.title ? `🎬 Название: ${info.title}` : null,
        info.uploader ? `👤 Канал: ${info.uploader}` : null,
        info.view_count ? `👀 Просмотров: ${formatNumber(info.view_count)}` : null,
        info.like_count ? `🤍 Лайков: ${formatNumber(info.like_count)}` : null,
      ].filter(Boolean);
      const caption = captionParts.join('\n');

      console.log(`[${messageId}] YouTube Shorts обработан, размер: ${buffer.length} байт`);

      try {
        await ctx.deleteMessage();
        Logger.log(`[${messageId}] Исходное сообщение удалено`);
        const userMention = this.createUserMention(ctx);
        await ctx.reply(`${userMention} YouTube Shorts ссылка удалена`, {
          disable_notification: true,
          parse_mode: 'HTML'
        });
        Logger.blue(`[${messageId}] Уведомление об удалении YouTube Shorts ссылки отправлено в чат`);
      } catch (error) {
        Logger.red(`[${messageId}] Не удалось удалить сообщение: недостаточно прав.`);
      }

      await ctx.sendVideo(
        Input.fromBuffer(buffer, 'youtube_short.mp4'),
        {
          supports_streaming: true,
          caption: caption || undefined,
          width: 720,
          height: 1280,
          parse_mode: 'HTML',
          disable_notification: true,
        }
      );
      Logger.blue(`[${messageId}] YouTube Shorts видео отправлено в чат`);
    } catch (error) {
      console.error(`[${messageId}] Ошибка получения YouTube Shorts:`, error);

      await ctx.reply('Не удаётся открыть видео', {
        // @ts-ignore
        reply_to_message_id: ctx.message?.message_id,
      });
      Logger.blue(`[${messageId}] Уведомление о неудаче получения YouTube Shorts отправлено в чат`);
      return;
    }

    Logger.green(`[${messageId}] Обработка ссылки YouTube Shorts завершено УСПЕШНО!`);
  }

  private async chatServiceWithWebPageUrl(
    ctx: Context,
    url: string,
    messageId: string,
  ): Promise<void> {

    try {
      console.log(`[${messageId}] Начало обработки скриншота для ${url}`);

      const screenshotData: ScreenshotResponseType = await getPageScreenshot(url);
      Logger.log(`[${messageId}] Скриншот создан`);

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
          Logger.log(`[${messageId}] Не удалось ответить на исходное сообщение, отправляю новым сообщением`);
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

      Logger.blue(`[${messageId}] Скриншот отправлен в чат`);
      Logger.green(`[${messageId}] Обработка ссылки WebPage завершена УСПЕШНО!`);
    } catch (error) {
      Logger.red(`[${messageId}] Ошибка при обработке WebPage: ${error}`);
    }
  }

  async sendPartyPoll(ctx: Context) {
    try {
      await ctx.sendPoll('🚨🚨🚨 Объявлен сбор 🚨🚨🚨', [
        '✅ Приду',
        '❌ Не приду',
        '⏰ Опоздаю',
        '🔩 Посмотрю на ваше поведение'
      ], {
        is_anonymous: false,
        allows_multiple_answers: false,
      });
      Logger.blue(`Опрос на сбор отправлен в чат`);
    } catch (error) {
      Logger.red(`Ошибка отправки опроса в чат`);
      console.error('Ошибка при отправке опроса:', error);
    }
  }

  private async handleError(error: any, ctx: Context, messageId: string): Promise<void> {
    Logger.red(`[${messageId}] Ошибка: ${error.message}`);
    console.log(error);

    await ctx.reply('Произошла ошибка', { disable_notification: true });
    Logger.blue(`[${messageId}] В чат отправлено сообщение об ошибке`)

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