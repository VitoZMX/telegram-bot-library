import {join} from 'path';
import ffmpeg from 'fluent-ffmpeg';
import YTDlpWrap from 'yt-dlp-wrap';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import {existsSync, mkdirSync} from 'fs';
import {readFile, rm, writeFile} from 'fs/promises';
import {YouTubeFormat, YouTubeShortsVideoResult, YouTubeVideoInfo,} from './types/youTubeShortsType';

if (ffmpegStatic) {
    ffmpeg.setFfmpegPath(ffmpegStatic);
} else {
    console.warn('[YouTubeShorts] ffmpeg-static не найден. Установите зависимости: npm install');
}

if (ffprobeStatic.path) {
    ffmpeg.setFfprobePath(ffprobeStatic.path);
}

const YT_DLP_BIN_DIR = join(__dirname, '../../../.bin');
const YT_DLP_PLATFORM_FILE = join(YT_DLP_BIN_DIR, 'yt-dlp.platform');

/** Метод для получения пути к yt-dlp с учётом текущей ОС
 @return string - путь к бинарнику yt-dlp для Windows или Linux/macOS */
function getYtDlpBinPath(): string {
    const fileName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
    return join(YT_DLP_BIN_DIR, fileName);
}

/** Метод для проверки и загрузки yt-dlp под текущую платформу
 @return string - путь к готовому бинарнику yt-dlp */
async function ensureYtDlpBinary(): Promise<string> {
    const binPath = getYtDlpBinPath();
    mkdirSync(YT_DLP_BIN_DIR, {recursive: true});

    let savedPlatform: string | null = null;

    if (existsSync(YT_DLP_PLATFORM_FILE)) {
        savedPlatform = (await readFile(YT_DLP_PLATFORM_FILE, 'utf-8')).trim();
    }

    const platformChanged = Boolean(savedPlatform && savedPlatform !== process.platform);
    const binaryMissing = !existsSync(binPath);

    if (binaryMissing || platformChanged) {
        if (platformChanged) {
            console.log(`[YouTubeShorts] Платформа изменилась (${savedPlatform} -> ${process.platform}), перекачиваем yt-dlp...`);
            await rm(join(YT_DLP_BIN_DIR, 'yt-dlp'), {force: true}).catch(() => undefined);
            await rm(join(YT_DLP_BIN_DIR, 'yt-dlp.exe'), {force: true}).catch(() => undefined);
        } else {
            console.log(`[YouTubeShorts] Скачивание yt-dlp для ${process.platform}...`);
        }

        await YTDlpWrap.downloadFromGithub(binPath, undefined, process.platform);
        await writeFile(YT_DLP_PLATFORM_FILE, process.platform, 'utf-8');
        console.log(`[YouTubeShorts] yt-dlp успешно загружен: ${binPath}`);
    }

    return binPath;
}

let ytDlpWrapInstance: YTDlpWrap | null = null;

/** Метод для получения или инициализации экземпляра yt-dlp
 @return YTDlpWrap - настроенный экземпляр yt-dlp-wrap с локальным бинарником */
async function getYtDlpWrap(): Promise<YTDlpWrap> {
    if (ytDlpWrapInstance) {
        return ytDlpWrapInstance;
    }

    const binPath = await ensureYtDlpBinary();
    ytDlpWrapInstance = new YTDlpWrap(binPath);
    return ytDlpWrapInstance;
}

/** Метод для проверки, что формат содержит только видео без аудио
 @param format - формат видео из yt-dlp
 @return boolean - true, если формат содержит только видеодорожку */
function isVideoOnlyFormat(format: YouTubeFormat): boolean {
    return Boolean(format.vcodec && format.vcodec !== 'none' && (!format.acodec || format.acodec === 'none'));
}

/** Метод для проверки, что формат содержит видео и аудио в одном файле
 @param format - формат видео из yt-dlp
 @return boolean - true, если формат содержит видео и звук */
function isCombinedFormat(format: YouTubeFormat): boolean {
    return Boolean(format.vcodec && format.vcodec !== 'none' && format.acodec && format.acodec !== 'none');
}

/** Метод для сортировки форматов по убыванию разрешения
 @param formats - список форматов видео
 @return YouTubeFormat[] - отсортированный список форматов от большего разрешения к меньшему */
function sortByHeightDesc(formats: YouTubeFormat[]): YouTubeFormat[] {
    return [...formats].sort((a, b) => {
        const heightDiff = (b.height || 0) - (a.height || 0);
        if (heightDiff !== 0) {
            return heightDiff;
        }

        const aMp4 = a.ext === 'mp4' ? 1 : 0;
        const bMp4 = b.ext === 'mp4' ? 1 : 0;
        return bMp4 - aMp4;
    });
}

/** Метод для сортировки форматов по возрастанию разрешения
 @param formats - список форматов видео
 @return YouTubeFormat[] - отсортированный список форматов от меньшего разрешения к большему */
function sortByHeightAsc(formats: YouTubeFormat[]): YouTubeFormat[] {
    return [...formats].sort((a, b) => (a.height || 0) - (b.height || 0));
}

/** Метод для выбора форматов скачивания YouTube Shorts
 @param formats - список доступных форматов видео
 @return объект с форматами: highVideo - видео в максимальном разрешении, lowVideoWithAudio - видео в низком разрешении со звуком, bestCombined - лучший комбинированный формат */
function pickFormats(formats: YouTubeFormat[]): {
    highVideo: YouTubeFormat | null;
    lowVideoWithAudio: YouTubeFormat | null;
    bestCombined: YouTubeFormat | null;
} {
    const videoOnly = sortByHeightDesc(formats.filter(isVideoOnlyFormat));
    const combined = sortByHeightDesc(formats.filter(isCombinedFormat));

    const highVideo = videoOnly[0] ?? null;
    const bestCombined = combined[0] ?? null;

    let lowVideoWithAudio: YouTubeFormat | null = null;

    if (highVideo) {
        const lowerCombined = sortByHeightAsc(
            combined.filter((format) => (format.height || 0) < (highVideo.height || Infinity))
        );
        lowVideoWithAudio = lowerCombined[0] ?? sortByHeightAsc(combined)[0] ?? null;
    } else {
        lowVideoWithAudio = sortByHeightAsc(combined)[0] ?? null;
    }

    return {highVideo, lowVideoWithAudio, bestCombined};
}

/** Метод для скачивания выбранного формата YouTube Shorts через yt-dlp
 @param url - ссылка на YouTube Shorts
 @param formatId - идентификатор формата для скачивания
 @param outputPath - путь для сохранения скачанного файла */
async function downloadFormat(url: string, formatId: string, outputPath: string): Promise<void> {
    const ytDlpWrap = await getYtDlpWrap();

    await ytDlpWrap.execPromise([
        url,
        '-f', formatId,
        '--no-playlist',
        '--no-warnings',
        '-o', outputPath,
    ]);
}

/** Метод-обёртка для выполнения ffmpeg-команды через Promise
 @param task - функция, настраивающая ffmpeg-команду
 @return Promise<void> - завершение обработки или ошибка ffmpeg */
function runFfmpeg(task: (command: ffmpeg.FfmpegCommand) => ffmpeg.FfmpegCommand): Promise<void> {
    return new Promise((resolve, reject) => {
        task(ffmpeg())
            .on('end', () => resolve())
            .on('error', (error) => reject(error));
    });
}

/** Метод для извлечения аудиодорожки из видеофайла
 @param inputPath - путь к исходному видеофайлу
 @param outputPath - путь для сохранения аудиофайла */
async function extractAudio(inputPath: string, outputPath: string): Promise<void> {
    await runFfmpeg((command) =>
        command
            .input(inputPath)
            .noVideo()
            .audioCodec('aac')
            .outputOptions(['-b:a 192k'])
            .save(outputPath)
    );
}

/** Метод для объединения видео высокого качества и аудиодорожки
 @param videoPath - путь к видеофайлу в высоком разрешении
 @param audioPath - путь к аудиофайлу
 @param outputPath - путь для сохранения итогового видео */
async function mergeVideoAndAudio(videoPath: string, audioPath: string, outputPath: string): Promise<void> {
    await runFfmpeg((command) =>
        command
            .input(videoPath)
            .input(audioPath)
            .outputOptions([
                '-c:v copy',
                '-c:a aac',
                '-b:a 192k',
                '-shortest',
                '-movflags +faststart',
            ])
            .save(outputPath)
    );
}

/** Метод для удаления временной директории после обработки видео
 @param tempDir - путь к временной директории */
async function cleanupTempDir(tempDir: string): Promise<void> {
    await rm(tempDir, {recursive: true, force: true}).catch(() => undefined);
}

/** Метод для получения метаданных YouTube Shorts по ссылке
 @param url - ссылка на YouTube Shorts
 @return YouTubeVideoInfo - данные о видео и список доступных форматов */
export async function getYouTubeShortsInfo(url: string): Promise<YouTubeVideoInfo> {
    const ytDlpWrap = await getYtDlpWrap();
    const info = await ytDlpWrap.getVideoInfo(url);

    return {
        title: info.title,
        uploader: info.uploader || info.channel,
        view_count: info.view_count,
        like_count: info.like_count,
        duration: info.duration,
        formats: info.formats ?? [],
    };
}

/** Метод для скачивания YouTube Shorts в буфер с максимальным качеством видео и звуком
 @param url - ссылка на YouTube Shorts
 @return YouTubeShortsVideoResult - готовое видео в буфере и метаданные ролика */
export async function getYouTubeShortsVideoBuffer(url: string): Promise<YouTubeShortsVideoResult> {
    const ytDlpWrap = await getYtDlpWrap();
    const info = await ytDlpWrap.getVideoInfo(url);
    const formats: YouTubeFormat[] = info.formats ?? [];
    const {highVideo, lowVideoWithAudio, bestCombined} = pickFormats(formats);

    const tempDir = join(YT_DLP_BIN_DIR, `yt-temp-${Date.now()}`);
    mkdirSync(tempDir, {recursive: true});

    const highVideoPath = join(tempDir, 'high.%(ext)s');
    const lowVideoPath = join(tempDir, 'low.%(ext)s');
    const audioPath = join(tempDir, 'audio.m4a');
    const outputPath = join(tempDir, 'output.mp4');
    try {
        if (highVideo && lowVideoWithAudio && highVideo.format_id !== lowVideoWithAudio.format_id) {
            console.log(
                `[YouTubeShorts] Скачивание видео ${highVideo.height ?? '?'}p и аудио из ${lowVideoWithAudio.height ?? '?'}p`
            );

            await downloadFormat(url, highVideo.format_id, highVideoPath);
            await downloadFormat(url, lowVideoWithAudio.format_id, lowVideoPath);

            const downloadedHigh = join(tempDir, `high.${highVideo.ext}`);
            const downloadedLow = join(tempDir, `low.${lowVideoWithAudio.ext}`);

            await extractAudio(downloadedLow, audioPath);
            await mergeVideoAndAudio(downloadedHigh, audioPath, outputPath);

            const buffer = await readFile(outputPath);

            return {
                buffer,
                info: {
                    title: info.title,
                    uploader: info.uploader || info.channel,
                    view_count: info.view_count,
                    like_count: info.like_count,
                    duration: info.duration,
                },
            };
        }

        const fallbackFormat = bestCombined ?? highVideo ?? lowVideoWithAudio;
        const fallbackOutput = join(tempDir, `result.${fallbackFormat?.ext ?? 'mp4'}`);

        if (!fallbackFormat) {
            console.log('[YouTubeShorts] Форматы не найдены, используем best');
            await ytDlpWrap.execPromise([
                url,
                '-f', 'best[ext=mp4]/best',
                '--no-playlist',
                '--no-warnings',
                '-o', fallbackOutput,
            ]);
        } else {
            console.log(`[YouTubeShorts] Скачивание единого формата ${fallbackFormat.height ?? '?'}p`);
            await downloadFormat(url, fallbackFormat.format_id, fallbackOutput);
        }

        const buffer = await readFile(fallbackOutput);

        return {
            buffer,
            info: {
                title: info.title,
                uploader: info.uploader || info.channel,
                view_count: info.view_count,
                like_count: info.like_count,
                duration: info.duration,
            },
        };
    } catch (error) {
        console.error('[YouTubeShorts] Ошибка обработки видео:', error instanceof Error ? error.message : String(error));
        throw new Error('Не удалось скачать и обработать YouTube Shorts.');
    } finally {
        await cleanupTempDir(tempDir);
    }
}

// Вызов для отладки:
/** Метод для локальной проверки скачивания YouTube Shorts
 @param url - ссылка на YouTube Shorts
 @return Promise<void> - сохраняет результат в файл test-youtube-short.mp4 */
// async function testYouTubeShortsDownload(url: string): Promise<void> {
//   const { writeFile } = await import('fs/promises');
//   const { join } = await import('path');
//
//   console.log(`[YouTubeShorts] Тестовая загрузка: ${url}`);
//
//   const { buffer, info } = await getYouTubeShortsVideoBuffer(url);
//   const outputPath = join(__dirname, '../../../test-youtube-short.mp4');
//
//   await writeFile(outputPath, buffer);
//
//   console.log('[YouTubeShorts] Видео сохранено:', outputPath);
//   console.log('[YouTubeShorts] Размер файла:', buffer.length, 'байт');
//   console.log('[YouTubeShorts] Метаданные:', info);
// }
//
// const testUrl = process.argv[2] ?? 'https://youtube.com/shorts/TVz3guTOO4o?si=p0oC791hdCQcd-Ge';
//
// if (require.main === module) {
//   testYouTubeShortsDownload(testUrl)
//     .then(() => console.log('[YouTubeShorts] Тест завершён успешно'))
//     .catch((error) => {
//       console.error('[YouTubeShorts] Тест завершился с ошибкой:', error);
//       process.exit(1);
//     });
// }
