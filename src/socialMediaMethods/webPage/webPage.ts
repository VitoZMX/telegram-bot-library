import { chromium } from 'playwright';
import { Logger } from "../../utils/Logger";

interface ScreenshotResponse {
  status: string;
  screenshot: string; // Base64 строка изображения
}

/** Метод для получения скриншота веб-страницы
 @param url - принимает URL любого сайта
 @return ScreenshotResponse - данные скриншота
 */
export async function getPageScreenshot(url: string): Promise<ScreenshotResponse> {
  try {
    // Запускаем браузер
    const browser = await chromium.launch();
    const page = await browser.newPage(); // Создаем новую страницу
    await page.setViewportSize({ width: 1024, height: 1350 }); // Устанавливаем viewport

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }); // Переходим по URL
    } catch (timeoutError) {
      Logger.log('Истекло время ожидания загрузки страницы, продолжаем делать частичный снимок экрана страницы');
    }

    const screenshot = await page.screenshot({
      type: 'png',
      // fullPage: true
    });

    await browser.close(); // Закрываем браузер
    return {
      status: 'success',
      screenshot: screenshot.toString('base64')
    };
  } catch (error) {
    console.error('Error getting screenshot:', error);
    throw error;
  }
}
