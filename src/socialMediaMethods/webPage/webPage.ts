import { Logger } from "../../utils/Logger";
import { Browser, chromium, Page } from 'playwright';
import { ScreenshotResponseType, ViewportSizeType } from "./typos/webPageTypos";

/** Метод для получения скриншота веб-страницы
 @param url - принимает URL любого сайта
 @return Promise<ScreenshotResponse> - Promise с данными скриншота */
export async function getPageScreenshot(url: string): Promise<ScreenshotResponseType> {
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    browser = await chromium.launch();
    page = await browser.newPage();

    const viewport: ViewportSizeType = {
      width: 1024,
      height: 1350
    };

    await page.setViewportSize(viewport);

    try {
      await page.goto(url);

      await Promise.race([
        Promise.all([
          page.waitForLoadState('domcontentloaded'),
          page.waitForLoadState('load'),
          page.waitForLoadState('networkidle'),
        ]),
        // Таймаут как fallback если что-то зависнет
        new Promise(resolve => setTimeout(resolve, 30000))
      ]);
    } catch (timeoutError) {
      Logger.log('Истекло время ожидания загрузки страницы, продолжаем делать частичный снимок экрана страницы');
    }

    await page.waitForTimeout(5000);

    const screenshot: Buffer = await page.screenshot({
      type: 'png',
      // fullPage: true
    });

    return {
      status: 'success',
      screenshot
    };
  } catch (error) {
    console.error('Error getting screenshot:', error);
    throw error;
  } finally {
    await page?.close();
    await browser?.close();
  }
}
