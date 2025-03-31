const path = require('path');

const toomicsLinks = [
    'https://toomics.com/en/webtoon/all',
    'https://toomics.com/en/webtoon/genre',
    'https://toomics.com/en/webtoon/popular',
    
];

const downloadFolder = path.join(__dirname, '../../output');

module.exports = { toomicsLinks, downloadFolder };