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

const inputDir = 'input';
const outDir = 's92';

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
const MCMOTFormat = [
    'box_id',
    'avs_id',
    'frame_index',
    'bbox_cx',
    'bbox_cy',
    'bbox_width',
    'bbox_height',
    'score',
    'truncation',
    'occlusion',
    'precision_time_stamp',
    'platform_tail_number',
    'platform_heading_angle',
    'platform_pitch_angle',
    'platform_roll_angle',
    'platform_designation',
    'image_source_sensor',
    'sensor_latitude',
    'sensor_longitude',
    'sensor_true_altitude',
    'sensor_horizontal_field_of_view',
    'sensor_vertical_field_of_view',
    'sensor_relative_azimuth_angle',
    'sensor_relative_elevation_angle',
    'sensor_relative_roll_angle',
    'slant_range',
    'frame_center_latitude',
    'frame_center_longitude',
    'frame_center_elevation',
    'offset_corner_latitude_point_1',
    'offset_corner_longitude_point_1',
    'offset_corner_latitude_point_2',
    'offset_corner_longitude_point_2',
    'offset_corner_latitude_point_3',
    'offset_corner_longitude_point_3',
    'offset_corner_latitude_point_4',
    'offset_corner_longitude_point_4',
    'plaftform_speed',
    'sensor_exposure_time',
    'platform-cam_rotation_matrix'
];

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
    const newContent = lines.map(line => processLine(line, DETFormat)).join('\n');
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
            result += '\t\t<target_id_global>car' + values[1] + '</target_id_global>\n';
            result += '\t\t<object_category>' + '0' + '</object_category>\n';
            result += '\t\t<object_subcategory>' + '0' + '</object_subcategory>\n';
            result += '\t\t<box_id>box' + values[1] + '</box_id>\n';
            result += '\t</object>\n';
        }
    }

    if (dir === 'pos') {
        for (let i = 0; i < xxx.length; i++) {
            const values = xxx[i].segment.split(",");
            result += '\t<object>\n';
            result += '\t\t<target_id_global>car' + values[1] + '</target_id_global>\n';
            result += '\t\t<avs_id>' + values[1] + '</avs_id>\n';
            result += '\t\t<frame_index>' + values[2] + '</frame_index>\n';
            result += '\t\t<target_pos_lat>' + values[3] + '</target_pos_lat>\n';
            result += '\t\t<target_pos_long>' + values[4] + '</target_pos_long>\n';
            result += '\t\t<target_pos_alt>' + values[5] + '</target_pos_alt>\n';
            result += '\t</object>\n';
        }
    }

    if (dir === 'box') {
        for (let i = 0; i < xxx.length; i++) {
            const values = xxx[i].klv.split(",");
            result += '\t<object>\n';
            result += '\t\t<box_id>box' + values[1] + '</box_id>\n';
            result += '\t\t<avs_id>' + values[1] + '</avs_id>\n';
            result += '\t\t<frame_index>' + values[2] + '</frame_index>\n';
            result += '\t\t<bbox_cx>' + values[3] + '</bbox_cx>\n';
            result += '\t\t<bbox_cy>' + values[4] + '</bbox_cy>\n';
            result += '\t\t<bbox_width>' + values[6] + '</bbox_width>\n';
            result += '\t\t<bbox_height>' + values[7] + '</bbox_height>\n';
            result += '\t\t<score>' + values[8] + '</score>\n';
            result += '\t\t<truncation>' + values[9] + '</truncation>\n';
            result += '\t\t<occlusion>' + values[10] + '</occlusion>\n';
            result += '\t\t<precision_time_stamp>' + values[11] + '</precision_time_stamp>\n';
            result += '\t\t<platform_tail_number>' + values[12] + '</platform_tail_number>\n';
            result += '\t\t<platform_heading_angle>' + values[13] + '</platform_heading_angle>\n';
            result += '\t\t<platform_pitch_angle>' + values[14] + '</platform_pitch_angle>\n';
            result += '\t\t<platform_roll_angle>' + values[15] + '</platform_roll_angle>\n';
            result += '\t\t<platform_designation>' + values[16] + '</platform_designation>\n';
            result += '\t\t<image_source_sensor>' + values[17] + '</image_source_sensor>\n';
            result += '\t\t<sensor_latitude>' + values[18] + '</sensor_latitude>\n';
            result += '\t\t<sensor_longitude>' + values[19] + '</sensor_longitude>\n';
            result += '\t\t<sensor_true_altitude>' + values[20] + '</sensor_true_altitude>\n';
            result += '\t\t<sensor_horizontal_field_of_view>' + values[21] + '</sensor_horizontal_field_of_view>\n';
            result += '\t\t<sensor_vertical_field_of_view>' + values[22] + '</sensor_vertical_field_of_view>\n';
            result += '\t\t<sensor_relative_azimuth_angle>' + values[23] + '</sensor_relative_azimuth_angle>\n';
            result += '\t\t<sensor_relative_elevation_angle>' + values[24] + '</sensor_relative_elevation_angle>\n';
            result += '\t\t<sensor_relative_roll_angle>' + values[25] + '</sensor_relative_roll_angle>\n';
            result += '\t\t<slant_range>' + values[26] + '</slant_range>\n';
            result += '\t\t<frame_center_latitude>' + values[27] + '</frame_center_latitude>\n';
            result += '\t\t<frame_center_longitude>' + values[28] + '</frame_center_longitude>\n';
            result += '\t\t<frame_center_elevation>' + values[29] + '</frame_center_elevation>\n';
            result += '\t\t<offset_corner_latitude_point_1>' + values[30] + '</offset_corner_latitude_point_1>\n';
            result += '\t\t<offset_corner_longitude_point_1>' + values[31] + '</offset_corner_longitude_point_1>\n';
            result += '\t\t<offset_corner_latitude_point_2>' + values[32] + '</offset_corner_latitude_point_2>\n';
            result += '\t\t<offset_corner_longitude_point_2>' + values[33] + '</offset_corner_longitude_point_2>\n';
            result += '\t\t<offset_corner_latitude_point_3>' + values[34] + '</offset_corner_latitude_point_3>\n';
            result += '\t\t<offset_corner_longitude_point_3>' + values[35] + '</offset_corner_longitude_point_3>\n';
            result += '\t\t<offset_corner_latitude_point_4>' + values[36] + '</offset_corner_latitude_point_4>\n';
            result += '\t\t<offset_corner_longitude_point_4>' + values[37] + '</offset_corner_longitude_point_4>\n';
            result += '\t\t<plaftform_speed>' + values[38] + '</plaftform_speed>\n';
            result += '\t\t<sensor_exposure_time>' + values[39] + '</sensor_exposure_time>\n';
            result += '\t\t<platform-cam_rotation_matrix>' + values[40] + '</platform-cam_rotation_matrix>\n';
            result += '\t</object>\n';
        }
    }

    result += '</root>';
    return result;
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

// Example usage
function convertTxtToMCMOTxxx() {
    const fileURL = 'input/klv.csv'
    // Read the file content synchronously
    const fileContent = fs.readFileSync(fileURL, 'utf8');
    const fileName = path.basename(fileURL).split('.');
    // Split the file content by new line character '\n'
    const lines = fileContent.trim().split('\n');

    console.log(fileContent)

    // Process each line and join them with '\n' to form the new content
    const newContent = lines.map(line => {
        return processLine2(line, MCMOTFormat).join('\n')
    });
    const outputFilePath = `Meta`;
    if (!fs.existsSync(outputFilePath)) {
        createDirectory(outputFilePath)
    }
    fs.writeFileSync(outputFilePath +`/240320_00001_001_${fileName[0].slice(-4)}.txt`, newContent);
}

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
    return format.map(item => newValues[item]);
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
async function convertXXX() {
    try {
        await createBaseForder(outDir);
        const directoryPath = inputDir + '/Det';
        const directoryPathMerged = inputDir + '/TXT_merged';
        // Read all files in the directory
        // const files = fs.readdirSync(directoryPath);

        // // Filter out only .txt files
        // const txtFiles = files.filter(file => path.extname(file).toLowerCase() === '.txt');

        // // Process each .txt file
        // txtFiles.forEach(file => {
        //     const filePath = path.join(directoryPath, file);
        //     convertTxtToDet(filePath);
        // });
        
        
        // convert Txt To MCMOT
        convertTxtToMCMOT('input/segment.csv');


        // await convertToFrames(inputVideo, outputFramesDir, fps);
        // await convertXML2JSON('label.xml');
        // await convertToVideo('frames2', outputVideo, fps)
        // console.log('Conversion complete.');
    } catch (error) {
        console.error('Error during conversion:', error);
    }
}

async function convert() {
    convertTxtToMCMOT('input/segment.csv');
}
// Run the main function
module.exports = { convert };
