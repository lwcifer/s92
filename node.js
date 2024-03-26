const { exec } = require('child_process');
const fs = require('fs');
const {parseString} = require('xml2js')
const { createCanvas, loadImage } = require('canvas');
const path = require('path');

// Define input and output filenames
const inputVideo = 'video_test.mp4';
const outputFramesDir = 'frames';
const outputVideo = 'videos/output_video.mp4';
const fps = 10;

const inputDir = 'C:/Users/PC/Downloads/20240320';
const outDir = 'C:/Users/PC/Documents/s92';

const txtFormat = {
    'frameNo': 0,
    'name': 1,
    'id': 2,
    'minx': 3,
    'miny': 4,
    'width': 5,
    'height': 6
}

const DETFormat = ['bbox_cx', 'bbox_cy', 'bbox_width', 'bbox_height', 'score', 'object_category', 'object_subcategory', 'truncation', 'occlusion'];
const MOTFormat = ['frame_index', 'target_id', 'bbox_cx', 'bbox_cy', 'bbox_width', 'bbox_height', 'score', 'object_category', 'object_subcategory', 'truncation', 'occlusion'];

// Create a canvas and context
const canvas = createCanvas(500, 500);
const ctx = canvas.getContext('2d');


// Function to create directory recursively
function createDirectory(dirPath) {
    // Split the path into individual directories
    const dirs = dirPath.split(path.posix.sep);

    // Initialize current path as the root directory
    let currentPath = '';
    // Iterate through each directory in the path
    for (const dir of dirs) {
        // Append the current directory to the current path
        currentPath = path.join(currentPath, dir);
        // Check if the current directory exists
        if (!fs.existsSync(outDir+'/'+currentPath)) {
            // If not, create it
            fs.mkdirSync(outDir+'/'+currentPath);
        }
    }
}

function createBaseForder(outDir) {
    return new Promise((resolve, reject) => {
        try {
            // Check if the current directory exists
            if (!fs.existsSync(outDir)) {
                // If not, create it
                fs.mkdirSync(outDir);
                fs.mkdirSync(outDir+'/Test');
                fs.mkdirSync(outDir+'/Train')
                fs.mkdirSync(outDir+'/Val');

            }
            resolve()
        } catch (err) {
            reject(err)
        }
    })
}

function processLine(line, format) {
    // Split the line by comma ','
    const values = line.split(',').map(value => value.trim());
    const cx = 1*values[txtFormat.minx] + values[txtFormat.width]/2;
    const cy = 1*values[txtFormat.miny] + values[txtFormat.height]/2;
   
    const newValues = {
        'frame_index': values[txtFormat.frameNo],
        'target_id': `${values[txtFormat.name]}_${values[txtFormat.id]}`,
        'bbox_cx': cx,
        'bbox_cy': cy,
        'bbox_width': values[txtFormat.width],
        'bbox_height': values[txtFormat.height],
        'score': 0,
        'object_category': 1,
        'object_subcategory': 1,
        'truncation': 0,
        'occlusion': 0
    }
    // Join the values back with comma ','
    return format.map(item => newValues[item]);
}

function convertTxtToDet (fileURL, DETFormat) {
    // Read the file content synchronously
    const fileContent = fs.readFileSync(fileURL, 'utf8');
    const fileName = path.basename(fileURL).split('.');
    // Split the file content by new line character '\n'
    const lines = fileContent.trim().split('\n');

    // Process each line and join them with '\n' to form the new content
    const newContent = lines.map(line => processLine(line, MOTFormat)).join('\n');
    const outputFilePath = `/Train/240321_00001/DET_MOT/001/Annotation Det`;
    if (!fs.existsSync(outDir+outputFilePath)) {
        createDirectory(outputFilePath)
    }
    fs.writeFileSync(outDir+outputFilePath +`/240320_00001_001_${fileName[0].slice(-4)}.txt`, newContent);

}

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
        await createBaseForder(outDir);
        const directoryPath = inputDir + '/TXT_separate';
        const directoryPathMerged = inputDir + '/TXT_merged';
        // Read all files in the directory
        const files = fs.readdirSync(directoryPath);

        // Filter out only .txt files
        const txtFiles = files.filter(file => path.extname(file).toLowerCase() === '.txt');

        // Process each .txt file
        txtFiles.forEach(file => {
            const filePath = path.join(directoryPath, file);
            convertTxtToDet(filePath);
        });


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