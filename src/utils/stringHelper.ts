export class StringHelper {
  private static SPECIAL_CHARS = [
    ',', '.', '!', '?', '[', ']', '{', '}', '(', ')', `'`, '-', '#'
  ];

  /**
   * Экранирует специальные символы Markdown в строке.
   *
   * @param text - Входной текст, который необходимо обработать.
   * @return Строка с экранированными символами Markdown.
   */
  public static escapeMarkdown(text: string): string {
    return text.split('').map(char => {
      if (this.SPECIAL_CHARS.includes(char)) {
        return `\\${char}`; // Экранируем символ
      }
      return char;
    }).join('');
  }
}
