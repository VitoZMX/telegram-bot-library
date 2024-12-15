import fs from "fs";
import path from "path";

/**
 * Рекурсивно копирует файлы с указанным расширением из исходной директории в целевую.
 * @param srcDir - Исходная директория.
 * @param destDir - Целевая директория.
 */
function copyFiles(srcDir: string, destDir: string): void {
  const files = fs.readdirSync(srcDir);

  files.forEach((file) => {
    const srcPath = path.join(srcDir, file);
    const destPath = path.join(destDir, file);
    const stats = fs.statSync(srcPath);

    if (stats.isDirectory()) {
      // Рекурсивно копируем содержимое вложенных папок
      copyFiles(srcPath, destPath);
    } else if (path.extname(file) === '.png') {
      // Копируем только файлы с расширением .png
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      fs.copyFileSync(srcPath, destPath);
    }
  });
}

// Запускаем копирование
copyFiles('src', 'build/src');
