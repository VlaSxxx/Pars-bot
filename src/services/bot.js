const cron = require('node-cron');
const { fetchData } = require('../fetcher');
const { toomicsLinks, downloadFolder } = require('../config/config');
const { downloadImages } = require('./downloader');

cron.schedule('20 23 * * *', () => {
    console.log('Запуск парсинга в 21:43');
    toomicsLinks.forEach((link) => fetchData(link));
});