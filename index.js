import axios from 'axios';
import cheerio from 'cheerio';
import fs from 'node:fs'
import puppeteer from 'puppeteer';
import *  as readline from 'readline-sync'

//Ссылка на сайт
const siteUrl = 'https://8volk.schools.by'

//Страница альбомов
const pageOfAlbum = readline.question('Input number of album page: ');


async function getHTML(url) {
    const { data } = await axios.get(url)
    return cheerio.load(data)    
}

async function downloadImage(photoLink, outputPath, browser) {
    let page = await browser.newPage();
    
    try {
        await page.goto(photoLink, {
            waitUntil: 'domcontentloaded'
        });

        await page.waitForSelector('.pv_osize', { timeout: 20000 });

        const originalLink = await page.evaluate(() => {
            return document.querySelector('.pv_osize a').getAttribute('href');
        });

        const resImage = await axios.get(originalLink, {responseType: 'stream'})
        const fileStream = fs.createWriteStream(outputPath)

        resImage.data.pipe(fileStream)

        await new Promise((resolve, reject) => {
            fileStream.on('finish', resolve);
            fileStream.on('error', reject);
            });
        await page.close();

        console.log(`Изображение успешно сохранено`);
    } catch (error) {
        console.error("Элемент не найден или не удалось подождать его появления.");
    }
    
     
}

async function processAlbumPage(albumTitle, albumLink, pageOfAlbum, browser) {
    const albumSelector = await getHTML(albumLink);
    fs.mkdirSync(`./images/${pageOfAlbum}`, {recursive: true})
    fs.mkdirSync(`./images/${pageOfAlbum}/${albumTitle}`, {recursive: true})

    const downloadPromises = []

    albumSelector('.photo-row').each(async (i, photo_el) => {
        const photoId = `${albumSelector(photo_el).find('a').attr('photoid')}`;
        const photoLink = `${albumLink}#photo${photoId}`;
        const outputPath = `./images/${pageOfAlbum}/${albumTitle}/${photoId}.jpg`;
        downloadPromises.push(downloadImage(photoLink, outputPath, browser)) 
    });
    // Ожидаем завершения всех скачиваний изображений
    await Promise.all(downloadPromises);
}

async function parse(pageOfAlbum) {
    const browser = await puppeteer.launch({headless: true});

    try {
        const page = await getHTML(`${siteUrl}/photoalbums?page=${pageOfAlbum}`)
        
        const albumProcessingPromises = [];

        page('.sch_ptbox_item').each(async (i, element) => {
            const albumTitle = page(element).find('div.name > a').text().replace(/[<>:"\\/|?*]+|\.$| $/g, "");
            const albumLink = `${siteUrl}${page(element).find('div.name > a').attr('href')}`;
            
            albumProcessingPromises.push(processAlbumPage(albumTitle, albumLink, pageOfAlbum, browser));
        })
        await Promise.all(albumProcessingPromises);
    } catch (err) {
        console.error("ошибка");
    } finally {
        await browser.close();
    }
    
    
}
parse(pageOfAlbum);
