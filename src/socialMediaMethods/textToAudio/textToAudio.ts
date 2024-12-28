import axios from "axios";
import { Logger } from "../../utils/Logger";

require('dotenv').config({ path: '.env.tokens' });

/** Метод перевода текста в аудио */
export async function textToAudioVoiceBuffer(
  text: string
): Promise<Buffer> {
  try {
    const voiceId = process.env.ELEVENLABS_VOICE_ID;
    if (!voiceId) throw new Error('ELEVENLABS_VOICE_ID не задан');

    const apiKey = process.env.ELEVENLABS_API_KEY_ID;
    if (!apiKey) throw new Error('ELEVENLABS_API_KEY_ID не задан');

    Logger.log('Обработка текста в аудио на ElevenLabs...')
    const response = await axios({
      method: 'post',
      url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      headers: {
        'xi-api-key': apiKey,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'audio/mpeg',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://api.elevenlabs.io',
        'Referer': 'https://api.elevenlabs.io/'
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
