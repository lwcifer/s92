const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');
const path = require('path');

const canvas = createCanvas(500, 500);
const ctx = canvas.getContext('2d');

function handleImageMoving(fileInput, outPath) {
    fs.readFile(fileInput, (err, data) => {
        if (err) throw err;

        loadImage(data).then((img) => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            // Save the canvas as an image file
            const out = fs.createWriteStream(outPath);
            const stream = canvas.createJPEGStream({quality: 1});
            stream.pipe(out);
            // out.on('finish', () => console.log('The image was saved.'));
        }).catch((err) => {
            console.error('Error loading image:', err);
        });
    });
}

// function convertImages() {
//     return new Promise((resolve, reject) => {
//         try {
//             const dir = 'C:/DABEEO/newfolder/s92/240407/Train/MCMOT/5001/3/Annotation MCMOT Visualized'
//             const name = '240407_5001_3'
//             const files = fs.readdirSync(path.join(dir))
//             files.forEach(file => {
//                 const url = `${dir}/${file}` 
//                 const x = `${dir}/${name}_${file.split('.')[0].slice(14, 999)}.jpg`
//                 handleImageUpload(url, x)
//             });

//             resolve()
//         } catch (error) {
//             reject()
//         }
//     })
// }

// convertImages()

module.exports = {handleImageMoving}