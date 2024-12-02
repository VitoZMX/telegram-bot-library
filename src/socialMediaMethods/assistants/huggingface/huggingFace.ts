import axios from 'axios';
import { Logger } from '../../../utils/Logger';
import { HuggingFaceResponseType } from "./types/huggingFaceType";

require('dotenv').config({ path: '.env.tokens' });

/**
 * Класс для взаимодействия с чат-ботом Hugging Face.
 * Позволяет генерировать текстовые ответы с использованием различных языковых моделей.
 */
class HuggingFaceChatBot {
  private readonly apiKey: string;
  private readonly apiUrl: string;

  /**
   * Создает экземпляр чат-бота с указанным API-ключом и моделью.
   * @param {string} [model='mistralai/Mistral-7B-Instruct-v0.3'] - Модель для генерации текста.
   */
  constructor(model: string = 'mistralai/Mistral-7B-Instruct-v0.3') {
    this.apiKey = process.env.HUGGINGFACE_KEY!;
    this.apiUrl = `https://api-inference.huggingface.co/models/${model}`;
  }

  /**
   * Генерирует ответ на основе входного сообщения.
   * @param {string} message - Сообщение пользователя для генерации ответа.
   * @returns {Promise<string>} Сгенерированный текстовый ответ.
   * @throws {Error} Если не удается получить ответ от API.
   */
  async generateResponse(message: string): Promise<string> {
    try {
      Logger.log('Обработка сообщения в HuggingFace...')

      const fullPrompt = `[INST]${message}[/INST]`;

      const response = await axios.post<HuggingFaceResponseType[]>(
        this.apiUrl,
        {
          inputs: fullPrompt,
          parameters: {
            max_new_tokens: 9999,
            temperature: 0.9,
            top_p: 0.9
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const generatedText = response.data[0]?.generated_text;
      if (generatedText) {
        // Удаляем оригинальный промпт из ответа
        Logger.log('Успешно...')
        return generatedText.replace(fullPrompt, '').trim();
      }

      Logger.red('Не удалось сгенерировать текст Hugging Face');
      throw new Error('Текст не сгенерирован Hugging Face');
    } catch (error) {
      Logger.red('Ошибка API Hugging Face');
      console.error(error);
      throw new Error('Не удалось получить ответ от модели Hugging Face');
    }
  }
}

export default HuggingFaceChatBot;
