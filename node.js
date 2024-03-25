const { exec } = require('child_process');
const fs = require('fs');
const {parseString} = require('xml2js')
const { createCanvas, loadImage } = require('canvas');

// Define input and output filenames
const inputVideo = 'video_test.mp4';
const outputFramesDir = 'frames';
const outputVideo = 'videos/output_video.mp4';
const fps = 10;

// Create a canvas and context
const canvas = createCanvas(500, 500);
const ctx = canvas.getContext('2d');

// Draw text 
function drawText(text, y, x, color = 'green') {
     ctx.fillStyle = color;
     ctx.font = '12px Arial';
     ctx.fillText(text, y, x);
}
// Function to draw a dot at a specific position
function drawBoundingBox(ctx, centerX, centerY, width, height, color) {
    // console.log(ctx, centerX, centerY, width, height, color)
    const topLeftX = centerX - width / 2;
    const topLeftY = centerY - height / 2;

    // Draw the bounding box
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(topLeftX, topLeftY, width, height);
}

// Function to handle image upload
function handleImageUpload(fileInput, id, objects) {
    return new Promise((resolve, reject) => {
        fs.readFile(fileInput, (err, data) => {
            if (err) throw err;
    
            loadImage(data).then((img) => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
    
                // Draw bounding box and text
                objects.forEach(object => {
                    const item = object.bndbox[0]
                    const width = +item.width[0]
                    const height = +item.height[0]
                    const ymax = +item.ymin[0] + item.height[0]
                    const xmax = +item.xmin[0] + item.width[0]
                    const xcenter = +item.ymin[0] + item.height[0]/2
                    const ycenter = +item.xmin[0] + + item.width[0]/2
                    drawText(`${object.name[0]}_${object.id[0]}`, xcenter, ycenter);
                    drawBoundingBox(ctx, xcenter, ycenter, width, height, 'red'); 
                });
    
                // Save the canvas as an image file
                const out = fs.createWriteStream(`frames2/frame_${id}.png`);
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

// Function to convert video to frames
function convertToFrames(inputVideo, outputFramesDir, fps) {
    return new Promise((resolve, reject) => {
        exec(`ffmpeg -i ${inputVideo} -vf fps=${fps} ${outputFramesDir}/frame_%d.png`, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });
    });
}

function convertXML2JSON(xmlfile) {
    return new Promise((resolve, reject) => {
        try {
            const xml  = fs.readFileSync(xmlfile, 'utf8')
            parseString(xml, {trim: true}, function (err, result) {
                let funs = []
                result.root.annotation.forEach((item, index) => {
                    // Load the input image
                    // console.log(item);
                    const url = `frames/frame_${parseInt(item.framenumber[0]) + 1}.png`
                    funs.push(handleImageUpload(url, parseInt(item.framenumber[0]) + 1, item.object))
                })
                Promise.all(funs).then((values) => {
                    resolve()
                })
                .catch((error) => {
                    reject()
                });
            });
        } catch (error) {
            reject()
        }
    })

    // let json = xml2js.xml2json(xml, { compact: false });

    // json = JSON.parse(json)
    // var width = json.elements[0].elements[0].size;
    // var height = json.elements[0].elements[0].size;
    // console.log('width', json.elements[0].elements[0])

    // var stage = new Konva.Stage({
    // container: 'container',
    // width: width,
    // height: height,
    // });

    // var layer = new Konva.Layer();
    // let anotationList = json.elements[0].elements;
    // anotationList.map(item => {

    // });
}

// Function to convert frames to video
function convertToVideo(outputFramesDir, outputVideo, fps) {
    return new Promise((resolve, reject) => {
        // Delete existing file if it exists
        if (fs.existsSync(outputVideo)) {
            fs.unlinkSync(outputVideo);
        }

        exec(`ffmpeg -framerate ${fps} -i ${outputFramesDir}/frame_%d.png -c:v libx264 -pix_fmt yuv420p ${outputVideo}`, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            resolve();
            console.log(outputVideo)
        });
    });
}

// Main function
async function main() {
    try {
        await convertToFrames(inputVideo, outputFramesDir, fps);
        await convertXML2JSON('label.xml');
        await convertToVideo('frames2', outputVideo, fps)
        console.log('Conversion complete.');
    } catch (error) {
        console.error('Error during conversion:', error);
    }
}

// Run the main function
main();