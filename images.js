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

// Draw text 
function drawText(ctx, text, y, x, color = 'green') {
    ctx.fillStyle = color;
    ctx.font = 'normal 900 14px Arial';
    ctx.fillText(text, y, x);
}

// Function to draw a dot at a specific position
function drawBoundingBox(ctx, centerX, centerY, width, height, color) {
   const topLeftX = centerX - width / 2;
   const topLeftY = centerY - height / 2;

   // Draw the bounding box
   ctx.strokeStyle = color;
   ctx.lineWidth = 3;
   ctx.strokeRect(topLeftX, topLeftY, width, height);
}

// Function to handle image upload
function handleImageDET(fileInput, pathDET, pathMOT, objects) {
    return new Promise((resolve, reject) => {
        fs.readFile(fileInput, (err, data) => {
            if (err) throw err;

            loadImage(data).then((img) => {
                canvas.width = img.width;
                canvas.height = img.height;
                // canvasMOT.width = img.width;
                // canvasMOT.height = img.height;
                ctx.drawImage(img, 0, 0);
                //ctxMOT.drawImage(img, 0, 0);
                // Draw bounding box and text
                objects.forEach(object => {
                    object = object.split(',')
                    const xcenter = object[3]*1 + object[5]*1 /2;
                    const ycenter = object[4]*1 + object[6]*1 /2;
                    const width = object[5]*1;
                    const height = object[6]*1;

                    drawText(ctx, object[1].split('_')[1], xcenter - width/2 + 2, ycenter - height/2 - 5);
                    drawBoundingBox(ctx, xcenter, ycenter, width, height, 'green'); 

                    // drawText(ctxMOT, object[1].split('_')[0], xcenter - width/2 + 2, ycenter - height/2 - 5);
                    // drawBoundingBox(ctxMOT, xcenter, ycenter, width, height, 'green'); 
                });
    
                // Save the canvas as an image file
                const out = fs.createWriteStream(pathDET);
                const stream = canvas.createPNGStream();
                stream.pipe(out);
                out.on('finish', () => console.log('The image was saved.'));

                // Save the canvas as an image file
                // const outMOT = fs.createWriteStream(pathMOT);
                // const streamMOT = canvasMOT.createPNGStream();
                // streamMOT.pipe(outMOT);
                // outMOT.on('finish', () => console.log('The image was saved.'));
                resolve()
            }).catch((err) => {
                console.error('Error loading image:', err);
                reject()
            });
        });
    })
}



// Function to handle image upload
function handleImageMOT(fileInput, pathMOT, objects) {
    return new Promise((resolve, reject) => {
        fs.readFile(fileInput, (err, data) => {
            if (err) throw err;

            loadImage(data).then((img) => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                // Draw bounding box and text
                objects.forEach(object => {
                    object = object.split(',')
                    const xcenter = object[3]*1 + object[5]*1 /2;
                    const ycenter = object[4]*1 + object[6]*1 /2;
                    const width = object[5]*1;
                    const height = object[6]*1;
                    drawText(ctx, object[1].split('_')[1], xcenter - width/2 + 2, ycenter - height/2 - 5);
                    drawBoundingBox(ctx, xcenter, ycenter, width, height, 'green'); 
                });
    
                // Save the canvas as an image file
                const out = fs.createWriteStream(pathMOT);
                const stream = canvas.createPNGStream();
                stream.pipe(out);
                out.on('finish', () => console.log('The image was saved.'));
                resolve()
            }).catch((err) => {
                console.error('Error loading image:', err);
                reject()
            });
        });
    })
}
module.exports = {handleImageMoving, handleImageDET, handleImageMOT}