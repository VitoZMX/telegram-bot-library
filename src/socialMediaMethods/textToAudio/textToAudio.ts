import axios from "axios";
import { Logger } from "../../utils/Logger";

require('dotenv').config({ path: '.env.tokens' });

/** Метод перевода текста в аудио */
export async function textToAudioVoiceBuffer(
  text: string
): Promise<Buffer> {
  try {
    const voiceId = process.env.ELEVENLABS_VOICE_ID;
    const apiKey = process.env.ELEVENLABS_API_KEY_ID;

    if (!voiceId || !apiKey) throw new Error('ELEVENLABS_VOICE_ID или ELEVENLABS_API_KEY_ID не задан');

    Logger.log('Обработка текста в аудио на ElevenLabs...')
    const response = await axios({
      method: 'post',
      url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      data: {
        text,
        model_id: 'eleven_flash_v2_5',
        voice_settings: {
          stability: 0.9,
          similarity_boost: 0.9
        }
      },
      responseType: 'arraybuffer'
    });

    if (!response.data) {
      throw new Error('ElevenLabs не вернул аудио данные.');
    }

    Logger.log('Успешно...')
    return Buffer.from(response.data);
  } catch (error) {
    Logger.red('Ошибка при запросе к ElevenLabs');
    console.log(error);

    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        throw new Error('Неверный API ключ');
      }
      if (error.response?.status === 422) {
        throw new Error('Неверные параметры запроса');
      }
      throw new Error(`Ошибка API ElevenLabs: ${error.response?.status} ${error.response?.statusText}`);
    }
    throw new Error('Не удалось преобразовать текст в речь.');
  }
}
