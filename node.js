const { exec } = require('child_process');
const fs = require('fs');
const {parseString} = require('xml2js')
const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const { DETInputFormat, KLVInputFormat, PPKInputFormat } = require('./input_format_constants');
const { DETOutputFormat, MOTOutputFormat, metadataOutputFormat } = require('./output_format_constants');
const { addDifferenceTime, getFixedColor, valueToText, uCreateDirectory, createBaseForder, uFrameIndexToTime, timeDifference, exportXmlToFile, sortPromax, extraDataMCMOT } = require('./util');
const { PATH_STRING } = require('./contanst');
const { drawText, drawBoundingBox, handleImageMoving, handleImageDET, handleImageMOT} = require('./images');


// Define input and output filenames
let inputDir = 'C:/Users/PC/Downloads/input';
let outDir = 'C:/Users/PC/Documents/s92';
let mod = 'all';
let fps = 30;
let ppkTimeDifference = 0;
let klvTimeDifference = 0;
const digitFileName = 5;

// Create a canvas and context
const canvas = createCanvas(500, 500);
const ctx = canvas.getContext('2d');

function createDirectory(x) {
    uCreateDirectory.call(this, x, outDir);
}

function frameIndexToTime(x,y) {
    return uFrameIndexToTime.call(this, x, y, fps);
}

function processDETLine(line) {
    // Split the line by comma ','
    const values = line.split(',').map(value => value.trim());
    const cx = 1*values[DETInputFormat.minx] + values[DETInputFormat.width]/2;
    const cy = 1*values[DETInputFormat.miny] + values[DETInputFormat.height]/2;
    const category = values[DETInputFormat.name]?.split('_')[1];
   
    const newValues = {
        'bbox_cx': cx,
        'bbox_cy': cy,
        'bbox_width': values[DETInputFormat.width],
        'bbox_height': values[DETInputFormat.height],
        'score': 0,
        'object_category': category,
        'object_subcategory': 1,
        'truncation': 0,
        'occlusion': 0
    }
    // Join the values back with comma ','
    return DETOutputFormat.map(item => newValues[item]);
}

let indexOfFrame = 1;
function convertTxtToDet (date, droneName, clipName, file, unplanned = true) {
    const plannedText = unplanned ? 'Unplanned' : 'Planned';
    const inputClipDir = path.join(inputDir, date, 'DETMOT', plannedText, droneName, clipName);
    const fileName = file.split('.')[0];

    const fileURL = path.join(inputClipDir, 'TXT', fileName+'.txt');
    // Read the file content synchronously
    const fileContent = fs.readFileSync(fileURL, 'utf8');
    // Split the file content by new line character '\n'
    const lines = fileContent.trim().split('\n');

    //get Content metadata klv
    const klvFileUrl = path.join(inputClipDir, 'metadata_klv.csv');
    const fileKLVContent = fs.readFileSync(klvFileUrl, 'utf8');
    const linesKLV = fileKLVContent.trim().split('\n').map(line => line.split(',')).sort((a, b) => a[0] - b[0]);

    //get content metadata ppk
    const ppkFileUrl = path.join(inputClipDir, 'metadata_ppk.csv')
    const filePPKContent = fs.readFileSync(ppkFileUrl, 'utf8');
    const linesPPK = filePPKContent.trim().split('\n').map(line => line.split(',')).sort((a, b) => a[0] - b[0]);

    const timeOfFile = frameIndexToTime(linesKLV[1][0], fileName*1);
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

    const outputDir = path.join(date, PATH_STRING.train, PATH_STRING.det_mot, plannedText, droneName, clipName);
    const outputMetaDir = path.join(outputDir, PATH_STRING.meta)
    if (!fs.existsSync(outDir+ outputMetaDir)) {
        createDirectory(outputMetaDir)
    }

    const fileKlv = `${date}_${droneName}_${clipName}_${fileName.slice(-digitFileName)}.txt`;
    const filePpk = `${date}_${droneName}_${clipName}_${fileName.slice(-digitFileName)}(PPK).txt`;
    fs.writeFileSync(path.join(outDir, outputMetaDir, fileKlv), contentMetadataKLV.toString());
    fs.writeFileSync(path.join(outDir, outputMetaDir, filePpk), contentMetadataPPK.toString());

    // Process each line and join them with '\n' to form the new content
    const newContent = lines.map(line => processDETLine(line)).join('\n');
    const outputDETPath = path.join(outputDir, PATH_STRING.det);
    if (!fs.existsSync(outDir+outputDETPath)) {
        createDirectory(outputDETPath)
    }
    fs.writeFileSync(path.join(outDir, outputDETPath, `${date}_${droneName}_${clipName}_${fileName.slice(-digitFileName)}.txt`), newContent);

    const outputDETVisualizedPath = path.join(outputDir, PATH_STRING.det_visualized);
    if (!fs.existsSync(outDir + outputDETVisualizedPath)) {
        createDirectory(outputDETVisualizedPath)
    }
    const imgURL = path.join(inputClipDir, 'images', fileName+'.png');

    const pathOutImg = path.join(outDir, outputDETVisualizedPath, `${date}_${droneName}_${clipName}_${fileName.slice(-digitFileName)}.jpg`);

    const outputMOTVisualizedPath = path.join(outputDir, PATH_STRING.mot_visualized);
    const pathOutMOTVisualized = path.join(outDir, outputMOTVisualizedPath, `${date}_${droneName}_${clipName}_${fileName.slice(-digitFileName)}.jpg`);
    if (!fs.existsSync(outDir + outputMOTVisualizedPath)) {
        createDirectory(outputMOTVisualizedPath)
    }
    handleImageDET(imgURL, pathOutImg, pathOutMOTVisualized, lines)
    handleImageMOT(imgURL, pathOutMOTVisualized, lines)

    if (!fs.existsSync(path.join(outDir, outputDir, PATH_STRING.images))) {
        createDirectory(path.join(outputDir, PATH_STRING.images))
    }
    handleImageMoving(imgURL, path.join(outDir, outputDir, PATH_STRING.images, `${date}_${droneName}_${clipName}_${fileName.slice(-digitFileName)}.jpg`))

    //return MOT content file
    const newContentMOT = lines.map(line => processMOTLine(line, fileName)).join('\n');
    return newContentMOT;
}

function convertInputToDETMOT(date, drone, clip, droneDir, unplanned) {
    indexOfFrame = 1;
    const plannedText = unplanned ? 'Unplanned' : 'Planned';
    const motContentFile = [];
    const clipDir = path.join(droneDir, clip);
    if(fs.readdirSync(path.join(clipDir)).length === 0 ) return;
    const detFolderFiles = fs.readdirSync(path.join(clipDir, 'TXT'))
    // Filter out only .txt files
    const detFiles = detFolderFiles.filter(file => path.extname(file).toLowerCase() === '.txt').sort((a, b) => a - b);
    // Process each .txt file
    detFiles.forEach(file => {
        const contentLine = convertTxtToDet(date, drone, clip, file, unplanned);
        motContentFile.push(contentLine);
    });

    const newContent = motContentFile.join('\n');

    const outputFilePath = path.join(date, PATH_STRING.train, PATH_STRING.det_mot, plannedText, drone, clip, PATH_STRING.mot);

    if (!fs.existsSync(outDir+outputFilePath)) {
        createDirectory(outputFilePath)
    }
    fs.writeFileSync(path.join(outDir, outputFilePath, `${date}_${drone}_${clip}.txt`), newContent);
}

function processMOTLine(line, fileName) {
    // Split the line by comma ','
    const values = line.split(',').map(value => value.trim());
    const cx = 1*values[DETInputFormat.minx] + values[DETInputFormat.width]/2;
    const cy = 1*values[DETInputFormat.miny] + values[DETInputFormat.height]/2;
    const target_id = values[DETInputFormat.name]?.split('_');

    const newValues = {
        'frame_index': fileName.slice(-digitFileName),
        'target_id': target_id[0],
        'bbox_cx': cx,
        'bbox_cy': cy,
        'bbox_width': values[DETInputFormat.width],
        'bbox_height': values[DETInputFormat.height],
        'score': 0,
        'object_category': target_id[1],
        'object_subcategory': 1,
        'truncation': 0,
        'occlusion': 0
    }
    // Join the values back with comma ','
    return MOTOutputFormat.map(item => newValues[item]);
}

function convertTxtToMOT (date, droneName, clipName, file, unplanned = true) {
    const plannedText = unplanned ? 'Unplanned' : 'Planned';
    const inputClipDir = path.join(inputDir, date, 'DETMOT', plannedText, droneName, clipName);
    // Read the file content synchronously
    const fileURL = path.join(inputClipDir, 'MOT', file);
    const fileContent = fs.readFileSync(fileURL, 'utf8');

    // Split the file content by new line character '\n'
    const lines = fileContent.trim().split('\n');
    
    // Process each line and join them with '\n' to form the new content
    const newContent = lines.map(line => processMOTLine(line)).join('\n');
    const outputFilePath = `/${date}/${PATH_STRING.train}/${PATH_STRING.det_mot}/${plannedText}/${droneName}/${clipName}/${PATH_STRING.mot}`;
    if (!fs.existsSync(outDir+outputFilePath)) {
        createDirectory(outputFilePath)
    }
    fs.writeFileSync(path.join(outDir+outputFilePath, `${date}_${droneName}_${clipName}.txt`), newContent);
}

function contentMCMOT(date, clip, segments) {
    let resultTargetMain = '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n';
    let resultTargetBox = '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n';
    let resultTargetPos = '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n';

    const mcmotDronesDir = `${inputDir}/${date}/MCMOT/${clip}/`;
    const filesMCMOTDrones = fs.readdirSync(mcmotDronesDir);
    let xxx = []
    if(filesMCMOTDrones.length > 0) {
        filesMCMOTDrones.forEach(drone => {
            const filesInDrones = fs.readdirSync(path.join(mcmotDronesDir, drone));
            if(filesInDrones.length === 0 ) {
                return;
            }
            // Read the file content synchronously
            const fileKlvURL =  `${inputDir}/${date}/MCMOT/${clip}/${drone}/metadata_klv.csv`;
            const filePpkURL =  `${inputDir}/${date}/MCMOT/${clip}/${drone}/metadata_ppk.csv`;
            const fileSpeedURL =  `${inputDir}/${date}/MCMOT/${clip}/${drone}/metadata_speed.csv`;
            const fileKvlContent = fs.readFileSync(fileKlvURL, 'utf8');
            const filePpkContent = fs.readFileSync(filePpkURL, 'utf8');

            // Split the file content by new line character '\n'
            let lines = fileKvlContent.trim().split('\n');
            let speedData = fileSpeedURL.trim().split('\n');
            let ppk = filePpkContent.trim().split('\n');
            lines.shift();
            ppk.shift();

            const rootTime = addDifferenceTime(lines[0].split(",")[0], klvTimeDifference);
            let startTime = frameIndexToTime(rootTime, parseInt(segments[0].split(',')[0]));
            lines = sortPromax(lines, startTime, klvTimeDifference);
            ppk = sortPromax(ppk, startTime, ppkTimeDifference);
            speedData = sortPromax(speedData, startTime, 0);

            let indexA = 0;
            const iklv0 = extraDataMCMOT(lines[0], drone);
            xxx.push({segment: segments[0], klv: iklv0, ppk: ppk[0], speed: speedData[0], drone});

            for (let i = 1; i < segments.length; i++) {
                if (indexA < lines.length) {
                    const iii = segments[i].split(',')[0];
                    const iiiTime = frameIndexToTime(rootTime, iii);
                    let klvTime = addDifferenceTime(lines[indexA].split(',')[0], klvTimeDifference);
                    let ppkTime = addDifferenceTime(ppk[indexA].split(',')[0], ppkTimeDifference);
                    let speedTime = addDifferenceTime(speedData[indexA].split(',')[0], 0);

                    let xx = indexA;
                    if (iii === segments[i - 1].split(',')[0]) {
                        xxx.push({...xxx[xxx.length - 1], segment: segments[i]});
                    } else {
                        while (indexA < lines.length && (klvTime <= iiiTime || ppkTime <= iiiTime || speedTime <= iiiTime)) {
                            indexA++;
                            xx = indexA;
                            klvTime = addDifferenceTime(lines[indexA].split(',')[0], klvTimeDifference);
                            ppkTime = addDifferenceTime(ppk[indexA].split(',')[0], ppkTimeDifference);
                            speedTime = addDifferenceTime(speedData[indexA].split(',')[0], 0);
                            
                            const prevKlvTime = addDifferenceTime(lines[indexA - 1].split(',')[0], klvTimeDifference);
                            const prevPpkTime = addDifferenceTime(ppk[indexA - 1].split(',')[0], ppkTimeDifference);
                            const prevSpeedTime = addDifferenceTime(speedData[indexA - 1].split(',')[0], 0);
                            
                            if (Math.abs(prevKlvTime - iiiTime) < Math.abs(iiiTime - klvTime) ||
                                Math.abs(prevPpkTime - iiiTime) < Math.abs(iiiTime - ppkTime) ||
                                Math.abs(prevSpeedTime - iiiTime) < Math.abs(iiiTime - speedTime)) {
                                xx = indexA - 1;
                            }
                        }
                        const iklv = extraDataMCMOT(lines[xx], drone);
                        xxx.push({segment: segments[i], klv: iklv, ppk: ppk[xx], speed: speedData[xx], drone});
                    }
                }
            }

        })

        const ck = {}
        for (let i = 0; i < xxx.length; i++) {
            const values = xxx[i].segment.split(",");
            const ppk = xxx[i].ppk.split(",");
            const klv = xxx[i].klv.split(",");
            const drone = xxx[i].drone;
            //add data to targetMain
            if (!ck[values[1] + values[2]] ) {
                let category = '0'
                switch (valueToText(values[1])) {
                    case 'bus':
                        category = '1'
                        break;
                    case 'truck':
                        category = '2'
                    break;
                }
                resultTargetMain += '\t<object>\n';
                resultTargetMain += '\t\t<target_id_global>' + valueToText(values[1]) + valueToText(values[2])+ '</target_id_global>\n';
                resultTargetMain += '\t\t<object_category>' + category + '</object_category>\n';
                resultTargetMain += '\t\t<object_subcategory>' + '1' + '</object_subcategory>\n';
                resultTargetMain += '\t\t<box_id>' + valueToText(values[1]) + '</box_id>\n';
                resultTargetMain += '\t</object>\n';
                ck[values[1] + values[2]] = 1
            }

            //add data to targetPos
            resultTargetPos += '\t<object>\n';
            resultTargetPos += '\t\t<target_id_global>' + valueToText(values[1]) + valueToText(values[2])+ '</target_id_global>\n';
            resultTargetPos += '\t\t<avs_id>' + valueToText(drone) + '</avs_id>\n';
            resultTargetPos += '\t\t<frame_index>' + valueToText(values[0]) + '</frame_index>\n';
            resultTargetPos += '\t\t<target_pos_lat>' + valueToText(ppk[5]) + '</target_pos_lat>\n';
            resultTargetPos += '\t\t<target_pos_long>' + valueToText(ppk[6]) + '</target_pos_long>\n';
            resultTargetPos += '\t\t<target_pos_alt>' + valueToText(ppk[7]) + '</target_pos_alt>\n';
            resultTargetPos += '\t</object>\n';

            //add data to targetBox
            const cx = +values[2] + values[4]/2
            const cy = +values[3] + values[5]/2
            resultTargetBox += '\t<object>\n';
            resultTargetBox += '\t\t<box_id>' + valueToText(values[2]) + '</box_id>\n';
            resultTargetBox += '\t\t<avs_id>' + valueToText(drone) + '</avs_id>\n';
            resultTargetBox += '\t\t<frame_index>' + valueToText(values[0]) + '</frame_index>\n';
            resultTargetBox += '\t\t<bbox_cx>' + cx + '</bbox_cx>\n';
            resultTargetBox += '\t\t<bbox_cy>' + cy + '</bbox_cy>\n';
            resultTargetBox += '\t\t<bbox_width>' + valueToText(values[5]) + '</bbox_width>\n';
            resultTargetBox += '\t\t<bbox_height>' + valueToText(values[6]) + '</bbox_height>\n';
            // resultTargetBox += '\t\t<score>' + valueToText(values[6]) + '</score>\n';
            // resultTargetBox += '\t\t<truncation>' + valueToText(values[7]) + '</truncation>\n';
            // resultTargetBox += '\t\t<occlusion>' + valueToText(values[8]) + '</occlusion>\n';
            resultTargetBox += '\t\t<precision_time_stamp>' + valueToText(klv[0]) + '</precision_time_stamp>\n';
            resultTargetBox += '\t\t<platform_tail_number>' + valueToText(klv[-1]) + '</platform_tail_number>\n';
            resultTargetBox += '\t\t<platform_heading_angle>' + valueToText(klv[1]) + '</platform_heading_angle>\n';
            resultTargetBox += '\t\t<platform_pitch_angle>' + valueToText(klv[2]) + '</platform_pitch_angle>\n';
            resultTargetBox += '\t\t<platform_roll_angle>' + valueToText(klv[3]) + '</platform_roll_angle>\n';
            resultTargetBox += '\t\t<platform_designation>' + valueToText(klv[-1]) + '</platform_designation>\n';
            resultTargetBox += '\t\t<image_source_sensor>' + valueToText(klv[4]) + '</image_source_sensor>\n';
            resultTargetBox += '\t\t<sensor_latitude>' + valueToText(ppk[5]) + '</sensor_latitude>\n';
            resultTargetBox += '\t\t<sensor_longitude>' + valueToText(ppk[6]) + '</sensor_longitude>\n';
            resultTargetBox += '\t\t<sensor_true_altitude>' + valueToText(ppk[7]) + '</sensor_true_altitude>\n';
            resultTargetBox += '\t\t<sensor_horizontal_field_of_view>' + valueToText(klv[8]) + '</sensor_horizontal_field_of_view>\n';
            resultTargetBox += '\t\t<sensor_vertical_field_of_view>' + valueToText(klv[9]) + '</sensor_vertical_field_of_view>\n';
            resultTargetBox += '\t\t<sensor_relative_azimuth_angle>' + valueToText(klv[10]) + '</sensor_relative_azimuth_angle>\n';
            resultTargetBox += '\t\t<sensor_relative_elevation_angle>' + valueToText(klv[11]) + '</sensor_relative_elevation_angle>\n';
            resultTargetBox += '\t\t<sensor_relative_roll_angle>' + valueToText(klv[12]) + '</sensor_relative_roll_angle>\n';
            resultTargetBox += '\t\t<slant_range>' + valueToText(klv[13]) + '</slant_range>\n';
            resultTargetBox += '\t\t<frame_center_latitude>' + valueToText(klv[14]) + '</frame_center_latitude>\n';
            resultTargetBox += '\t\t<frame_center_longitude>' + valueToText(klv[15]) + '</frame_center_longitude>\n';
            resultTargetBox += '\t\t<frame_center_elevation>' + valueToText(klv[16]) + '</frame_center_elevation>\n';
            resultTargetBox += '\t\t<offset_corner_latitude_point_1>' + valueToText(klv[17]) + '</offset_corner_latitude_point_1>\n';
            resultTargetBox += '\t\t<offset_corner_longitude_point_1>' + valueToText(klv[18]) + '</offset_corner_longitude_point_1>\n';
            resultTargetBox += '\t\t<offset_corner_latitude_point_2>' + valueToText(klv[19]) + '</offset_corner_latitude_point_2>\n';
            resultTargetBox += '\t\t<offset_corner_longitude_point_2>' + valueToText(klv[20]) + '</offset_corner_longitude_point_2>\n';
            resultTargetBox += '\t\t<offset_corner_latitude_point_3>' + valueToText(klv[21]) + '</offset_corner_latitude_point_3>\n';
            resultTargetBox += '\t\t<offset_corner_longitude_point_3>' + valueToText(klv[22]) + '</offset_corner_longitude_point_3>\n';
            resultTargetBox += '\t\t<offset_corner_latitude_point_4>' + valueToText(klv[23]) + '</offset_corner_latitude_point_4>\n';
            resultTargetBox += '\t\t<offset_corner_longitude_point_4>' + valueToText(klv[24]) + '</offset_corner_longitude_point_4>\n';
            resultTargetBox += '\t\t<plaftform_speed>' + '0' + '</plaftform_speed>\n';
            // resultTargetBox += '\t\t<sensor_exposure_time>' + valueToText(klv[-1]) + '</sensor_exposure_time>\n';
            // resultTargetBox += '\t\t<platform-cam_rotation_matrix>' + valueToText(klv[-1]) + '</platform-cam_rotation_matrix>\n';   
            resultTargetBox += '\t\t<ins_pitch_alignment_day>' + valueToText(klv[25]) + '</ins_pitch_alignment_day>\n';
            resultTargetBox += '\t\t<px2cb_x_day>' + valueToText(klv[26]) + '</px2cb_x_day>\n';
            resultTargetBox += '\t\t<px2cb_y_day>' + valueToText(klv[27]) + '</px2cb_y_day>\n';
            resultTargetBox += '\t\t<px2cb_z_day>' + valueToText(klv[28]) + '</px2cb_z_day>\n';
            resultTargetBox += '\t</object>\n';
        }
    }

    resultTargetBox += '</root>';
    resultTargetMain += '</root>';
    resultTargetPos += '</root>';
    return [resultTargetBox, resultTargetMain, resultTargetPos];
}

function convertTxtToMCMOT(date, clip) {
    let fileData = []
    const clipFolderFiles = fs.readdirSync(path.join(inputDir, date, 'MCMOT', clip));
    clipFolderFiles.forEach(drone => {
        const droneOutDir = path.join(date, PATH_STRING.train,'MCMOT', clip, drone)
        if (!fs.existsSync(outDir+droneOutDir)) {
            createDirectory(droneOutDir)
        }

        const filesInDrones = fs.readdirSync(path.join(inputDir, date, 'MCMOT', clip, drone));
        if(filesInDrones.length === 0 ) {
            return;
        }
        
        const droneImgOutDir = path.join(droneOutDir, PATH_STRING.mcmot_visualized);
        if (!fs.existsSync(outDir+droneImgOutDir)) {
            createDirectory(droneImgOutDir)
        }

        const droneImgFiles = fs.readdirSync(path.join(inputDir, date, 'MCMOT', clip, drone, 'images'));
        if(droneImgFiles.length > 0) {
            for (let i=0; i < droneImgFiles.length; i += 3) {
            // for (let i=0; i < 3; i++) {
                const img = droneImgFiles[i]

                const imgURL = path.join(inputDir, date, 'MCMOT', clip, drone, 'images', img);
                const fileName = img.split('.')[0];

                const outputDir = path.join(date, PATH_STRING.train, PATH_STRING.mcmot, drone, clip);
                const pathOutImg = path.join(outDir, droneImgOutDir, `${date}_${clip}_${drone}_${fileName.slice(-digitFileName)}.jpg`);

                if (!fs.existsSync(path.join(outDir, outputDir, PATH_STRING.images))) {
                    createDirectory(path.join(outputDir, PATH_STRING.images))
                }

                const txtFile = `${inputDir}/${date}/MCMOT/${clip}/${drone}/TXT/${fileName}.txt`
                let objs = []
                if (fs.existsSync(txtFile)) {
                    const txtFileContent = fs.readFileSync(txtFile, 'utf8');
                    objs = txtFileContent.trim().split('\n');
                    fileData = [...fileData, ...objs]
                }
                // console.log('objs', fileData)
                handleImageBoxMCMOT(imgURL, pathOutImg, objs)
                
                // handleImageMoving(imgURL, path.join(outDir, droneImgOutDir, `${date}_${clip}_${drone}_${fileName.slice(-digitFileName)}.jpg`))
            }

            const [contentTargetBox, contentTargetMain, contentTargetPos] = contentMCMOT(date, clip, fileData)
            
            exportXmlToFile(contentTargetBox, `${outDir}/${date}/${PATH_STRING.train}/${PATH_STRING.mcmot}/${clip}/${PATH_STRING.mcmot_target_box}/${date}_${clip}.xml`)
            exportXmlToFile(contentTargetMain,  `${outDir}/${date}/${PATH_STRING.train}/${PATH_STRING.mcmot}/${clip}/${PATH_STRING.mcmot_target_main}/${date}_${clip}.xml`)
            exportXmlToFile(contentTargetPos,  `${outDir}/${date}/${PATH_STRING.train}/${PATH_STRING.mcmot}/${clip}/${PATH_STRING.mcmot_target_pos}/${date}_${clip}.xml`)
        }
    })
}

// Function to handle image upload
function handleImageBoxMCMOT(fileInput, path, objects) {
    return new Promise((resolve, reject) => {
        try {
            fs.readFile(fileInput, (err, data) => {
                // if (err) resolve(err);
        
                loadImage(data).then((img) => {
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);
                    // Draw bounding box and text
                    objects.forEach(object => {
                        object = object.split(',')
                        const xcenter = +[3]*1 + object[5]/2;
                        const ycenter = object[4]*1 + object[6]/2;
                        const width = object[5];
                        const height = object[6];
                        const nem = object[1] + object[2]
                        const boxid = object[2]
                        const color = getFixedColor(nem)
                        drawText(nem, xcenter - width/2 + 2, ycenter - height/2 - 5);
                        drawBoundingBox(ctx, xcenter, ycenter, width, height, color);
                    });
        
                    // Save the canvas as an image file
                    const out = fs.createWriteStream(path);
                    const stream = canvas.createPNGStream();
                    stream.pipe(out);
                    // out.on('finish', () => console.log(path));
                    resolve()
                }).catch((err) => {
                    console.error('Error loading image:', err);
                    reject()
                });
            });
        } catch (error) {
            reject()
        }
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
        });
    });
}
2
// Main function
async function convert(params) {
    try {        
        inputDir = params.input;
        outDir = params.output;
        mod = params.mode;
        fps =params.fps;

        // Check if the current directory exists
        if (!fs.existsSync(outDir)) {
            // If not, create it
            fs.mkdirSync(outDir);
        }

        const filesDate = fs.readdirSync(inputDir);
        if(filesDate.length > 0) {
            filesDate.forEach(date => {
                createBaseForder(path.join(outDir, date));
                
                if(!mod || mod === '1') {
                    const DETMOTFolder = fs.readdirSync(`${inputDir}/${date}/DETMOT`);

                    if(DETMOTFolder.length > 0) {
                        DETMOTFolder.forEach(unplanned => {
                            const dirDETMOTUnplanned = `${inputDir}/${date}/DETMOT/${unplanned}`;
                            createDirectory(path.join(date, PATH_STRING.train, PATH_STRING.det_mot, unplanned))
                            // Read all files in the directory
                            const filesDETDrones = fs.readdirSync(dirDETMOTUnplanned);
        
                            if(filesDETDrones.length > 0) {
                                filesDETDrones.forEach(drone => {
                                    const droneDir = path.join(dirDETMOTUnplanned, drone);
                                    createDirectory(path.join(date, PATH_STRING.train, PATH_STRING.det_mot, unplanned, drone))
                                    // Read all files in the Unplanned directory
                                    const filesDETClips = fs.readdirSync(droneDir);
                                    if(filesDETClips.length > 0) {
                                        filesDETClips.forEach(clip => {
                                            convertInputToDETMOT(date, drone, clip, droneDir, unplanned === 'Unplanned')
                                        })
                                    }
                                });
                            };
                        })
                    }
                }

                if(!mod || mod === '2') {
                    createBaseForder(path.join(outDir, date));
                    const clipsFiles = fs.readdirSync(path.join(inputDir, date, 'MCMOT'));
                    if(clipsFiles.length > 0) {
                        clipsFiles.forEach(clip => {
                            convertTxtToMCMOT(date, clip);
                        })
                    }
                }
            })
        }

        // await convertToFrames(inputVideo, outputFramesDir, fps);
        // await convertXML2JSON('label.xml');
        // await convertToVideo('frames2', outputVideo, fps)
        console.log('Conversion complete.');
    } catch (error) {
        console.error('Error during conversion:', error);
    }
}

// Run the main function
module.exports = {convert}