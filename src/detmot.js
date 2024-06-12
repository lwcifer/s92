import fs from 'fs';
import path, { resolve } from 'path';
import { exec } from 'child_process';

import { DETInputFormat, KLVInputFormat, PPKInputFormat, KLVInputFormatMSL } from '../input_format_constants.js';
import { DETOutputFormat, MOTOutputFormat, metadataOutputFormat } from '../output_format_constants.js';
import { addDifferenceTime, timeDifference, convertNumberToAnyDigit, uCreateDirectory, uFrameIndexToTime } from '../util.js';
import { PATH_STRING, categories, DRONE_DEFAULT_VALUES } from '../contanst.js';
import { handleImageDET, handleImageMOT, handleImageMoving } from '../images.js';


let inputDir = '';
let outDir = '';
let mod = '';
let ppkTimeDifference = 0;
let klvTimeDifference = 0;
let fps = 50;
let limit = '';

let indexOfKLV = 1;
let indexOfPPK = 1;
let indexOfLog = 1;
let klvInputFormatUsed = [];
let isLabeled = false;
let indexLimitLabel = null;
let labelClipDatas = [];
let lastData = [];

let linesKLV = [];
let linesLog = [];
let linesPPK = [];

function createDirectory(x) {
    uCreateDirectory.call(this, x, outDir);
}

function frameIndexToTime(x,y) {
    return uFrameIndexToTime.call(this, x, y, fps);
}

function processDETLine(line) {
    // Split the line by comma ','
    console.log('lines', line)
    const values = line.split(',').map(value => value.trim());

    let xmin = 1 * values[DETInputFormat.minx];
    let ymin = 1 * values[DETInputFormat.miny];
    let width = 1 * values[DETInputFormat.width];
    let height = 1 * values[DETInputFormat.height];
    let xmax = xmin + width;
    let ymax = ymin + height;
    let cx = 1 * values[DETInputFormat.minx] + values[DETInputFormat.width] / 2;
    let cy = 1 * values[DETInputFormat.miny] + values[DETInputFormat.height] / 2;
    const category = categories[values[DETInputFormat.name]];

    // Check if the bounding box is out of the image
    if (xmax > 1280) {
        width = width - (xmax - 1280);
        xmax = 1280;
        cx = xmax - width / 2;
    }
    if (ymax > 720) {
        height = height - (ymax - 720);
        ymax = 720;
        cy = ymax - height / 2;
    }
    if (xmin < 0) {
        width = width - (0 - xmin);
        xmin = 0;
        cx = xmin + width / 2;
    }
    if (ymin < 0) {
        height = height - (0 - ymin);
        ymin = 0;
        cy = ymin + height / 2;
    }

    const newValues = {
        'bbox_cx': cx,
        'bbox_cy': cy,
        'bbox_width': width,
        'bbox_height': height,
        'score': 0,
        'object_category': category,
        'object_subcategory': 1,
        'truncation': 0,
        'occlusion': 0
    }
    // Join the values back with comma ','
    return DETOutputFormat.map(item => newValues[item]);
}

// Function to convert video to frames
function convertToFramesDET(inputVideo, outputFramesDir, fps, fileName) {
    return new Promise((resolve, reject) => {

        exec(`ffmpeg -i ${inputVideo} -vf fps=${fps} -q:v 2 -threads 0 -start_number 0 ${outputFramesDir}/${fileName}_%08d.jpg`, (error) => {
            if (error) {
                console.log('error', error)
                reject(error);
                return;
            }

            resolve();
        });
    });
}

function convertTxtToDet(date, droneName, clipName, fileInput, sortie, lines, index, imagesInputDir, unplanned = true) {
    return new Promise(async (resolve, reject) => {
        try {
            const plannedText = unplanned ? 'Unplanned' : 'Planned';
            const file = fileInput.split('.')[0];
            const sortieOutput = sortie.split('_')[1] || sortie;
            
            if (!isLabeled && lines.length > 0) {
                isLabeled = true;
                indexLimitLabel = limit ? index*1 + limit*fps : indexLimitLabel;
            }
            const outputDir = path.join(date, PATH_STRING.train, PATH_STRING.det_mot, plannedText, droneName, sortieOutput, clipName);
            let imgURL = '';
            if (isLabeled && (!indexLimitLabel || indexLimitLabel >= index)) {
                const timeOfFile = frameIndexToTime(addDifferenceTime(linesKLV[1][0], klvTimeDifference), index * 1);
                let minDifferenceKLV = Infinity;
                let minDifferencePPK = Infinity;
                let minDifferenceLog = Infinity;
                for (let i = indexOfKLV; i < linesKLV.length; i++) {
                    const klvTime = linesKLV[i] && addDifferenceTime(linesKLV[i][0], klvTimeDifference);
                    let difference = linesKLV[i] && timeDifference(klvTime, timeOfFile);
                    if (difference < minDifferenceKLV) {
                        minDifferenceKLV = difference;
                        indexOfKLV = i;
                    }
                }
                for (let i = indexOfPPK; i < linesPPK.length; i++) {
                    const ppkTime = linesPPK[i] && addDifferenceTime(linesPPK[i][0], ppkTimeDifference);
                    let difference = linesPPK[i] && timeDifference(ppkTime, timeOfFile);
                    if (difference < minDifferencePPK) {
                        minDifferencePPK = difference;
                        indexOfPPK = i;
                    }
                }
                for (let i = indexOfLog; i < linesLog.length; i++) {
                    const logTime = linesLog[i] && addDifferenceTime(linesLog[i][0], 0);
                    let difference = linesLog[i] && timeDifference(logTime, timeOfFile);
                    if (difference < minDifferenceLog) {
                        minDifferenceLog = difference;
                        indexOfLog = i;
                    }
                }
                const contentMetadataKLV = metadataOutputFormat.map(item => {
                    if (item === 'precisionTimeStamp') {
                        return linesKLV[indexOfKLV][0] && addDifferenceTime(linesKLV[indexOfKLV][0], klvTimeDifference) || '0';
                    }
                    if (item === 'platformTailNumber' || item === 'platformDesignation') {
                        return droneName;
                    }
                    if (item === 'platformSpeed') {
                        return linesLog[indexOfLog] && linesLog[indexOfLog][linesLog[0].includes('MSL') ? 7 : 5] || '0'
                    }

                    if (item === 'sensorTrueAltitude' && linesKLV[0].includes('MSL')) {
                        return linesKLV[indexOfKLV][9] || 'Null';
                    }

                    return klvInputFormatUsed.indexOf(item) >= 0 ? linesKLV[indexOfKLV][klvInputFormatUsed.indexOf(item)].replace(/\0+$/, '') || 'Null' : 'Null'
                });

                const contentMetadataPPK = metadataOutputFormat.map(item => {
                    if (item === 'precisionTimeStamp') {
                        return linesKLV[indexOfKLV][0] && addDifferenceTime(linesKLV[indexOfKLV][0], klvTimeDifference) || '0';
                    }

                    if (['sensorLatitude', 'sensorLongitude', 'sensorTrueAltitude'].includes(item)) {
                        return PPKInputFormat.indexOf(item) >= 0 ? linesPPK[indexOfPPK][PPKInputFormat.indexOf(item)] || 'Null' : 'Null'
                    }

                    if (item === 'platformTailNumber' || item === 'platformDesignation') {
                        return droneName;
                    }
                    if (item === 'platformSpeed') {
                        return linesLog[indexOfLog] && linesLog[indexOfLog][linesLog[0].includes('MSL') ? 7 : 5] || '0'
                    }
                    return klvInputFormatUsed.indexOf(item) >= 0 ? linesKLV[indexOfKLV][klvInputFormatUsed.indexOf(item)].replace(/\0+$/, '') || 'Null' : 'Null'
                });

                const outputMetaDir = path.join(outputDir, PATH_STRING.meta)
                if (!fs.existsSync(outDir + outputMetaDir)) {
                    createDirectory(outputMetaDir)
                }

                const fileKlv = `${date}_${droneName}_${clipName}_${convertNumberToAnyDigit(index / 5, 5)}.txt`;
                const filePpk = `${date}_${droneName}_${clipName}_${convertNumberToAnyDigit(index / 5, 5)}(PPK).txt`;
                const droneDefaultValue = DRONE_DEFAULT_VALUES[droneName];
                fs.writeFileSync(path.join(outDir, outputMetaDir, fileKlv),
                    (contentMetadataKLV.toString() +
                        `,${droneDefaultValue.INS_PITCH_ALIGNMENT_VISABLE},${droneDefaultValue.PX2CB_X_VISABLE},${droneDefaultValue.PX2CB_Y_VISABLE},${droneDefaultValue.PX2CB_Z_VISABLE}`)
                        .replace(/[\r\n]+/gm, ""));

                fs.writeFileSync(path.join(outDir, outputMetaDir, filePpk),
                    (contentMetadataPPK.toString() +
                        `,${droneDefaultValue.INS_PITCH_ALIGNMENT_VISABLE},${droneDefaultValue.PX2CB_X_VISABLE},${droneDefaultValue.PX2CB_Y_VISABLE},${droneDefaultValue.PX2CB_Z_VISABLE}`)
                        .replace(/[\r\n]+/gm, ""));
                console.log('indexOfKLV', indexOfKLV, 'indexOfPPK', indexOfPPK, 'indexOfLog', indexOfLog)

                // Process each line and join them with '\n' to form the new content
                const newContent = lines.map(line => processDETLine(line)).join('\n');
                const outputDETPath = path.join(outputDir, PATH_STRING.det);
                if (!fs.existsSync(outDir + outputDETPath)) {
                    createDirectory(outputDETPath)
                }
                fs.writeFileSync(path.join(outDir, outputDETPath, `${date}_${droneName}_${clipName}_${convertNumberToAnyDigit(index / 5, 5)}.txt`), newContent);

                const outputDETVisualizedPath = path.join(outputDir, PATH_STRING.det_visualized);
                if (!fs.existsSync(outDir + outputDETVisualizedPath)) {
                    createDirectory(outputDETVisualizedPath)
                }

                imgURL = path.join(imagesInputDir, fileInput);

                const pathOutImg = path.join(outDir, outputDETVisualizedPath, `${date}_${droneName}_${clipName}_${convertNumberToAnyDigit(index / 5, 5)}.jpg`);
                console.log('line', lines);
                await handleImageDET(imgURL, pathOutImg, lines)
                //return MOT content file
                const newContentMOT = lines.map(line => processMOTLine(line, convertNumberToAnyDigit(index, 5)));
                resolve([newContentMOT, imgURL]);
                return;
            }
            resolve(['', ''])
        } catch (error) {
            reject(error);
        }
    });
}

function convertInputToDETMOT(date, drone, sortie, clip, droneDir, unplanned) {
    return new Promise(async (resolve, reject) => {
        try {
            indexOfKLV = 1;
            indexOfPPK = 1;
            indexOfLog = 1;
            const plannedText = unplanned ? 'Unplanned' : 'Planned';
            const motContentFile = [];
            const motImgs = [];
            const clipDir = path.join(droneDir, sortie, clip);
            const sortieOutput = sortie.split('_')[1];
            const outputDir = path.join(date, PATH_STRING.train, PATH_STRING.det_mot, plannedText, drone, sortieOutput, clip);

            if (fs.readdirSync(path.join(clipDir)).length === 0) return;

            const imagesPath = path.join(clipDir, 'Images_Temp');
            if (!fs.existsSync(imagesPath)) {
                uCreateDirectory(path.join(date, 'DETMOT', plannedText, drone, sortie, clip,  'Images_Temp'), inputDir)
            }
            const clipsSplitFiles = fs.readdirSync(path.join(clipDir, 'videos'));

            if (mod === '6' && clipsSplitFiles.length > 0) {
                for (const file of clipsSplitFiles) {
                    const videoUrl = path.join(clipDir, 'videos', file);
                    const fileName = file.split('.')[0];
                    console.log('start convert video ', fileName, ' to frame');
                    await convertToFramesDET(videoUrl, imagesPath, fps, fileName);
                    console.log('convert To Frames done.', fileName);
                }
            }
            const fileXMLURL = path.join(clipDir, 'xml', sortie.split('_').join('') + '_0' + drone + '_' + clip * 1 + '_' + date + '.csv');
            console.log('clipDir', fileXMLURL)

            if (!fs.existsSync(fileXMLURL)) {
                console.log('file not found okkkokok', fileXMLURL)
                resolve();
                return;
            }
            // Read the file content synchronously
            labelClipDatas = fs.readFileSync(fileXMLURL, 'utf8').trim().split('\n');
            const imagesFiles = fs.readdirSync(imagesPath);
            imagesFiles.sort((a, b) => a.localeCompare(b)); // sort by name ascending
            // Process each .txt file
            const outputImagePath = path.join(outputDir, 'Images');
            if (!fs.existsSync(outDir + outputImagePath)) {
                createDirectory(outputImagePath)
            }
            console.log('imagesFiles', imagesPath)
            //get Content metadata klv
            const inputKlvDir = path.join(inputDir, date, 'Metadata', 'KLV', sortie, convertNumberToAnyDigit(drone, 2));
            const klvFileUrl = path.join(inputKlvDir, `${sortie.split('_').join('')}_${convertNumberToAnyDigit(drone, 2)}_${clip * 1}_${date}.csv`);
            const fileKLVContent = fs.readFileSync(klvFileUrl, 'utf8');
            linesKLV = fileKLVContent.trim().split('\n').map(line => line.split(',')).sort((a, b) => a[0] - b[0]);
            klvInputFormatUsed = linesKLV[0].includes('MSL') ? KLVInputFormatMSL : KLVInputFormat;
            isLabeled = false;
            for (let index = 0; index < imagesFiles.length; index = index + 5) {
                const file = imagesFiles[index];
                const lines = labelClipDatas.filter((item) => item.split(',')[0] == index && item !== '');
                indexLimitLabel = labelClipDatas[labelClipDatas.length-1].split(',')[0]*1;
                const imageInputDir = path.join(inputDir, date, 'DETMOT', plannedText, drone, sortie, clip, 'Images_Temp')
                const [contentLine, imgURL] = await convertTxtToDet(date, drone, clip, file, sortie, lines, index, imageInputDir, unplanned);
                if (imgURL) {
                    motImgs.push([imgURL, file, index]);
                    handleImageMoving(imgURL, path.join(outDir, outputImagePath, `${date}_${drone * 1}_${clip}_${convertNumberToAnyDigit(index / 5, 5)}.jpg`));
                }
                if (contentLine) {
                    motContentFile.push(...contentLine);
                }
            }

            const outputMOTVisualizedPath = path.join(outputDir, PATH_STRING.mot_visualized);
            const pathOutMOTVisualized = path.join(outDir, outputMOTVisualizedPath);
            if (!fs.existsSync(outDir + outputMOTVisualizedPath)) {
                createDirectory(outputMOTVisualizedPath)
            }
            const outputFilePath = path.join(date, PATH_STRING.train, PATH_STRING.det_mot, plannedText, drone, sortieOutput, clip, PATH_STRING.mot);

            if (!fs.existsSync(outDir + outputFilePath)) {
                createDirectory(outputFilePath)
            }

            const newContent = motContentFile.join('\n');
            fs.writeFileSync(path.join(outDir, outputFilePath, `${date}_${drone}_${clip}.txt`), newContent);
            console.log('motContentFile', motContentFile)
            await handleImageMOT(motImgs, pathOutMOTVisualized, motContentFile, `${date}_${drone}_${clip}`);

            resolve();
        } catch (error) {
            reject(error);
        }
    });
}

function processMOTLine(line, fileName) {
    // Split the line by comma ','
    console.log('line', line, fileName)
    const values = line.split(',').map(value => value.trim());
    let xmin = 1 * values[DETInputFormat.minx];
    let ymin = 1 * values[DETInputFormat.miny]
    let width = 1 * values[DETInputFormat.width];
    let height = 1 * values[DETInputFormat.height];
    let xmax = xmin + width;
    let ymax = ymin + height;
    let cx = 1 * values[DETInputFormat.minx] + values[DETInputFormat.width] / 2;
    let cy = 1 * values[DETInputFormat.miny] + values[DETInputFormat.height] / 2;
    const category = categories[values[DETInputFormat.name]];

    if (xmax > 1280) {
        width = width - (xmax - 1280);
        xmax = 1280;
        cx = xmax - width / 2;
    }
    if (ymax > 720) {
        height = height - (ymax - 720);
        ymax = 720;
        cy = ymax - height / 2;
    }
    if (xmin < 0) {
        width = width - (0 - xmin);
        xmin = 0;
        cx = xmin + width / 2;
    }
    if (ymin < 0) {
        height = height - (0 - ymin);
        ymin = 0;
        cy = ymin + height / 2;
    }

    const newValues = {
        'frame_index': fileName * 1 / 5,
        'target_id': values[DETInputFormat.name] + values[DETInputFormat.id],
        'bbox_cx': cx,
        'bbox_cy': cy,
        'bbox_width': width,
        'bbox_height': height,
        'score': 0,
        'object_category': category,
        'object_subcategory': 1,
        'truncation': 0,
        'occlusion': 0
    }
    // Join the values back with comma ','
    return MOTOutputFormat.map(item => newValues[item]);
}

function convertMCMOTToPlanned(date, drone, sortie, clip, droneDir) {
    return new Promise(async (resolve, reject) => {
        try{
            const imagesPath = path.join(droneDir, clip, 'images');
            const imagesFiles =  fs.readdirSync(imagesPath).sort((a,b) => a - b);
            const plannedText = 'planned';
            //get Content metadata klv
            const inputKlvDir = path.join(inputDir, date, 'Metadata', 'KLV', 'FTP_'+sortie, convertNumberToAnyDigit(drone, 2));
            const klvFileUrl = path.join(inputKlvDir, `FTP${sortie}_${convertNumberToAnyDigit(drone, 2)}_${clip * 1}_${date}.csv`);
            const fileKLVContent = fs.readFileSync(klvFileUrl, 'utf8');
            linesKLV = fileKLVContent.trim().split('\n').map(line => line.split(',')).sort((a, b) => a[0] - b[0]);
            klvInputFormatUsed = linesKLV[0].includes('MSL') ? KLVInputFormatMSL : KLVInputFormat;
            isLabeled = false;
            const motImgs = [];
            const motContentFile = [];
            const outputDir = path.join(date, PATH_STRING.train, PATH_STRING.det_mot, 'planned', drone, sortie, clip);
            const outputImagePath = path.join(outputDir, 'Images');
            if (!fs.existsSync(outDir + outputImagePath)) {
                createDirectory(outputImagePath)
            }
            for (let index = 0; index < imagesFiles.length; index = index + 5) {
                const file = imagesFiles[index];
                const fileName = file.split('.')[0]
                const lines = fs.existsSync(path.join(droneDir,clip, 'TXT', convertNumberToAnyDigit(fileName, 8)+'.txt')) ? fs.readFileSync(path.join(droneDir,clip, 'TXT', convertNumberToAnyDigit(fileName, 8)+'.txt'), 'utf8').trim().split('\n') : '';
                if (lines.length > 0) {
                    const linesDET = lines.reduce((newLines, item) => {
                        const itemSplit = item.split(',');
                        if(itemSplit[1].split('_')[1] >= 0 && itemSplit[1].split('_')[1] <=9) {
                            newLines.push([itemSplit[0], itemSplit[1].split('_')[0], itemSplit[1].split('_')[1], itemSplit[3], itemSplit[4], itemSplit[5], itemSplit[6]].join(','));
                        }
                        return newLines;
                    }, [])

                    const imageInputDir = path.join(inputDir, date, 'MCMOT', sortie, drone, clip, 'images')
                    console.log('linesDET', linesDET)
                    
                    
                    const [contentLine, imgURL] = await convertTxtToDet(date, drone, clip, file, sortie, linesDET, index,imageInputDir, false);
                    if (imgURL) {
                        motImgs.push([imgURL, file, index]);
                        
                        handleImageMoving(imgURL, path.join(outDir, outputImagePath, `${date}_${drone * 1}_${clip}_${convertNumberToAnyDigit(index / 5, 5)}.jpg`));
                    }
                    if (contentLine) {
                        motContentFile.push(...contentLine);
                    }
                }

            }
            const outputMOTVisualizedPath = path.join(outputDir, PATH_STRING.mot_visualized);
            const pathOutMOTVisualized = path.join(outDir, outputMOTVisualizedPath);
            if (!fs.existsSync(outDir + outputMOTVisualizedPath)) {
                createDirectory(outputMOTVisualizedPath)
            }
            const outputFilePath = path.join(date, PATH_STRING.train, PATH_STRING.det_mot, plannedText, drone, sortie, clip, PATH_STRING.mot);

            if (!fs.existsSync(outDir + outputFilePath)) {
                createDirectory(outputFilePath)
            }

            const newContent = motContentFile.join('\n');
            fs.writeFileSync(path.join(outDir, outputFilePath, `${date}_${drone}_${clip}.txt`), newContent);
            console.log('motContentFile', motContentFile)
            await handleImageMOT(motImgs, pathOutMOTVisualized, motContentFile, `${date}_${drone}_${clip}`);
            resolve();
        } catch(error){
            reject(error)
        }
    })
}

async function convertDETMOT(params) {
    inputDir = params.inputDir;
    outDir = params.outDir;
    ppkTimeDifference = params.ppkTimeDifference;
    klvTimeDifference = params.klvTimeDifference;
    fps = params.fps;
    mod = params.mod;
    limit = params.limit;

    const date = params.date
    const DETMOTFolder = fs.existsSync(`${inputDir}/${date}/DETMOT`) && fs.readdirSync(`${inputDir}/${date}/DETMOT`).filter(item => fs.statSync(path.join(`${inputDir}/${date}/DETMOT`, item)).isDirectory());

    if (DETMOTFolder.length > 0) {
        for (const unplanned of DETMOTFolder) {
            const dirDETMOTUnplanned = `${inputDir}/${date}/DETMOT/${unplanned}`;
            createDirectory(path.join(date, PATH_STRING.train, PATH_STRING.det_mot, unplanned))
            // Read all files in the directory
            const filesDETDrones = fs.readdirSync(dirDETMOTUnplanned).filter(item => fs.statSync(path.join(dirDETMOTUnplanned, item)).isDirectory());

            if (filesDETDrones.length > 0) {
                for (const drone of filesDETDrones) {
                    const droneDir = path.join(dirDETMOTUnplanned, drone);
                    createDirectory(path.join(date, PATH_STRING.train, PATH_STRING.det_mot, unplanned, drone))
                    // Read all files in the Unplanned directory
                    const sortieDETClips = fs.readdirSync(droneDir).filter(item => fs.statSync(path.join(droneDir, item)).isDirectory());
                    if (sortieDETClips.length > 0) {
                        for (const sortie of sortieDETClips) {
                            const sortieDir = path.join(droneDir, sortie);
                            const filesDETClips = fs.readdirSync(sortieDir).filter(item => fs.statSync(path.join(sortieDir, item)).isDirectory());
                            const metaSortieInputDir = path.join(inputDir, date, 'Metadata');

                            const metadataFileName = `${sortie.split('_').join('')}_${convertNumberToAnyDigit(drone, 2)}_${date}`;
                            //get content metadata ppk
                            const ppkFileUrl = path.join(metaSortieInputDir, 'PPK', metadataFileName + '_PPK.csv')
                            const filePPKContent = fs.readFileSync(ppkFileUrl, 'utf8');
                            linesPPK = filePPKContent.trim().split('\n').map(line => line.split(',')).sort((a, b) => a[0] - b[0]);

                            //get content metadata log
                            const logFileUrl = path.join(metaSortieInputDir, 'LOG', metadataFileName + '_FC LOG.csv')
                            const fileLogContent = fs.readFileSync(logFileUrl, 'utf8');
                            linesLog = fileLogContent.trim().split('\n').map(line => line.split(',')).sort((a, b) => a[0] - b[0]);
                            if (filesDETClips.length > 0) {
                                for (const clip of filesDETClips) {
                                    await convertInputToDETMOT(date, drone, sortie, clip, droneDir, unplanned === 'Unplanned')
                                }
                            }
                        }
                    }
                };
            };
        }
    }

    const MCMOTDir = path.join(inputDir, date, 'MCMOT');
    const MCMOTFolder = fs.existsSync(MCMOTDir) && fs.readdirSync(MCMOTDir).filter(item => fs.statSync(path.join(MCMOTDir, item)).isDirectory());
    if(MCMOTFolder.length > 0) {
        for(const sortie of MCMOTFolder) {
            const sortieDir = path.join(MCMOTDir, sortie);
            const sortieFolder = fs.readdirSync(sortieDir).filter(item => fs.statSync(path.join(sortieDir, item)).isDirectory());
            if(sortieFolder.length > 0) {
                for(const drone of sortieFolder) {
                    const droneDir = path.join(sortieDir, drone);
                    const droneFolder = fs.readdirSync(droneDir).filter(item => fs.statSync(path.join(droneDir, item)).isDirectory());
                    const metaSortieInputDir = path.join(inputDir, date, 'Metadata');
                    const metadataFileName = `FTP${sortie}_${convertNumberToAnyDigit(drone, 2)}_${date}`;
                    //get content metadata ppk
                    const ppkFileUrl = path.join(metaSortieInputDir, 'PPK', metadataFileName + '_PPK.csv')
                    const filePPKContent = fs.readFileSync(ppkFileUrl, 'utf8');
                    linesPPK = filePPKContent.trim().split('\n').map(line => line.split(',')).sort((a, b) => a[0] - b[0]);

                    //get content metadata log
                    const logFileUrl = path.join(metaSortieInputDir, 'LOG', metadataFileName + '_FC LOG.csv')
                    const fileLogContent = fs.readFileSync(logFileUrl, 'utf8');
                    linesLog = fileLogContent.trim().split('\n').map(line => line.split(',')).sort((a, b) => a[0] - b[0]);
                    if(droneFolder.length > 0) {
                        for(const clip of droneFolder) {
                            await convertMCMOTToPlanned(date, drone, sortie, clip, droneDir)
                        }
                    }
                }
            }
        }
    }
}

export { convertDETMOT };