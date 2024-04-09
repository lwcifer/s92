const { exec } = require('child_process');
const fs = require('fs');
const {parseString} = require('xml2js')
const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const { DETInputFormat, MOTInputFormat, KLVInputFormat, PPKInputFormat } = require('./input_format_constants');
const { DETOutputFormat, MOTOutputFormat, metadataOutputFormat } = require('./output_format_constants');


// Define input and output filenames
const inputVideo = 'video_test.mp4';
const outputFramesDir = 'frames';
const outputVideo = 'videos/output_video.mp4';
const fps = 10;

const inputDir = 'C:/Users/PC/Downloads/input';
const outDir = 'C:/Users/PC/Documents/s92';

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

function processDETLine(line) {
    // Split the line by comma ','
    const values = line.split(',').map(value => value.trim());
    const cx = (1*values[DETInputFormat.minx] + values[DETInputFormat.minx]*1)/2;
    const cy = (1*values[DETInputFormat.miny] + 1*values[DETInputFormat.miny])/2;
   
    const newValues = {
        'bbox_cx': cx,
        'bbox_cy': cy,
        'bbox_width': 1*values[DETInputFormat.maxx] - 1*values[DETInputFormat.minx],
        'bbox_height': 1*values[DETInputFormat.maxy] - 1*values[DETInputFormat.miny],
        'score': 0,
        'object_category': values[DETInputFormat.cat] || 1,
        'object_subcategory': 1,
        'truncation': 0,
        'occlusion': 0
    }
    // Join the values back with comma ','
    return DETOutputFormat.map(item => newValues[item]);
}

// Function to calculate the time difference between two timestamps
function timeDifference(t1, t2) {
    return Math.abs(new Date(t1) - new Date(t2));
}

function frameIndexToTime(startTime, index) {
    const timestamp = (index / 50) * 1000
    const date = new Date(startTime)
    const timestampFromDateString = date.getTime() + timestamp
    return timestampFromDateString
}

let indexOfFrame = 1;
function convertTxtToDet (fileURL) {
    // Read the file content synchronously
    const fileContent = fs.readFileSync(fileURL, 'utf8');
    const fileName = path.basename(fileURL).split('.');
    // Split the file content by new line character '\n'
    const lines = fileContent.trim().split('\n');


    //get Content metadata klv
    const fileKLVContent = fs.readFileSync(`${inputDir}/metadata_klv.csv`, 'utf8');
    const linesKLV = fileKLVContent.trim().split('\n').map(line => line.split(',')).sort((a, b) => a[0] - b[0]);

    //get content metadata ppk
    const filePPKContent = fs.readFileSync(`${inputDir}/metadata_ppk.csv`, 'utf8');
    const linesPPK = filePPKContent.trim().split('\n').map(line => line.split(',')).sort((a, b) => a[0] - b[0]);

    const timeOfFile = frameIndexToTime(linesKLV[1][0], fileName[0]*1);
    let minDifference = Infinity;
    for (let i = indexOfFrame; i < linesKLV.length; i++) {
        let difference = linesKLV[i] && timeDifference(linesKLV[i][0], timeOfFile);
        if (difference < minDifference) {
            minDifference = difference;
            indexOfFrame = i;
        }
    }
    
    const contentMetadataKLV = metadataOutputFormat.map(item => {
        return KLVInputFormat.indexOf(item) >= 0 ? linesKLV[indexOfFrame][KLVInputFormat.indexOf(item)].replace(/\0+$/, '') || 'Null' : 'Null'
    });

    const contentMetadataPPK = metadataOutputFormat.map(item => {
        if(['sensorLatitude','sensorLongitude','sensorTrueAltitude'].includes(item)) {
            return PPKInputFormat.indexOf(item) >= 0 ? linesPPK[indexOfFrame][PPKInputFormat.indexOf(item)] || 'Null' : 'Null'
        }
        return KLVInputFormat.indexOf(item) >= 0 ? linesKLV[indexOfFrame][KLVInputFormat.indexOf(item)].replace(/\0+$/, '') || 'Null' : 'Null'
    });

    if (!fs.existsSync(outDir+'/Train/240321_00001/DET_MOT/001/Meta')) {
        createDirectory('/Train/240321_00001/DET_MOT/001/Meta')
    }
    fs.writeFileSync(outDir+'/Train/240321_00001/DET_MOT/001/Meta' +`/240331_00001_001_${fileName[0].slice(-5)}.txt`, contentMetadataKLV.toString());
    fs.writeFileSync(outDir+'/Train/240321_00001/DET_MOT/001/Meta' +`/240331_00001_001_${fileName[0].slice(-5)}(PPK).txt`, contentMetadataPPK.toString());

    // Process each line and join them with '\n' to form the new content
    const newContent = lines.map(line => processDETLine(line)).join('\n');
    const outputFilePath = `/Train/240321_00001/DET_MOT/001/Annotation Det`;
    if (!fs.existsSync(outDir+outputFilePath)) {
        createDirectory(outputFilePath)
    }
    fs.writeFileSync(outDir+outputFilePath +`/240331_00001_001_${fileName[0].slice(-5)}.txt`, newContent);
}


function processMOTLine(line) {
    // Split the line by comma ','
    const values = line.split(',').map(value => value.trim());
    const cx = 1*values[MOTInputFormat.minx] + values[MOTInputFormat.width]/2;
    const cy = 1*values[MOTInputFormat.miny] + values[MOTInputFormat.height]/2;
   
    const newValues = {
        'frame_index': values[MOTInputFormat.frameNo],
        'target_id': `${values[MOTInputFormat.id]}`,
        'bbox_cx': cx,
        'bbox_cy': cy,
        'bbox_width': values[MOTInputFormat.width],
        'bbox_height': values[MOTInputFormat.height],
        'score': 0,
        'object_category': values[MOTInputFormat.cat] || 1,
        'object_subcategory': 1,
        'truncation': 0,
        'occlusion': 0
    }
    // Join the values back with comma ','
    return MOTOutputFormat.map(item => newValues[item]);
}

function convertTxtToMOT (fileURL) {
    // Read the file content synchronously
    const fileContent = fs.readFileSync(fileURL, 'utf8');
    const fileName = path.basename(fileURL).split('.');
    // Split the file content by new line character '\n'
    const lines = fileContent.trim().split('\n');
    
    // Process each line and join them with '\n' to form the new content
    const newContent = lines.map(line => processMOTLine(line)).join('\n');
    const outputFilePath = `/Train/240321_00001/DET_MOT/001/Annotation MOT`;
    if (!fs.existsSync(outDir+outputFilePath)) {
        createDirectory(outputFilePath)
    }
    fs.writeFileSync(outDir+outputFilePath +`/240331_00001_001.txt`, newContent);
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
        const directoryPathDET = inputDir + '/DET_MOT/TXT';
        const directoryPathMOT = inputDir + '/DET_MOT/MOT';
        // Read all files in the directory
        const filesDET = fs.readdirSync(directoryPathDET);
        const fileMOT = fs.readdirSync(directoryPathMOT);

        // Filter out only .txt files
        const detFiles = filesDET.filter(file => path.extname(file).toLowerCase() === '.txt').sort((a, b) => a - b);
        console.log('detFiles', detFiles)
        // Process each .txt file
        detFiles.forEach(file => {
            const filePath = path.join(directoryPathDET, file);
            convertTxtToDet(filePath, DETOutputFormat);
        });

        const motFiles = fileMOT.filter(file => path.extname(file).toLowerCase() === '.txt');
        // Process each .txt file
        motFiles.forEach(file => {
            const filePath = path.join(directoryPathMOT, file);
            convertTxtToMOT(filePath, DETOutputFormat);
        });


        // await convertToFrames(inputVideo, outputFramesDir, fps);
        // await convertXML2JSON('label.xml');
        // await convertToVideo('frames2', outputVideo, fps)
        console.log('Conversion complete.');
    } catch (error) {
        console.error('Error during conversion:', error);
    }
}

// Run the main function
main();