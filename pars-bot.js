const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const axios = require('axios');
const { promisify } = require('util');
const streamPipeline = promisify(require('stream').pipeline);

let comicData = [];

async function parseComicPage(comicUrl, baseDir, browser) {
    const page = await browser.newPage();
    try {
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.goto(comicUrl, { waitUntil: 'networkidle0', timeout: 70000 });

        let title = 'Без названия';
        let episode = 'Episode 1';
        let images = [];

       
        try {
            const titleInfo = await page.$eval('a[title="List"]', el => {
                const comicTitle = el.childNodes[0].textContent.trim();
                const ep = el.querySelector('em')?.textContent.trim() || 'Episode 1';
                return { comicTitle, ep };
            });
            title = titleInfo.comicTitle;
            episode = titleInfo.ep;
        } catch {

        }

        const safeTitle = title.replace(/[\\/:*?"<>|]/g, '').trim();
        const episodeName = episode.replace(/[\\/:*?"<>|]/g, '').trim();

        // Извлекаем изображения
        try {
            images = await page.$$eval('img[id^="set_image_"]', imgs =>
                imgs.map(img => img.getAttribute('src')).filter(Boolean)
            );
        } catch {
            images = [];
        }

        const comicEntry = {
            title,
            episode,
            url: comicUrl,
            coverImage: images[0] || '',
            images
        };

        comicData.push(comicEntry);

        // Сохраняем JSON
        const comicDir = path.join(baseDir, safeTitle);
        if (!fs.existsSync(comicDir)) {
            fs.mkdirSync(comicDir, { recursive: true });
        }
        fs.writeFileSync(path.join(comicDir, 'comicData.json'), JSON.stringify(comicData, null, 2));
        console.log(`Данные записаны в ${path.join(comicDir, 'comicData.json')}`);

        // Папка эпизода
        const episodeDir = path.join(comicDir, episodeName);
        if (!fs.existsSync(episodeDir)) {
            fs.mkdirSync(episodeDir, { recursive: true });
        }

        // Сохраняем изображения
        if (images.length > 0) {
            console.log(`Найдено ${images.length} изображений.`);
            await downloadImages(images, episodeDir, comicUrl);
        }

    } catch (error) {
        console.error(`Ошибка парсинга ${comicUrl}:`, error.message);
    } finally {
        await page.close();
    }
}

async function downloadImages(imageUrls, dir, refererUrl) {
    for (let i = 0; i < imageUrls.length; i++) {
        const imageUrl = imageUrls[i];
        const ext = path.extname(new URL(imageUrl).pathname) || '.jpg';
        const imagePath = path.join(dir, `image_${i + 1}${ext}`);
        try {
            const response = await axios({
                method: 'get',
                url: imageUrl,
                responseType: 'stream',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                    'Referer': refererUrl,
                    'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
                }
            });
            if (response.status === 200) {
                await streamPipeline(response.data, fs.createWriteStream(imagePath));
                console.log(`Сохранено: ${imagePath}`);
            } else {
                console.error(`Ошибка загрузки ${imageUrl}: статус ${response.status}`);
            }
        } catch (error) {
            console.error(`Ошибка загрузки ${imageUrl}:`, error.message);
        }
    }
}

(async () => {
    const browser = await puppeteer.launch({ headless: false });
    try {
        const comicUrls = [
            'https://toomics.com/en/webtoon/detail/code/100816/ep/1/toon/5062',
            'https://toomics.com/en/webtoon/detail/code/100817/ep/2/toon/5062',
            'https://toomics.com/en/webtoon/detail/code/100818/ep/3/toon/5062',
            'https://toomics.com/en/webtoon/detail/code/105898/ep/1/toon/5197',
            'https://toomics.com/en/webtoon/detail/code/105899/ep/2/toon/5197'
        ];

        const baseDir = './comics';
        if (!fs.existsSync(baseDir)) {
            fs.mkdirSync(baseDir, { recursive: true });
        }

        for (const comicUrl of comicUrls) {
            await parseComicPage(comicUrl, baseDir, browser);
        }

    } finally {
        await browser.close();
    }
})();
