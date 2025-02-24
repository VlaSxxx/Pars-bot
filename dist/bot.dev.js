"use strict";

var axios = require('axios');

var cheerio = require('cheerio');

var cron = require('node-cron');

cons;

function fetchData(url) {
  var _ref, data, $, links, titles, images, descriptions, result, jsonResult;

  return regeneratorRuntime.async(function fetchData$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          _context.prev = 0;
          _context.next = 3;
          return regeneratorRuntime.awrap(axios.get(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
              'Accept-Language': 'en-US,en;q=0.9'
            }
          }));

        case 3:
          _ref = _context.sent;
          data = _ref.data;
          $ = cheerio.load(data);
          links = [];
          titles = [];
          images = [];
          descriptions = [];
          $('h2').each(function (_, element) {
            titles.push($(element).text().trim());
          });
          $('a').each(function (_, element) {
            var link = $(element).attr('href');

            if (link && !link.startsWith('#')) {
              links.push(link.startsWith('http') ? link : "".concat(url).concat(link));
            }
          });
          $('img').each(function (_, element) {
            var imgSrc = $(element).attr('src');

            if (imgSrc) {
              images.push(imgSrc.startsWith('http') ? imgSrc : "".concat(url).concat(imgSrc));
            }
          });
          $('p').each(function (_, element) {
            descriptions.push($(element).text().trim());
          });
          result = {
            titles: titles,
            links: links,
            images: images,
            descriptions: descriptions
          };
          jsonResult = JSON.stringify(result, null, 2);
          console.log('Результат в формате JSON:', jsonResult);
          _context.next = 23;
          break;

        case 19:
          _context.prev = 19;
          _context.t0 = _context["catch"](0);

          if (_context.t0.response) {
            console.error('Ошибка ответа сервера:', _context.t0.response.status, _context.t0.response.statusText);
          } else if (_context.t0.request) {
            console.error('Ошибка запроса:', _context.t0.request);
          } else {
            console.error('Ошибка настройки запроса:', _context.t0.message);
          }

          console.error('Ошибка при парсинге:', _context.t0.config);

        case 23:
        case "end":
          return _context.stop();
      }
    }
  }, null, null, [[0, 19]]);
}

cron.schedule('13 12 * * *', function () {
  console.log('Запуск парсинга в 12:13');
  fetchData('https://toomics.com/en');
});