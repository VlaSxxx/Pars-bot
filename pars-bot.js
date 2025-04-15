const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const axios = require('axios');
const { promisify } = require('util');
const streamPipeline = promisify(require('stream').pipeline);

const BASE_URL = 'https://toomics.com';
let comicsData = {};

function cleanObject(obj) {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined && value !== null && value !== '' && 
            !(typeof value === 'string' && value.includes('Unknown'))) {
            result[key] = value;
        }
    }
    return result;
}

async function parseComicPage(comicUrl, baseDir, browser) {
    const page = await browser.newPage();
    try {
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.goto(comicUrl, { waitUntil: 'networkidle0', timeout: 70000 });

        // Получаем данные из ссылки
        let seriesData = {};
        try {
            seriesData = await page.$eval('a[href^="/en/webtoon/episode/toon/"][title="List"]', el => {
                const em = el.querySelector('em');
                const series = el.textContent.replace(em?.textContent || '', '').trim();
                const episode = em?.textContent.trim();
                return { series, episode };
            });
        } catch (error) {
            console.log('Не удалось извлечь данные серии');
        }

        // Получаем русское название
        let russianTitle = '';
        try {
            russianTitle = await page.$eval('h2.mt-3.line-clamp-2.break-normal.text-\\[37px\\]\\/\\[50px\\].font-bold.text-white', 
                el => el.textContent.trim());
        } catch (error) {
            russianTitle = seriesData.series || '';
        }

        // Получаем остальные данные
        let content = '';
        try {
            content = await page.$eval('div.break-noraml.mt-2.text-xs.font-normal.text-white', 
                el => el.innerText.trim().replace(/\n+/g, ' '));
        } catch (error) {
            console.log('Не удалось извлечь описание');
        }

        let gernes = '';
        try {
            gernes = await page.$eval('dd.text-xs.font-bold.text-gray-200', 
                el => el.textContent.trim().replace(/\s+/g, ' '));
        } catch (error) {
            console.log('Не удалось извлечь жанры');
        }

        let images = [];
        try {
            images = await page.$$eval('img[id^="set_image_"]', 
                imgs => imgs.map(img => img.getAttribute('src')).filter(Boolean));
        } catch (error) {
            console.log('Не удалось извлечь изображения');
        }

        // Обработка названий
        const safeTitle = russianTitle.replace(/[\\/:*?"<>|]/g, '').trim();
        const safeSeries = seriesData.series ? seriesData.series.replace(/[\\/:*?"<>|]/g, '').trim() : null;
        const safeEpisode = seriesData.episode ? seriesData.episode.replace(/[\\/:*?"<>|]/g, '').trim() : 'Prologue';

        // Создаем директории
        const comicDir = path.join(baseDir, safeTitle);
        const episodeDir = path.join(comicDir, safeEpisode);
        if (!fs.existsSync(episodeDir)) {
            fs.mkdirSync(episodeDir, { recursive: true });
        }

        // Скачиваем изображения
        const localImages = [];
        if (images.length > 0) {
            console.log(`Найдено ${images.length} изображений для "${safeTitle}"`);
            for (let i = 0; i < images.length; i++) {
                const imgName = `${i+1}.jpg`;
                try {
                    await downloadImage(images[i], path.join(episodeDir, imgName), comicUrl);
                    localImages.push(imgName);
                } catch (error) {
                    console.error(`Ошибка при загрузке изображения ${i+1}:`, error.message);
                }
            }
        }

        // Формируем данные комикса
        const comicInfo = {
            title: safeTitle,
            ...(safeSeries && { originalTitle: safeSeries }),
            ...(content && { content }),
            ...(gernes && { gernes }),
            url: comicUrl,
            episodes: []
        };

        // Формируем данные эпизода
        const episodeInfo = {
            ...(safeSeries && { parentTitle: safeSeries }),
            title: safeSeries ? `${safeSeries} - ${safeEpisode}` : safeEpisode,
            date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
            ...(images[0] && { thumbnail: images[0] }),
            images: localImages
        };

        // Добавляем в общую структуру
        if (!comicsData[safeTitle]) {
            comicsData[safeTitle] = cleanObject(comicInfo);
        }
        comicsData[safeTitle].episodes.push(cleanObject(episodeInfo));

        // Сохраняем JSON
        const jsonPath = path.join(baseDir, 'comicsData.json');
        fs.writeFileSync(jsonPath, JSON.stringify(Object.values(comicsData), null, 2));
        console.log(`Данные сохранены: ${jsonPath}`);

        // Парсим связанные эпизоды
        let episodeLinks = [];
        try {
            episodeLinks = await page.$$eval('a[onclick]', links =>
                links.map(link => {
                    const onclick = link.getAttribute('onclick');
                    const match = onclick.match(/location.href='([^']+)'/);
                    return match ? match[1] : null;
                }).filter(Boolean)
            );
        } catch (error) {
            console.log('Не удалось найти ссылки на другие эпизоды');
        }

        for (const link of episodeLinks) {
            const fullUrl = link.startsWith('http') ? link : `${BASE_URL}${link}`;
            console.log(`Переход к эпизоду: ${fullUrl}`);
            await parseComicPage(fullUrl, baseDir, browser);
        }

    } catch (error) {
        console.error(`Ошибка при парсинге ${comicUrl}:`, error.message);
    } finally {
        await page.close();
    }
}

async function downloadImage(url, savePath, referer) {
    try {
        const response = await axios({
            method: 'get',
            url,
            responseType: 'stream',
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Referer': referer 
            }
        });
        await streamPipeline(response.data, fs.createWriteStream(savePath));
        console.log(`Сохранено изображение: ${savePath}`);
    } catch (error) {
        throw new Error(`Не удалось скачать изображение: ${url}`);
    }
}

(async () => {
    const browser = await puppeteer.launch({ headless: false });
    try {
        const baseDir = './comics';
        if (!fs.existsSync(baseDir)) {
            fs.mkdirSync(baseDir, { recursive: true });
        }
        await parseComicPage('https://toomics.com/en/webtoon/episode/toon/5062', baseDir, browser);
    } catch (error) {
        console.error('Ошибка в основном потоке:', error);
    } finally {
        await browser.close();
    }
})();
