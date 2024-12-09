export class DateHelper {
  /** Возвращает текущую дату и время в формате: "12 декабря 2024 г., 14:30" (русская локализация). */
  static getCurrentDate(): string {
    return new Date().toLocaleString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    });
  }

  /** Возвращает текущую дату в формате: "12.12.2024, 14:30" (кастомный числовой формат). */
  static getCurrentDateNumeric(): string {
    const date = new Date();
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year}, ${hours}:${minutes}`;
  }

  /**  Возвращает текущую дату в формате ISO 8601: "2024-12-12T14:30:00". */
  static getCurrentDateISO(): string {
    return new Date().toISOString();
  }

  /** Возвращает текущую дату в коротком формате: "12.12.2024" (день.месяц.год). */
  static getCurrentDateShort(): string {
    const date = new Date();
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }

  /** Возвращает текущее время в 24-часовом формате: "14:30" (часы:минуты). */
  static getCurrentTime(): string {
    const date = new Date();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /** Возвращает только текущую дату в формате: "12.12.2024" (день.месяц.год). */
  static getOnlyDate(): string {
    const date = new Date();
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }

  /** Возвращает только текущее время в формате: "14:30" (часы:минуты). */
  static getOnlyTime(): string {
    const date = new Date();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}
