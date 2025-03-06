const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');
const fs = require('fs');

    async function fetchData(url) {
    try {
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        });

        const $ = cheerio.load(data);

        const links = [];
        const titles = [];
        const images = [];
        const descriptions = [];

        $('h2').each((_, element) => {
            titles.push($(element).text().trim());
        });

        $('a').each((_, element) => {
            const link = $(element).attr('href');
            if (link && !link.startsWith('#')) {
                links.push(link.startsWith('http') ? link : `${url}${link}`);
            }
        });

        $('img').each((_, element) => {
            const imgSrc = $(element).attr('src');
            if (imgSrc) {
                images.push(imgSrc.startsWith('http') ? imgSrc : `${url}${imgSrc}`);
            }
        });

        $('p').each((_, element) => {
            descriptions.push($(element).text().trim());
        });

        const result = {
            titles,
            links,
            images,
            descriptions
        };

        const jsonResult = JSON.stringify(result, null, 2);
        console.log('Результат в формате JSON:', jsonResult);

        fs.writeFile('result.json', jsonResult, (error) => {
            if (error) {
                console.error('Ошибка записи в файл:', error);
            } else {
                console.log('Данные записаны в файл result.json');
            }
        });
    } catch (error) {
        if (error.response) {
            console.error('Ошибка ответа сервера:', error.response.status, error.response.statusText);
        } else if (error.request) {
            console.error('Ошибка запроса:', error.request);
        } else {
            console.error('Ошибка настройки запроса:', error.message);
        }
        console.error('Ошибка при парсинге:', error.config);
    }
}

cron.schedule('18 22 * * *', () => {
    console.log('Запуск парсинга в 22:18');
    fetchData('https://toomics.com/en');
});