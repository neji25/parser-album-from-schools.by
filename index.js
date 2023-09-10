import axios from 'axios';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';
import { log } from 'node:console';
import * as fs from 'node:fs'

const parse = async() => {

    let pageOfAlbum = 2

    const getHTML = async (url) => {
        const { data } = await axios.get(url)
        return cheerio.load(data)    }

    const $ = await getHTML('https://8volk.schools.by/photoalbums')

    const selector = await getHTML(`https://8volk.schools.by/photoalbums?page=${pageOfAlbum}`)

    selector('.sch_ptbox_item').each(async (i, element) => {
        const title = selector(element).find('div.name > a').text();
        const albumLink = `https://8volk.schools.by${selector(element).find('div.name > a').attr('href')}`;
        
        const albumSelector = await getHTML(albumLink);
        fs.mkdir(`./${pageOfAlbum}`, () => {})
        fs.mkdir(`./${pageOfAlbum}/${title}`, () => {
            albumSelector('.photo-row').each(async (i, photo_el) => {
                const photoId = `${albumSelector(photo_el).find('a').attr('photoid')}`;
                const photoLink = `${albumLink}#photo${photoId}`;
                
                const browser = await puppeteer.launch()
    
                const page = await browser.newPage();
                await page.goto(photoLink, {
                    waitUntil: 'domcontentloaded'
                });
                
                try {
                    await page.waitForSelector('.pv_osize', { timeout: 100000 }); // Подождите до появления элемента
                    const originalLink = await page.evaluate(() => {
                        return document.querySelector('.pv_osize a').getAttribute('href');
                    });
                    const resImage = await axios.get(originalLink, {responseType: 'stream'})
                    const fileStream = fs.createWriteStream(`./${pageOfAlbum}/${title}/${photoId}.jpg`)
                    resImage.data.pipe(fileStream)

                    await new Promise((resolve, reject) => {
                        fileStream.on('finish', resolve);
                        fileStream.on('error', reject);
                      });

                    console.log(`Изображение успешно сохранено`);
                } catch (error) {
                    console.error("Элемент не найден или не удалось подождать его появления.");
                }
                
                await browser.close();

            })
            // console.log(`Каталог ${title} успешно создан`);
        });
        
    })
}

parse()