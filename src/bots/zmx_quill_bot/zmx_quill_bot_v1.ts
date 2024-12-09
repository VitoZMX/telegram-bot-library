import { Message } from 'telegraf/types';
import { Logger } from "../../utils/Logger";
import { Markup, Telegraf } from 'telegraf';
import { MyContext } from "./types/ZMXQuillBotType";
import { DateHelper } from "../../utils/dateHelper";
import { formatNumber } from "../../utils/formatNumber";
import { getGameInfo, getTopSellersIds } from "../../socialMediaMethods/steam/steamGameInfo/steamGameInfo";

require('dotenv').config({ path: '.env.tokens' });

class BotQuill {
  private bot: Telegraf<MyContext>;
  private readonly adminId: number;
  private readonly channelZMXGamesId: string;
  private readonly channelZMXGamesName: string;
  private newsCheckInterval: NodeJS.Timeout | null = null;
  private messageQueue: { ctx: MyContext; messageId: string }[] = [];
  private isProcessing: boolean = false;

  constructor() {
    this.bot = new Telegraf<MyContext>(process.env.ZMX_QUILL_BOT!);
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

  private async handleMessage(ctx: MyContext): Promise<void> {
  }

  private async handlePublish(ctx: MyContext): Promise<void> {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;

    const newsId = ctx.callbackQuery.data.replace('publish_', '');
    const message = ctx.callbackQuery.message as Message.TextMessage;

    try {
      await this.bot.telegram.sendMessage(
        this.channelZMXGamesId,
        message.text,
        { parse_mode: 'HTML' }
      );
      await ctx.editMessageText(
        `${message.text}\n\n✅ Опубликовано в канале`,
        { parse_mode: 'HTML' }
      );
      Logger.green(`Новость ${newsId} опубликована в канале`);
    } catch (error) {
      Logger.red(`Ошибка публикации новости ${newsId}`);
      console.log(`Ошибка публикации новости ${newsId}:`, error);
      await ctx.reply('Ошибка при публикации новости');
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

  private async sendNewsToAdmin(text: string, newsId: string): Promise<void> {
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('Опубликовать', `publish_${newsId}`),
        Markup.button.callback('Редактировать', `edit_${newsId}`),
        Markup.button.callback('Удалить', `delete_${newsId}`)
      ]
    ]);

    await this.bot.telegram.sendMessage(
      this.adminId,
      text,
      {
        parse_mode: 'HTML',
        ...keyboard
      }
    );
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

    } catch (error) {
      Logger.red(`Ошибка при получении лидеров продаж: ${error}`);
      console.log('Ошибка при получении лидеров продаж:', error);
    }
  };

  private async handleDelete(ctx: MyContext): Promise<void> {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;

    try {
      await ctx.deleteMessage();
      Logger.green(`Новость ${ctx.callbackQuery.data.replace('delete_', '')} удалена`);
    } catch (error) {
      Logger.red(`Ошибка при удалении новости: ${error}`);
      await ctx.reply('Ошибка при удалении новости');
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