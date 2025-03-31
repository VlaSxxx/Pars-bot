const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs-extra');
const path = require('path');
const { downloadImages } = require('./services/downloader');
const { downloadFolder } = require('./config/config');

// Функція для створення директорії, якщо вона не існує
async function createDirectory(dirPath) {
  try {
    await fs.ensureDir(dirPath);
    console.log(`Директорія ${dirPath} створена або вже існує.`);
  } catch (error) {
    console.error(`Помилка при створенні директорії ${dirPath}:`, error);
  }
}

// Функція для завантаження зображень
async function downloadImage(imageUrl, savePath) {
  try {
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    await fs.writeFile(savePath, response.data);
    console.log(`Зображення збережено: ${savePath}`);
  } catch (error) {
    console.error(`Помилка при завантаженні зображення ${imageUrl}:`, error);
  }
}

// Функція для парсингу сторінки комікса з Puppeteer
async function parseComicPage(comicUrl, comicDir) {
  try {
    // Запускаем Puppeteer
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Переходим на страницу комикса
    await page.goto(comicUrl, { waitUntil: 'networkidle2' });

    // Получаем HTML-контент после выполнения JavaScript
    const html = await page.content();
    const $ = cheerio.load(html);

    // Вытаскиваем название и описание комикса
    const title = $('h1.comic-title').text().trim();
    const description = $('div.comic-description').text().trim();

    // Создаём объект для сохранения данных
    const comicData = {
      title,
      description,
      episodes: []
    };

    console.log(`Парсинг комікса: ${comicUrl}`);
    console.log(`Назва: ${title}`);
    console.log(`Опис: ${description}`);

    // Проверяем, есть ли данные
    if (!comicData.title) {
      console.error(`Дані про комікс не знайдено для URL: ${comicUrl}`);
      await browser.close();
      return;
    }

    // Собираем информацию об эпизодах
    $('ul.episode-list li').each((index, element) => {
      const episodeTitle = $(element).find('a').text().trim();
      const episodeUrl = new URL($(element).find('a').attr('href'), comicUrl).href;
      comicData.episodes.push({
        title: episodeTitle,
        url: episodeUrl
      });
    });

    console.log(`Епізоди:`, comicData.episodes);

    // Сохраняем данные в JSON-файл
    const jsonFilePath = path.join(comicDir, 'comicData.json');
    await fs.writeJson(jsonFilePath, comicData, { spaces: 2 });
    console.log(`Дані про комікс збережено у ${jsonFilePath}`);

    // Закрываем браузер
    await browser.close();
  } catch (error) {
    console.error(`Помилка при парсингу сторінки ${comicUrl}:`, error);
  }
}

// Функція для отримання URL-адрес коміксів
async function fetchComicUrls(baseUrls) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    const allComicUrls = [];

    for (const url of baseUrls) {
        await page.goto(url, { waitUntil: 'networkidle2' });

        // Вывод HTML-контента для отладки
        const html = await page.content();
        console.log(`HTML-контент для ${url}:`, html);

        // Извлечение ссылок на комиксы
        const comicUrls = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a[href*="/webtoon/"]')); // Замените селектор на реальный
            return links.map(link => link.href);
        });

        if (comicUrls.length === 0) {
            console.error(`Не удалось найти ссылки на комиксы для URL: ${url}`);
        }

        allComicUrls.push(...comicUrls);
    }

    await browser.close();
    return allComicUrls;
}

// Головна функція
async function main() {
    const baseUrls = [
        'https://toomics.com/en/webtoon/all',
        'https://toomics.com/en/webtoon/genre',
        'https://toomics.com/en/webtoon/popular'
    ];

    const comicUrls = await fetchComicUrls(baseUrls);
    console.log('Найденные ссылки на комиксы:', comicUrls);

    // Базова директорія для збереження коміксів
    const baseDir = path.join(__dirname, 'toomics_comics');
    await createDirectory(baseDir);

    // Перебираємо кожен URL комікса
    for (const comicUrl of comicUrls) {
        const comicTitle = path.basename(comicUrl);
        const comicDir = path.join(baseDir, comicTitle);
        await createDirectory(comicDir);
        await parseComicPage(comicUrl, comicDir);
    }
}

main();