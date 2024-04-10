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
    fs.writeFileSync(outDir+outputFilePath +`/240320_00001_001_${fileName[0].slice(-4)}.txt`, newContent);
}

// convert csv to MCMOT
function exportXmlToFile(xmlContent, filename) {
    let dir = filename.split(path.posix.sep)
    dir.pop()
    dir = dir.toString().replaceAll(',', '/')
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFile(filename, xmlContent, (err) => {
        if (err) {
            console.error('Error writing XML file:', err);
        } else {
            console.log('XML file saved successfully:', filename);
        }
    });
}

function frameIndexToTime(startTime, index) {
    // console.log(startTime, index)
    const timestamp = index / 50 * 1000
    const date = new Date(startTime)
    const timestampFromDateString = date.getTime() + timestamp

    return timestampFromDateString
}

function contentMCMOT(fileURL, dir) {
    // Read the file content synchronously
    const fileContent = fs.readFileSync(fileURL, 'utf8');
    let segmentContent = fs.readFileSync('input/segment.csv', 'utf8');
    let ppkContent = fs.readFileSync('input/ppk.csv', 'utf8');
    // Split the file content by new line character '\n'
    let lines = fileContent.trim().split('\n');
    let ppk = ppkContent.trim().split('\n');
    lines.shift();
    const segments = segmentContent.trim().split('\n');
    const rootTime = lines[0].split(",")[0]
    let startTime = frameIndexToTime(rootTime, segments[0].split(',')[0])
    // console.log('startTime', new Date(startTime))

    lines.sort((a,b)=> {
        const dateA = new Date(a.split(',')[0]).getTime();
        const dateB = new Date(b.split(',')[0]).getTime();
        const diffA = Math.abs(dateA - startTime > 0 ? dateA - startTime : 0);
        const diffB = Math.abs(dateB - startTime > 0 ? dateA - startTime : 0);
        return diffB - diffA;
    })
    ppk.sort((a,b)=> {
        const dateA = new Date(a.split(',')[0]).getTime();
        const dateB = new Date(b.split(',')[0]).getTime();
        const diffA = Math.abs(dateA - startTime > 0 ? dateA - startTime : 0);
        const diffB = Math.abs(dateB - startTime > 0 ? dateA - startTime : 0);
        return diffB - diffA;
    })

    let count = 1
    let index = 1
    let xxx = [{segment: segments[0], klv: lines[0], ppk: ppk[0]}]
    let frameIndex = segments[count].split(',')[0]
    let crrTime = frameIndexToTime(rootTime, frameIndex)
    console.log('lines', lines)
    console.log('startTime', new Date(startTime))
    console.log('crrTime', new Date(crrTime))
    console.log('item', new Date(lines[1].split(',')[0]))
    while (count < segments.length && index < lines.length) {
        const item = lines[index]
        const itemTime = (new Date(item.split(',')[0])).getTime();
        // console.log('count', itemTime, crrTime, itemTime - crrTime )

        if (itemTime - crrTime > 0) {
            const prev = lines[index - 1]
            const prevTime = new Date(prev.split(',')[0]).getTime();
            if (frameIndex === segments[count].split(',')[0]) {
                xxx.push({segment: segments[count], klv: prev, ppk: ppk[index - 1]})
            } else if (count < segments.length) {
                klv = crrTime - prevTime < itemTime - crrTime ? item : prev
                klv = crrTime - prevTime < itemTime - crrTime ?  ppk[index] :  ppk[index - 1]
                xxx.push({segment: segments[count], klv, ppk: ppk[index - 1]})
                frameIndex = segments[count].split(',')[0]
                crrTime = frameIndexToTime(rootTime, frameIndex)
            }
            count++
        }
        index++
    }
    console.log('xxx: ', index, xxx.length, xxx)

    let result = '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n';
    if (dir === 'main') {
        for (let i = 0; i < xxx.length; i++) {
            const values = xxx[i].segment.split(",");
            result += '\t<object>\n';
            result += '\t\t<target_id_global>car' + valueToText(values[1] ) + '</target_id_global>\n';
            result += '\t\t<object_category>' + '0' + '</object_category>\n';
            result += '\t\t<object_subcategory>' + '0' + '</object_subcategory>\n';
            result += '\t\t<box_id>box' + valueToText(values[1] ) + '</box_id>\n';
            result += '\t</object>\n';
        }
    }

    if (dir === 'pos') {
        for (let i = 0; i < xxx.length; i++) {
            const values = xxx[i].segment.split(",");
            const ppk = xxx[i].ppk.split(",");
            result += '\t<object>\n';
            result += '\t\t<target_id_global>car' + valueToText(values[1] ) + '</target_id_global>\n';
            result += '\t\t<avs_id>' + valueToText(values[1] ) + '</avs_id>\n';
            result += '\t\t<frame_index>' + valueToText(values[0] ) + '</frame_index>\n';
            result += '\t\t<target_pos_lat>' + valueToText( ppk[1] ) + '</target_pos_lat>\n';
            result += '\t\t<target_pos_long>' + valueToText( ppk[2] ) + '</target_pos_long>\n';
            result += '\t\t<target_pos_alt>' + valueToText( ppk[3] ) + '</target_pos_alt>\n';
            result += '\t</object>\n';
        }
    }

    if (dir === 'box') {
        for (let i = 0; i < xxx.length; i++) {
            const segment = xxx[i].segment.split(",");
            const values = xxx[i].klv.split(",");
            result += '\t<object>\n';
            result += '\t\t<box_id>box' + valueToText( segment[1] ) + '</box_id>\n';
            result += '\t\t<avs_id>' + valueToText( segment[1] ) + '</avs_id>\n';
            result += '\t\t<frame_index>' + valueToText( segment[0] ) + '</frame_index>\n';
            result += '\t\t<bbox_cx>' + valueToText( segment[2] ) + '</bbox_cx>\n';
            result += '\t\t<bbox_cy>' + valueToText( segment[3] ) + '</bbox_cy>\n';
            result += '\t\t<bbox_width>' + valueToText( segment[4] ) + '</bbox_width>\n';
            result += '\t\t<bbox_height>' + valueToText( segment[5] ) + '</bbox_height>\n';
            result += '\t\t<score>' + valueToText( segment[6] ) + '</score>\n';
            result += '\t\t<truncation>' + valueToText( segment[7] ) + '</truncation>\n';
            result += '\t\t<occlusion>' + valueToText( segment[8] ) + '</occlusion>\n';
            result += '\t\t<precision_time_stamp>' + valueToText(values[0] ) + '</precision_time_stamp>\n';
            result += '\t\t<platform_tail_number>' + valueToText(values[1] ) + '</platform_tail_number>\n';
            result += '\t\t<platform_heading_angle>' + valueToText(values[2] ) + '</platform_heading_angle>\n';
            result += '\t\t<platform_pitch_angle>' + valueToText(values[3] ) + '</platform_pitch_angle>\n';
            result += '\t\t<platform_roll_angle>' + valueToText(values[4] ) + '</platform_roll_angle>\n';
            result += '\t\t<platform_designation>' + valueToText(values[5] ) + '</platform_designation>\n';
            result += '\t\t<image_source_sensor>' + valueToText(values[6] ) + '</image_source_sensor>\n';
            result += '\t\t<sensor_latitude>' + valueToText(values[7] ) + '</sensor_latitude>\n';
            result += '\t\t<sensor_longitude>' + valueToText(values[8] ) + '</sensor_longitude>\n';
            result += '\t\t<sensor_true_altitude>' + valueToText(values[9] ) + '</sensor_true_altitude>\n';
            result += '\t\t<sensor_horizontal_field_of_view>' + valueToText(values[11] ) + '</sensor_horizontal_field_of_view>\n';
            result += '\t\t<sensor_vertical_field_of_view>' + valueToText(values[12] ) + '</sensor_vertical_field_of_view>\n';
            result += '\t\t<sensor_relative_azimuth_angle>' + valueToText(values[13] ) + '</sensor_relative_azimuth_angle>\n';
            result += '\t\t<sensor_relative_elevation_angle>' + valueToText(values[14] ) + '</sensor_relative_elevation_angle>\n';
            result += '\t\t<sensor_relative_roll_angle>' + valueToText(values[15] ) + '</sensor_relative_roll_angle>\n';
            result += '\t\t<slant_range>' + valueToText(values[16] ) + '</slant_range>\n';
            result += '\t\t<frame_center_latitude>' + valueToText(values[17] ) + '</frame_center_latitude>\n';
            result += '\t\t<frame_center_longitude>' + valueToText(values[18] ) + '</frame_center_longitude>\n';
            result += '\t\t<frame_center_elevation>' + valueToText(values[19] ) + '</frame_center_elevation>\n';
            result += '\t\t<offset_corner_latitude_point_1>' + valueToText(values[20] ) + '</offset_corner_latitude_point_1>\n';
            result += '\t\t<offset_corner_longitude_point_1>' + valueToText(values[21] ) + '</offset_corner_longitude_point_1>\n';
            result += '\t\t<offset_corner_latitude_point_2>' + valueToText(values[22] ) + '</offset_corner_latitude_point_2>\n';
            result += '\t\t<offset_corner_longitude_point_2>' + valueToText(values[23] ) + '</offset_corner_longitude_point_2>\n';
            result += '\t\t<offset_corner_latitude_point_3>' + valueToText(values[24] ) + '</offset_corner_latitude_point_3>\n';
            result += '\t\t<offset_corner_longitude_point_3>' + valueToText(values[25] ) + '</offset_corner_longitude_point_3>\n';
            result += '\t\t<offset_corner_latitude_point_4>' + valueToText(values[26] ) + '</offset_corner_latitude_point_4>\n';
            result += '\t\t<offset_corner_longitude_point_4>' + valueToText(values[27] ) + '</offset_corner_longitude_point_4>\n';
            result += '\t\t<plaftform_speed>' + valueToText(values[28] ) + '</plaftform_speed>\n';
            result += '\t\t<sensor_exposure_time>' + valueToText(values[29] ) + '</sensor_exposure_time>\n';
            result += '\t\t<platform-cam_rotation_matrix>' + valueToText(values[30] ) + '</platform-cam_rotation_matrix>\n';
            result += '\t</object>\n';
        }
    }

    result += '</root>';
    return result;
}


function valueToText(val) {
    if (!val) {
        return 'Null'
    }

    return val.trim()
}

function convertTxtToMCMOT() {
    const fileURL = 'input/klv.csv'
    const boxContent = contentMCMOT(fileURL, 'box')
    const mainContent = contentMCMOT(fileURL, 'main')
    const posContent = contentMCMOT(fileURL, 'pos')
    exportXmlToFile(boxContent, 'output/MCMOT/Box/240320_00001.xml')
    exportXmlToFile(mainContent, 'output/MCMOT/Main/240320_00001.xml')
    exportXmlToFile(posContent, 'output/MCMOT/Pos/240320_00001.xml')
}

///
function processLine2(line, format) {
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
                const out = fs.createWriteStream(`frames2/frame_${id}.jpg`);
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
        exec(`ffmpeg -i ${inputVideo} -vf fps=${fps} ${outputFramesDir}/frame_%d.jpg`, (error, stdout, stderr) => {
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
                    const url = `frames/frame_${parseInt(item.framenumber[0]) + 1}.jpg`
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

        exec(`ffmpeg -framerate ${fps} -i ${outputFramesDir}/frame_%d.jpg -c:v libx264 -pix_fmt yuv420p ${outputVideo}`, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            resolve();
            console.log(outputVideo)
        });
    });
}
2
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

async function convert() {
    convertTxtToMCMOT('input/segment.csv');
}
// Run the main function
module.exports = { convert };
