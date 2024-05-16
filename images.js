const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const canvas = createCanvas(500, 500);
const ctx = canvas.getContext('2d');
const { exec } = require('child_process');
const { getFixedColor } = require('./util');
const {colors, categories} = require('./contanst');

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
    if (text && ctx) {
        ctx.fillStyle = color;
        ctx.font = 'normal 900 14px Arial';
        ctx.fillText(text, y, x);
    }
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
function handleImageDET(fileInput, pathDET, objects) {
  return new Promise((resolve, reject) => {
      fs.readFile(fileInput, (err, data) => {
          if (err) throw err;

          loadImage(data).then((img) => {
              canvas.width = img.width;
              canvas.height = img.height;
              ctx.drawImage(img, 0, 0);
 
              objects.forEach(object => {
                  object = object.split(',')
                  const xcenter = object[3]*1 + object[5]*1 /2;
                  const ycenter = object[4]*1 + object[6]*1 /2;
                  const width = object[5]*1;
                  const height = object[6]*1;

                  drawText(ctx, categories[object[1]], xcenter - width/2 + 2, ycenter - height/2 - 5);
                  drawBoundingBox(ctx, xcenter, ycenter, width, height, colors[object[1]+object[2]]); 
              });
  
              // Save the canvas as an image file
              const out = fs.createWriteStream(pathDET);
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

// Function to handle image upload
async function handleImageMOT(fileInputs, outputDir, objects, file) {
  const promises = fileInputs.map((fileInput, index) => {
    const fileName = fileInput[1].split('.')[0];; // Get the file name from the file input

    return new Promise((resolve, reject) => {
      fs.readFile(fileInput[0], (err, data) => {
        if (err) throw err;

        loadImage(data).then((img) => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          // Draw bounding box and text
          objects[index].split('\n').forEach(object => {
            object = object.split(',')
            console.log('object', object)
            const xcenter = object[2]*1;
            const ycenter = object[3]*1;
            const width = object[4]*1;
            const height = object[5]*1;
            drawText(ctx,  object[1], xcenter - width/2 + 2, ycenter - height/2 - 5);
            drawBoundingBox(ctx, xcenter, ycenter, width, height, colors[object[1]]); 
          });

          // Save the canvas as an image file
          const outPath = path.join(outputDir, `${file}_${fileName}.png`);
          const out = fs.createWriteStream(outPath);
          const stream = canvas.createPNGStream();
          stream.pipe(out);
          out.on('finish', () => {
            console.log(`Image ${fileName} was saved.`);
            resolve();
          });
        }).catch((err) => {
          console.error('Error loading image:', err);
          reject();
        });
      });
    });
  });

  await Promise.all(promises);
  console.log('All images were saved.');

  // Convert images to video
  const inputFramesDir = outputDir;
  console.log('Converting images to video...', inputFramesDir);
  const outputVideo = path.join(outputDir, 'output.mp4');
  const fps = 10;
  await convertToVideo(inputFramesDir, outputVideo, fps);
  console.log('Video conversion completed.');
}

// Function to convert frames to video
function convertToVideo(inputFramesDir, outputVideo, fps) {
    return new Promise((resolve, reject) => {
      // Delete existing file if it exists
      if (fs.existsSync(outputVideo)) {
        fs.unlinkSync(outputVideo);
      }

      exec(`ffmpeg -framerate ${fps} -i  ${inputFramesDir} -c:v libx264 -pix_fmt yuv420p ${outputVideo}`, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
}

module.exports = {drawText, drawBoundingBox, handleImageMoving, handleImageDET, handleImageMOT}
