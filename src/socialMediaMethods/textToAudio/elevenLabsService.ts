import { ElevenLabsClient } from "elevenlabs";
import { Logger } from "../../utils/Logger";
import * as stream from "stream";

require('dotenv').config({ path: '.env.tokens' });

export class ElevenLabsService {
  private client: ElevenLabsClient;

  constructor() {
    const apiKey = process.env.ELEVENLABS_API_KEY_ID || '';
    const voiceId = process.env.ELEVENLABS_VOICE_ID || '';

    if (!apiKey || !voiceId) {
      throw new Error('ELEVENLABS_API_KEY_ID или ELEVENLABS_VOICE_ID не заданы');
    }

    this.client = new ElevenLabsClient({
      apiKey: apiKey,
    });
  }

  /**
   * Метод для преобразования текста в аудио
   * @param text Текст, который нужно преобразовать в аудио
   * @returns Буфер с аудиоданными
   */
  public async textToAudioVoiceBuffer(text: string): Promise<stream.Readable> {
    try {
      Logger.log('Обработка текста в аудио на ElevenLabs...');

      const audioBuffer = await this.client.generate({
        stream: true,
        output_format: "mp3_44100_128",
        voice: process.env.ELEVENLABS_VOICE_ID || '',
        text: text,
        model_id: "eleven_flash_v2_5",
      });

      Logger.log('Успешно...');
      return audioBuffer;
    } catch (error) {
      this.handleError(error);
      throw new Error('Не удалось преобразовать текст в речь.');
    }
  }

  /**
   * Обработка ошибок при запросах
   * @param error Ошибка
   */
  private handleError(error: unknown): void {
    Logger.red('Ошибка при запросе к ElevenLabs');
    console.error(error);
    throw new Error('Не удалось преобразовать текст в речь.');
  }
}
