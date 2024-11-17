import { Message } from 'telegraf/types';
import { Logger } from "../../utils/Logger";
import { Markup, Telegraf } from 'telegraf';
import { MyContext } from "./types/ZMXQuillBotType";
import { formatNumber } from "../../utils/formatNumber";
import { SteamNewsItem } from "../../socialMediaMethods/steam/steamNews/typos/steamNewsType";
import { getGameInfo, getTopSellersIds } from "../../socialMediaMethods/steam/steamGameInfo/steamGameInfo";

require('dotenv').config({ path: '.env.tokens' });

class BotQuill {
  private bot: Telegraf<MyContext>;
  private readonly adminId: number;
  private readonly channelZMXGamesId: string;
  private readonly channelZMXGamesName: string;
  private newsCheckInterval: NodeJS.Timeout | null = null;
  private lastCheckedNews: Set<string> = new Set();
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
    this.bot.on('message', (ctx) => this.handleMessage(ctx));
    // this.bot.on('channel_post', (ctx) => this.handleChannelPost(ctx)); // ToDo Метод должен был получать посты из каналов и отправлять их в ЛС но в канал их не добавить
  }

  private addToQueue(ctx: MyContext, messageId: string): void {
    this.messageQueue.push({ ctx, messageId });
    Logger.log(`Сообщение добавлено в очередь c id: [${messageId}]`);
    this.processQueue();
  }

  // Метод для пересылки из канала в ЛС
  private async handleChannelPost(ctx: MyContext): Promise<void> {
    if (!ctx.channelPost || !('text' in ctx.channelPost)) return;

    // Получаем username канала (без символа @)
    const channelUsername = ctx.channelPost.chat.username;
    const targetChannel = this.channelZMXGamesName.replace('@', '');

    console.log('Получен пост из канала:', channelUsername);
    console.log('Целевой канал:', targetChannel);

    // Проверяем, совпадает ли username канала с целевым
    if (channelUsername === targetChannel) {
      const text = ctx.channelPost.text.toLowerCase();

      if (text.includes('обновление') && text.includes('размер')) {
        try {
          await this.bot.telegram.forwardMessage(
            this.adminId,
            ctx.channelPost.chat.id,
            ctx.channelPost.message_id
          );
          Logger.green('Сообщение об обновлении переслано администратору');
        } catch (error) {
          Logger.red('Ошибка при пересылке сообщения об обновлении');
          console.error(error);
        }
      }
    }
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
    if (!ctx.message) return;
    await this.sendGameInfo(ctx);
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

  private async checkNews(): Promise<void> {
    try {
      if (this.lastCheckedNews.size > 100) {
        const values = Array.from(this.lastCheckedNews);
        this.lastCheckedNews = new Set(values.slice(-50));
      }
    } catch (error) {
      console.log('Ошибка при проверке новостей:', error);
    }
  }

  private formatNewsMessage(news: SteamNewsItem): string {
    const date = new Date(news.date * 1000).toLocaleString();
    return `
<b>${news.title}</b>

${news.contents}

📅 ${date}
👤 ${news.author}
🔗 <a href="${news.url}">Подробнее</a>
`;
  }

// Метод с циклом по массиву id
//   sendGameInfo = async (ctx: any) => {
//     try {
//       const gameIds = await getTopSellersIds();
//
//       for (const id of gameIds) {
//         try {
//           const gameInfo = await getGameInfo(id);
//           const formattedDate = new Date().toLocaleString('ru-RU', {
//             year: 'numeric',
//             month: 'long',
//             day: 'numeric',
//             hour: 'numeric',
//             minute: 'numeric',
//           });
//
//           const message = `
// <b>Игра:</b> ${gameInfo.nameGame} \n
// <b>Описание:</b> ${gameInfo.description} \n\n
// <b>🟢 Онлайн:</b> ${formatNumber(gameInfo.currentPlayers)} \n
//
// 📅 <i>${formattedDate}</i>
//                 `;
//
//           if (gameInfo.urlImg) {
//             await ctx.replyWithPhoto(gameInfo.urlImg, {
//               caption: message,
//               parse_mode: 'HTML'
//             });
//           } else {
//             await ctx.reply(message, { parse_mode: 'HTML' });
//           }
//
//           // Добавляем задержку между сообщениями, чтобы избежать флуда
//           await new Promise(resolve => setTimeout(resolve, 1000));
//
//         } catch (error) {
//           console.log(`Error processing game ${id}:`, error);
//           continue; // Продолжаем со следующей игрой даже если текущая вызвала ошибку
//         }
//       }
//     } catch (error) {
//       console.log('Error getting top sellers:', error);
//     }
//   };

  // Метод для публикации одного сообщения о игре по id
//   sendGameInfo = async (ctx: any) => {
//     const gameInfo = await getGameInfo(2073850);
//     const formattedDate = new Date().toLocaleString('ru-RU', {
//       year: 'numeric',
//       month: 'long',
//       day: 'numeric',
//       hour: 'numeric',
//       minute: 'numeric',
//     });
//
//     const message = `
// <b>Игра:</b> ${gameInfo.nameGame} \n
// <b>Описание:</b> ${gameInfo.description} \n\n
// <b>🟢 Онлайн:</b> ${formatNumber(gameInfo.currentPlayers)} \n
//
// 📅 <i>${formattedDate}</i>
//     `;
//
//     try {
//       if (gameInfo.urlImg) {
//         await ctx.replyWithPhoto(gameInfo.urlImg, {
//           caption: message,
//           parse_mode: 'HTML'
//         });
//       } else {
//         await ctx.reply(message, { parse_mode: 'HTML' });
//       }
//     } catch (error) {
//       console.log(error);
//     }
//   };

  sendGameInfo = async (ctx: any) => {
    try {
      const gameIds = await getTopSellersIds();
      const formattedDate = new Date().toLocaleString('ru-RU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
      });

      let message = '<b>🔥 Онлайн популярных игр в Steam:</b>\n\n';

      for (const id of gameIds) {
        try {
          const gameInfo = await getGameInfo(id);
          message += `<b><a href="${gameInfo.urlSteam}">${gameInfo.nameGame}</a></b>\n`;
          message += `🟢 ${formatNumber(gameInfo.currentPlayers)} онлайн\n\n`;
        } catch (error) {
          console.log(`Error processing game ${id}:`, error);
          continue;
        }
      }

      message += `\n📅 <i>${formattedDate}</i>`;

      await ctx.reply(message, {
        parse_mode: 'HTML',
        disable_web_page_preview: true
      });

    } catch (error) {
      console.log('Error getting top sellers:', error);
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

  private startNewsCheck(): void {
    if (this.newsCheckInterval) {
      clearInterval(this.newsCheckInterval);
    }
    this.newsCheckInterval = setInterval(() => this.checkNews(), 5 * 60 * 1000);
  }

  public async start(): Promise<void> {
    try {
      await this.bot.launch();
      console.log('Steam News Bot запущен');
      Logger.green('Начал отслеживать сообщения в канале CS2');
      await this.checkNews();
      this.startNewsCheck();
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
    await this.bot.stop(reason);
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