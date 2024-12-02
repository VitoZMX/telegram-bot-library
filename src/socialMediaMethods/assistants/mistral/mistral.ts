import { Mistral } from '@mistralai/mistralai';
import { Logger } from '../../../utils/Logger';
import { ChatCompletionResponse } from "@mistralai/mistralai/models/components";

require('dotenv').config({ path: '.env.tokens' });

/**
 * Отправляет запрос в Mistral и возвращает ответ.
 * @param {string} userMessage - Сообщение, которое отправляет пользователь.
 * @returns {Promise<string>} - Ответ модели.
 */
export async function getMistralResponse(userMessage: string): Promise<string> {
  const client = new Mistral({ apiKey: process.env.MISTRAL_KEY });

  try {
    Logger.log('Обработка сообщения в Mistrail...')
    const chatResponse: ChatCompletionResponse = await client.chat.complete({
      model: "mistral-large-latest",
      messages: [{ role: 'user', content: userMessage }
        ],
    });

    if (!chatResponse.choices || chatResponse.choices.length === 0 ||  typeof chatResponse.choices[0].message.content != "string") {
      throw new Error('Модель не вернула корректный ответ.');
    }

    Logger.log('Успешно...')
    return chatResponse.choices[0].message?.content;
  } catch (error) {
    Logger.red('Ошибка при запросе к Mistral');
    console.log(error)
    throw new Error('Не удалось получить ответ от модели Mistral.');
  }
}
