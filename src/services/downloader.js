const axios = require('axios');
const fs = require('fs');
const path = require('path');

function sanitizeFileName(name) {
    return name.replace(/[<>:"/\\|?*]/g, '').trim();
}

async function downloadComics(comics, outputDir, jsonFilePath) {
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const downloadedFiles = [];

    for (const comic of comics) {
        try {
            const comicDir = path.join(outputDir, sanitizeFileName(comic.title));
            if (!fs.existsSync(comicDir)) {
                fs.mkdirSync(comicDir, { recursive: true });
            }

            for (const episode of comic.episodes) {
                try {
                    const episodeDir = path.join(comicDir, sanitizeFileName(episode.title));
                    if (!fs.existsSync(episodeDir)) {
                        fs.mkdirSync(episodeDir, { recursive: true });
                    }

                    const imagePromises = episode.images.map(async (imageUrl, i) => {
                        const fileName = `${i + 1}.jpg`;
                        const filePath = path.join(episodeDir, fileName);

                        try {
                            const response = await axios.get(imageUrl, { responseType: 'stream' });
                            await new Promise((resolve, reject) => {
                                const stream = response.data.pipe(fs.createWriteStream(filePath));
                                stream.on('finish', resolve);
                                stream.on('error', reject);
                            });

                            console.log(`Зображення завантажено: ${filePath}`);
                            downloadedFiles.push({
                                comicTitle: comic.title,
                                episodeTitle: episode.title,
                                fileName,
                                filePath,
                                imageUrl
                            });
                        } catch (error) {
                            console.error(`Помилка завантаження зображення ${imageUrl}:`, error.message);
                        }
                    });

                    await Promise.all(imagePromises);
                } catch (error) {
                    console.error(`Помилка завантаження епізоду ${episode.title}:`, error.message);
                }
            }
        } catch (error) {
            console.error(`Помилка завантаження комікса ${comic.title}:`, error.message);
        }
    }

    if (downloadedFiles.length === 0) {
        console.warn('Не знайдено жодного завантаженого файлу. JSON не буде створено.');
        return;
    }

    const jsonData = {
        downloadedComics: downloadedFiles.map(file => ({
            comicTitle: file.comicTitle,
            episodeTitle: file.episodeTitle,
            title: path.basename(file.fileName, path.extname(file.fileName)),
            url: file.imageUrl,
            path: file.filePath
        }))
    };

    fs.writeFileSync(jsonFilePath, JSON.stringify(jsonData, null, 2), 'utf-8');
    console.log(`Дані збережено в JSON-файл: ${jsonFilePath}`);
}

module.exports = { downloadComics };