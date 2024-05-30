import fs from 'fs';
import { createCanvas, loadImage } from 'canvas';
import path from 'path';

const canvas = createCanvas(500, 500);
const ctx = canvas.getContext('2d');

function handleImageUpload(fileInput, path) {
    fs.readFile(fileInput, (err, data) => {
        if (err) throw err;

        loadImage(data).then((img) => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            // Save the canvas as an image file
            const out = fs.createWriteStream(path);
            const stream = canvas.createJPEGStream({quality: 1});
            stream.pipe(out);
            out.on('finish', () => console.log('The image was saved.'));
        }).catch((err) => {
            console.error('Error loading image:', err);
        });
    });
}

function convertImages() {
    return new Promise((resolve, reject) => {
        try {
            const dir = 'D:/S92/s92/s92/240427/Train/MCMOT/07/0004/2/Images'
            const name = '240427_0007_5'
            const files = fs.readdirSync(path.join(dir))
            
            files.forEach(file => {
                const url = `${dir}/${file}` 
                let xxx = file.split('.')[0]
                xxx = xxx.split('_')
                let num = (xxx[3] - 1567).toString().padStart(5, '0');
                const newFile = `${xxx[0]}_${xxx[1]}_${xxx[2]}_${num}`
                const x = `${dir}/${newFile}.jpg`
                handleImageUpload(url, x)
            });

            resolve()
        } catch (error) {
            console.log(error)
            reject(error)
        }
    })
}

convertImages()