const { exec } = require('child_process');
const fs = require('fs');
const {parseString} = require('xml2js')
const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const { DETInputFormat, MOTInputFormat, KLVInputFormat, PPKInputFormat } = require('./input_format_constants');
const { DETOutputFormat, MOTOutputFormat, metadataOutputFormat } = require('./output_format_constants');
const { handleImageMoving } = require('./images');


// Define input and output filenames

let inputDir = 'C:/Users/PC/Downloads/input';
let outDir = 'C:/Users/PC/Documents/s92';
let mod = 'all';
let fps = 50;
const digitFileName = 5;

const PATH_STRING = {
    test: 'Test',
    train: 'Train',
    val: 'Val',
    det_mot: 'DETMOT',
    mcmot: 'MCMOT',
    det: 'Annotation Det',
    det_visualized: 'Annotation Det Visualized',
    mot: 'Annotation MOT',
    mot_visualized: 'Annotation MOT Visualized',
    images: 'Images',
    meta: 'Meta',
    mcmot_target_box: 'Annotation MCMOT TargetBox',
    mcmot_target_main: 'Annotation MCMOT TargetMain',
    mcmot_target_pos: 'Annotation MCMOT TargetPos',
    mcmot_visualized: 'Annotation MCMOT Visualized'
}

// Create a canvas and context
const canvas = createCanvas(500, 500);
const ctx = canvas.getContext('2d');


// Function to create directory recursively
function createDirectory(dirPath) {
    // Split the path into individual directories
    const dirs = dirPath.split(path.sep);
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
            }
            if (!fs.existsSync(path.join(outDir, PATH_STRING.test))) {
                fs.mkdirSync(path.join(outDir, PATH_STRING.test));
                fs.mkdirSync(path.join(outDir, PATH_STRING.train))
                fs.mkdirSync(path.join(outDir, PATH_STRING.val));
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
        'object_category': 1,
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
    const timestamp = (index / fps) * 1000
    const date = new Date(startTime)
    const timestampFromDateString = date.getTime() + timestamp
    return timestampFromDateString
}

let indexOfFrame = 1;
function convertTxtToDet (date, droneName, clipName, file, unplanned = true) {
    const plannedText = unplanned ? 'Unplanned' : 'Planned';
    const inputClipDir = path.join(inputDir, date, 'DETMOT', plannedText, droneName, clipName);
    const fileURL = path.join(inputClipDir, 'TXT', file);
    // Read the file content synchronously
    const fileContent = fs.readFileSync(fileURL, 'utf8');
    const fileName = file.split('.')[0];
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
    handleImageUpload(imgURL, pathOutImg, lines)

    if (!fs.existsSync(path.join(outDir, outputDir, PATH_STRING.images))) {
        createDirectory(path.join(outputDir, PATH_STRING.images))
    }
    handleImageMoving(imgURL, path.join(outDir, outputDir, PATH_STRING.images, `${date}_${droneName}_${clipName}_${fileName.slice(-digitFileName)}.jpg`))
}

function processMOTLine(line) {
    // Split the line by comma ','
    const values = line.split(',').map(value => value.trim());
    const cx = 1*values[MOTInputFormat.minx] + values[MOTInputFormat.width]/2;
    const cy = 1*values[MOTInputFormat.miny] + values[MOTInputFormat.height]/2;
   
    const newValues = {
        'frame_index': values[MOTInputFormat.frameNo],
        'target_id': `car0${values[MOTInputFormat.id]}`,
        'bbox_cx': cx,
        'bbox_cy': cy,
        'bbox_width': values[MOTInputFormat.width],
        'bbox_height': values[MOTInputFormat.height],
        'score': 0,
        'object_category': 1,
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

function sortPromax(arr, start, ppkList) {
    let res = [];
    let ppk = [];
    let min;
    let minItem;
    let ppkItem;
    for (let i = 0; i < arr.length; i++) {
        const item = arr[i];
        const pp = ppkList[i];
        const num = new Date(item.split(',')[0]).getTime();
        if (num >= start) {
            res.push(item);
            ppk.push(pp);
            for (let j = res.length - 1; j > 0; j--) {
                const g1 = new Date(res[j].split(',')[0]).getTime();
                const g0 = new Date(res[j - 1].split(',')[0]).getTime();
                if (g1 < g0) {
                    [res[j], res[j - 1]] = [res[j - 1], res[j]];
                    [ppk[j], ppk[j - 1]] = [ppk[j - 1], ppk[j]];
                } else {
                    break;
                }
            }
        } else {
            if (!min || start - num < min) {
                min = start - num
                minItem = item
                ppkItem = pp
            }
        }
    }
    if (min < new Date(res[0].split(',')[0]).getTime() - start) {
        res = [minItem, ...res]
        ppk = [ppkItem, ...ppk]
    }

    return {ppk, res}
}

function contentMCMOT(date, clip) {
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
            const mcmotFileUrl = `${inputDir}/${date}/MCMOT/${clip}/${drone}/MOT/`;
            const mcmotFiles = fs.readdirSync(mcmotFileUrl);
            const fileKvlContent = fs.readFileSync(fileKlvURL, 'utf8');
            const filePpkContent = fs.readFileSync(filePpkURL, 'utf8');
            const mcmotContent = fs.readFileSync(`${inputDir}/${date}/MCMOT/${clip}/${drone}/MOT/${mcmotFiles}`, 'utf8');

            // Split the file content by new line character '\n'
            const segments = mcmotContent.trim().split('\n');
            let lines = fileKvlContent.trim().split('\n');
            let ppk = filePpkContent.trim().split('\n');
            lines.shift();
            ppk.shift();

            const rootTime = lines[0].split(",")[0]
            let startTime = frameIndexToTime(rootTime, segments[0].split(',')[0])
            const res = sortPromax(lines, startTime, ppk)
            lines = res.res;
            ppk = res.ppk;

            const zzz = [frameIndexToTime(rootTime, 17521)]
            zzz.push(frameIndexToTime(rootTime, 17522))
            zzz.push(17123,frameIndexToTime(rootTime, 17123))
            zzz.push(frameIndexToTime(rootTime, 17124))
            zzz.push(frameIndexToTime(rootTime, 17125))
            zzz.push(frameIndexToTime(rootTime, 17126))
            zzz.push(frameIndexToTime(rootTime, 17127))
            zzz.push(17531, frameIndexToTime(rootTime, 17531))
            zzz.push(frameIndexToTime(rootTime, 17132))
            zzz.push(frameIndexToTime(rootTime, 17133))
            zzz.push(frameIndexToTime(rootTime, 17134))
            zzz.push(frameIndexToTime(rootTime, 17135))
            zzz.push(17141, frameIndexToTime(rootTime, 17141))
            zzz.push(frameIndexToTime(rootTime, 17142))
            zzz.push(frameIndexToTime(rootTime, 17143))
            zzz.push(frameIndexToTime(rootTime, 17144))
            zzz.push(frameIndexToTime(rootTime, 17145))
            // console.log('zzz', zzz)

            function extraData(item, dr) {
                switch (dr) {
                    case '2':
                        item += `,-11,2,0.7,184.6`;
                        break;
                    case '3':
                        item += `,5,0.4,2,178`;
                        break;
                    case '4':
                        item += `,-11,-2,0.6,182`;
                        break;
                    case '5':
                        item += `,-11,-0.6,-3,181`;
                        break;
                }

                return item
            }
        
            let indexA = 0;
            xxx.push({segment: segments[0], klv: lines[0], ppk: ppk[0], drone: drone})
            for (let i = 1; i < segments.length; i++) {
                if (indexA < lines.length) {
                    const iii = segments[i].split(',')[0];
                    const iiiTime = frameIndexToTime(rootTime, iii);
                    let klvTime = (new Date(lines[indexA].split(',')[0])).getTime();
                    let xx = indexA
                    if (iii === segments[i - 1].split(',')[0]) {
                        xxx.push({...xxx[xxx.length - 1], segment: segments[i]});
                    } else {
                        while (indexA < lines.length && klvTime <= iiiTime) {
                            indexA++;
                            xx = indexA;
                            klvTime = (new Date(lines[indexA].split(',')[0])).getTime();
                            const nextKlvTime = (new Date(lines[indexA - 1].split(',')[0])).getTime();
                            if (Math.abs(nextKlvTime - iiiTime) < Math.abs(iiiTime - klvTime)) {
                                xx = indexA - 1
                            }
                        }
                        xxx.push({segment: segments[i], klv: lines[xx], ppk: ppk[xx], drone});
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
            if (!ck[values[1]] ) {
                resultTargetMain += '\t<object>\n';
                resultTargetMain += '\t\t<target_id_global>car0' + valueToText(values[1]) + '</target_id_global>\n';
                resultTargetMain += '\t\t<object_category>' + '1' + '</object_category>\n';
                resultTargetMain += '\t\t<object_subcategory>' + '1' + '</object_subcategory>\n';
                resultTargetMain += '\t\t<box_id>box0' + valueToText(values[1]) + '</box_id>\n';
                resultTargetMain += '\t</object>\n';
                ck[values[1]] = 1
            }

            //add data to targetPos
            resultTargetPos += '\t<object>\n';
            resultTargetPos += '\t\t<target_id_global>car0' + valueToText(values[1]) + '</target_id_global>\n';
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
            resultTargetBox += '\t\t<box_id>box0' + valueToText(values[1]) + '</box_id>\n';
            resultTargetBox += '\t\t<avs_id>' + valueToText(drone) + '</avs_id>\n';
            resultTargetBox += '\t\t<frame_index>' + valueToText(values[0]) + '</frame_index>\n';
            resultTargetBox += '\t\t<bbox_cx>' + cx + '</bbox_cx>\n';
            resultTargetBox += '\t\t<bbox_cy>' + cy + '</bbox_cy>\n';
            resultTargetBox += '\t\t<bbox_width>' + valueToText(values[4]) + '</bbox_width>\n';
            resultTargetBox += '\t\t<bbox_height>' + valueToText(values[5]) + '</bbox_height>\n';
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


function valueToText(val) {
    if (!val) {
        return 'Null'
    }

    return val.trim().replace(/\0+$/, '')
}

function convertTxtToMCMOT(date, clip) {

    const [contentTargetBox, contentTargetMain, contentTargetPos] = contentMCMOT(date, clip)
    
    exportXmlToFile(contentTargetBox, `${outDir}/${date}/${PATH_STRING.train}/${PATH_STRING.mcmot}/${clip}/${PATH_STRING.mcmot_target_box}/${date}_${clip}.xml`)
    exportXmlToFile(contentTargetMain,  `${outDir}/${date}/${PATH_STRING.train}/${PATH_STRING.mcmot}/${clip}/${PATH_STRING.mcmot_target_main}/${date}_${clip}.xml`)
    exportXmlToFile(contentTargetPos,  `${outDir}/${date}/${PATH_STRING.train}/${PATH_STRING.mcmot}/${clip}/${PATH_STRING.mcmot_target_pos}/${date}_${clip}.xml`)

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
            droneImgFiles.forEach(img => {
                const imgURL = path.join(inputDir, date, 'MCMOT', clip, drone, 'images', img);
                const fileName = img.split('.')[0];
                handleImageMoving(imgURL, path.join(outDir, droneImgOutDir, `${date}_${clip}_${drone}_${fileName.slice(-digitFileName)}.jpg`))
            })
        }
    })
}

// Draw text 
function drawText(text, y, x, color = 'green') {
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
function handleImageUpload(fileInput, path, objects) {
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
                    const xcenter = (object[3]*1 + object[5]*1) /2;
                    const ycenter = (object[4]*1 + object[6]*1) /2;
                    const width = (object[5]*1 - object[3]*1);
                    const height = (object[6]*1 - object[4]*1);

                    drawText(`1`, xcenter - width/2 + 2, ycenter - height/2 - 5);
                    drawBoundingBox(ctx, xcenter, ycenter, width, height, 'green'); 
                });
    
                // Save the canvas as an image file
                const out = fs.createWriteStream(path);
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
                            createDirectory(path.join(date, PATH_STRING.train,  PATH_STRING.det_mot, unplanned))
                            // Read all files in the directory
                            const filesDETDrones = fs.readdirSync(dirDETMOTUnplanned);
        
                            if(filesDETDrones.length > 0) {
                                filesDETDrones.forEach(drone => {
                                    const droneDir = path.join(dirDETMOTUnplanned, drone);
                                    createDirectory(path.join(date, PATH_STRING.train,  PATH_STRING.det_mot, unplanned, drone))
                                    // Read all files in the Unplanned directory
                                    const filesDETClips = fs.readdirSync(droneDir);
                                    if(filesDETClips.length > 0) {
                                        filesDETClips.forEach(clip => {
                                            indexOfFrame = 1;
                                            const clipDir = path.join(droneDir, clip);
                                            const detFolderFiles = fs.readdirSync(path.join(clipDir, 'TXT'))
                                            // Filter out only .txt files
                                            const detFiles = detFolderFiles.filter(file => path.extname(file).toLowerCase() === '.txt').sort((a, b) => a - b);
                                            // Process each .txt file
                                            detFiles.forEach(file => {
                                                convertTxtToDet(date, drone, clip, file, unplanned === 'Unplanned');
                                            });
                        
                                            const motFolderFiles = fs.readdirSync(path.join(clipDir, 'MOT'))
                                            //const motFiles = motFolderFiles.filter(file => path.extname(file).toLowerCase() === '.txt');
                                            // Process each .txt file
                                            motFolderFiles.forEach(file => {
                                                convertTxtToMOT(date, drone, clip, file, unplanned === 'Unplanned');
                                            });
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