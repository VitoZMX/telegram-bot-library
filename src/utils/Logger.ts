export class Logger {
  static colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m"
  };

  static log(message: any, color: keyof typeof Logger.colors = 'white'): void {
    console.log(`${Logger.colors[color]}${message}${Logger.colors.reset}`);
  }

  /** Красный */
  static red(message: any): void {
    this.log(message, 'red');
  }

  /** Зеленый */
  static green(message: any): void {
    this.log(message, 'green');
  }

  /** Синий */
  static blue(message: any): void {
    this.log(message, 'blue');
  }

  /** Жёлтый */
  static yellow(message: any): void {
    this.log(message, 'yellow');
  }

  /** Фиолетовый */
  static magenta(message: any): void {
    this.log(message, 'magenta');
  }

  /** Голубой */
  static cyan(message: any): void {
    this.log(message, 'cyan');
  }

  /** Белый */
  static white(message: any): void {
    this.log(message, 'white');
  }
}
