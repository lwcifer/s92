const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');
const path = require('path');

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
            const dir2 = 'D:/S92/input240523/240427/0007/3/images'
            const dir = 'C:/DABEEO/newfolder/MCMOT/FTP07_05_6_240427_002/original images'
            const name = '240427_0007_5'
            const files = fs.readdirSync(path.join(dir))
            const files2 = fs.readdirSync(path.join(dir2))
            // files2.forEach(file => {
            //     const url = `${dir2}/${file}` 
            //     const x = `${dir2}/${name}_${file.split('.')[0]}.jpg`
            //     handleImageUpload(url, x)
            // });
            
            files.forEach(file => {
                const url = `${dir}/${file}` 
                const x = `${dir}/${name}_${file.split('.')[0]}.jpg`
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