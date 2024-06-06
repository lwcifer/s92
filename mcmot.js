import fs from 'fs';
import pLimit from 'p-limit';
const limit = pLimit(100); 
const limit1 = pLimit(1); 
import path from 'path';
import { exec } from 'child_process';

import { getFileName, getFixedColor, mergeArrays, getStartFrame, checkPlanned, valueToText, uCreateDirectory, exportXmlToFile } from './util.js';
import { PATH_STRING } from './contanst.js';
import { handleImageUpload, handleImageBoxMCMOT } from './images.js';
import { mergeXML } from './merge.js';

function createDirectory(x, outDir) {
    uCreateDirectory.call(this, x, outDir);
}

async function MCMOTToFrames(date = '240427', sortie, clip = '0007', drone = '3', fps = 10) {
    const clipDir = path.join(inputDir, date, 'MCMOT', sortie, clip, drone);
    const outputDir = path.join(date, 'MCMOT', sortie, clip, drone, 'Images');

    if(fs.readdirSync(path.join(clipDir)).length === 0 ) return;
    const videoUrl = path.join(clipDir, getFileName(clipDir, '.mp4'));

    await convertToFramesMCMOT(videoUrl, path.join(inputDir, outputDir), fps);
    console.log('convert To MCMOTToFrames done', outputDir);
}

function contentMCMOT(date, sortie, drone, clip, segments, inputDir, fps) {
    let resultTargetMain = '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n';
    let resultTargetBox = '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n';
    let resultTargetBoxPPK = '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n';
    let resultTargetPos = '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n';

    let xxx = []
    const compositeKey = {}
    const compositeError = []
    const txtFile = path.join(inputDir, date, 'MCMOT', sortie, drone, clip, 'range.txt')
    const txtFileContent = fs.readFileSync(txtFile, 'utf8');
    const objs = txtFileContent.trim().split(',');
    let startFrame = objs[0]
    let startIndex = 0;
    if (objs.length > 1) {
        startIndex = parseInt(objs[1]) / 5
    }

    // Read the file content synchronously
    const fileKlvURL =  `${inputDir}/${date}/MCMOT/${sortie}/${drone}/${clip}/META_KLV.csv`;
    const filePpkURL =  `${inputDir}/${date}/MCMOT/${sortie}/${drone}/${clip}/META_PPK.csv`;
    const fileSpeedURL =  `${inputDir}/${date}/MCMOT/${sortie}/${drone}/${clip}/META_LOG.csv`;
    const fileBeacondURL =  `${inputDir}/${date}/MCMOT/${sortie}/META_BEACON.csv`;
    const fileKvlContent = fs.readFileSync(fileKlvURL, 'utf8');
    const filePpkContent = fs.readFileSync(filePpkURL, 'utf8');
    const fileSpeedContent = fs.readFileSync(fileSpeedURL, 'utf8');
    const fileBeaconContent = fs.readFileSync(fileBeacondURL, 'utf8');

    // Split the file content by new line character '\n'
    let lines = fileKvlContent.trim().split('\n');
    let speedData = fileSpeedContent.trim().split('\n');
    let ppk = filePpkContent.trim().split('\n');
    let beacon = fileBeaconContent.trim().split('\n');

    beacon.shift();
    lines.shift();
    speedData.shift();
    ppk.shift();

    const rootTime = new Date(lines[startFrame].split(',')[0]).getTime();
    // lines = lines.slice(objs[0], +objs[1] + 1)
    console.log('segments.length', sortie, drone, clip, segments.length)
    if(segments) xxx = mergeArrays(segments, lines, ppk, speedData, beacon, drone, rootTime, startFrame, startIndex, fps)

    const ck = {}
    for (let i = 0; i < xxx.length; i++) {
        const values = xxx[i].segment.split(",");
        const ppk = xxx[i].ppk.split(",");
        const speed = xxx[i].speed.split(",");
        const klv = xxx[i].klv.split(",");
        const beacon = xxx[i].beacon.split(",");
        const drone = xxx[i].drone;
        const startFrame = xxx[i].startFrame;
        const startIndex = xxx[i].startIndex;
        let nem = valueToText(values[1])
        nem = nem.split('_')[0] + '_' + (+nem.split('_')[1] + 1)
        let box = `${parseInt(values[2]) + 1}${drone}${parseInt(clip)}`
        const frameIndex = (parseInt(values[0]) - startFrame)/5 + startIndex
        const isPlanned = checkPlanned(nem)
        // Check duplicate keys
        const key = `${box}_${drone}_${frameIndex}`
        if(compositeKey[key]) {
            console.error('ERROR compositeKey: ', `clip ${clip}_drone ${drone}_box ${box}_frameIndex ${values[0]}`);
            compositeError.push(`clip ${clip}, drone ${drone}, box ${box}, frameIndex ${values[0]}`);
            continue;
        }
        compositeKey[key] = 1

        //add data to targetMain
        if (!ck[values[1] + values[2]] ) {
            let category = '0'
            switch (valueToText(values[1]).split('_')[0]) {
                case 'bus':
                    category = '1'
                    break;
                case 'truck':
                    category = '2'
                break;
            }
            resultTargetMain += '\t<object>\n';
            resultTargetMain += '\t\t<target_id_global>' + nem + '</target_id_global>\n';
            resultTargetMain += '\t\t<object_category>' + category + '</object_category>\n';
            resultTargetMain += '\t\t<object_subcategory>' + (isPlanned ? '0' : '1') + '</object_subcategory>\n';
            resultTargetMain += '\t\t<box_id>' + box + '</box_id>\n';
            resultTargetMain += '\t</object>\n';
            ck[values[1] + values[2]] = 1
        }

        //add data to targetPos
        resultTargetPos += '\t<object>\n';
        resultTargetPos += '\t\t<target_id_global>' + nem + '</target_id_global>\n';
        resultTargetPos += '\t\t<avs_id>' + valueToText(drone) + '</avs_id>\n';
        resultTargetPos += '\t\t<frame_index>' + frameIndex + '</frame_index>\n';
        resultTargetPos += '\t\t<target_pos_lat>' + (isPlanned ? valueToText(beacon[2]) : 'null') + '</target_pos_lat>\n';
        resultTargetPos += '\t\t<target_pos_long>' + (isPlanned ? valueToText(beacon[3]) : 'null') + '</target_pos_long>\n';
        resultTargetPos += '\t\t<target_pos_alt>' + (isPlanned ? valueToText(beacon[6]) : 'null') + '</target_pos_alt>\n';
        resultTargetPos += '\t</object>\n';

        //add data to targetBox
        let minx = parseInt(values[3])
        let miny = parseInt(values[4])
        let bwidth = parseInt(values[5])
        let bheight = parseInt(values[6])
        let xmax = minx + bwidth;
        let ymax = miny + bheight;
        let cx = minx + bwidth/2
        let cy = miny + bheight/2
        if (minx < 0) {
            cx = (minx + bwidth)/2
            bwidth = cx * 2
            console.log('cxxxxxxxxxx', values[0], cx)
        }
        if (miny < 0) {
            cy = (miny +  bheight)/2
            bheight = cy * 2
            console.log('cyyyyyyyyyy', values[0],  cy)
        }
        if (xmax > 1280) {
            cx = (minx + 1280)/2
            bwidth = 1280 - minx
            console.log('cxxxxxxxxxx', values[0], cx)
        }
        if (ymax > 720) {
            cy = (miny + 720)/2
            bheight = 720 - miny
            console.log('cyyyyyyyyyy', values[0], cy)
        }

        const isMSL = klv.length === 31 
        resultTargetBox += '\t<object>\n';
        resultTargetBox += '\t\t<box_id>' + box + '</box_id>\n';
        resultTargetBox += '\t\t<avs_id>' + valueToText(drone) + '</avs_id>\n';
        resultTargetBox += '\t\t<frame_index>' + frameIndex + '</frame_index>\n';
        resultTargetBox += '\t\t<bbox_cx>' + cx + '</bbox_cx>\n';
        resultTargetBox += '\t\t<bbox_cy>' + cy + '</bbox_cy>\n';
        resultTargetBox += '\t\t<bbox_width>' + bwidth + '</bbox_width>\n';
        resultTargetBox += '\t\t<bbox_height>' + bheight + '</bbox_height>\n';
        resultTargetBox += '\t\t<precision_time_stamp>' + valueToText(klv[0]) + '</precision_time_stamp>\n';
        resultTargetBox += '\t\t<platform_tail_number>' + drone + '</platform_tail_number>\n';
        resultTargetBox += '\t\t<platform_heading_angle>' + valueToText(klv[1]) + '</platform_heading_angle>\n';
        resultTargetBox += '\t\t<platform_pitch_angle>' + valueToText(klv[2]) + '</platform_pitch_angle>\n';
        resultTargetBox += '\t\t<platform_roll_angle>' + valueToText(klv[3]) + '</platform_roll_angle>\n';
        resultTargetBox += '\t\t<platform_designation>' + drone + '</platform_designation>\n';
        resultTargetBox += '\t\t<image_source_sensor>' + valueToText(klv[4]) + '</image_source_sensor>\n';
        resultTargetBox += '\t\t<sensor_latitude>' + valueToText(klv[5]) + '</sensor_latitude>\n';
        resultTargetBox += '\t\t<sensor_longitude>' + valueToText(klv[6]) + '</sensor_longitude>\n';
        resultTargetBox += '\t\t<sensor_true_altitude>' + valueToText(klv[isMSL ? 9 : 7]) + '</sensor_true_altitude>\n';
        resultTargetBox += '\t\t<sensor_horizontal_field_of_view>' + valueToText(klv[isMSL ? 10 : 8]) + '</sensor_horizontal_field_of_view>\n';
        resultTargetBox += '\t\t<sensor_vertical_field_of_view>' + valueToText(klv[isMSL ? 11 : 9]) + '</sensor_vertical_field_of_view>\n';
        resultTargetBox += '\t\t<sensor_relative_azimuth_angle>' + valueToText(klv[isMSL ? 12 : 10]) + '</sensor_relative_azimuth_angle>\n';
        resultTargetBox += '\t\t<sensor_relative_elevation_angle>' + valueToText(klv[isMSL ? 13 : 11]) + '</sensor_relative_elevation_angle>\n';
        resultTargetBox += '\t\t<sensor_relative_roll_angle>' + valueToText(klv[isMSL ? 14 : 12]) + '</sensor_relative_roll_angle>\n';
        resultTargetBox += '\t\t<slant_range>' + valueToText(klv[isMSL ? 15 : 13]) + '</slant_range>\n';
        resultTargetBox += '\t\t<frame_center_latitude>' + valueToText(klv[isMSL ? 16 : 14]) + '</frame_center_latitude>\n';
        resultTargetBox += '\t\t<frame_center_longitude>' + valueToText(klv[isMSL ? 17 : 15]) + '</frame_center_longitude>\n';
        resultTargetBox += '\t\t<frame_center_elevation>' + valueToText(klv[isMSL ? 18 : 16]) + '</frame_center_elevation>\n';
        resultTargetBox += '\t\t<offset_corner_latitude_point_1>' + valueToText(klv[isMSL ? 19 : 17]) + '</offset_corner_latitude_point_1>\n';
        resultTargetBox += '\t\t<offset_corner_longitude_point_1>' + valueToText(klv[isMSL ? 20 : 18]) + '</offset_corner_longitude_point_1>\n';
        resultTargetBox += '\t\t<offset_corner_latitude_point_2>' + valueToText(klv[isMSL ? 21 : 19]) + '</offset_corner_latitude_point_2>\n';
        resultTargetBox += '\t\t<offset_corner_longitude_point_2>' + valueToText(klv[isMSL ? 22 : 20]) + '</offset_corner_longitude_point_2>\n';
        resultTargetBox += '\t\t<offset_corner_latitude_point_3>' + valueToText(klv[isMSL ? 23 : 21]) + '</offset_corner_latitude_point_3>\n';
        resultTargetBox += '\t\t<offset_corner_longitude_point_3>' + valueToText(klv[isMSL ? 24 : 22]) + '</offset_corner_longitude_point_3>\n';
        resultTargetBox += '\t\t<offset_corner_latitude_point_4>' + valueToText(klv[isMSL ? 25 : 23]) + '</offset_corner_latitude_point_4>\n';
        resultTargetBox += '\t\t<offset_corner_longitude_point_4>' + valueToText(klv[isMSL ? 26 : 24]) + '</offset_corner_longitude_point_4>\n';
        resultTargetBox += '\t\t<plaftform_speed>' + valueToText(speed[isMSL ? 7 : 5]) + '</plaftform_speed>\n'; 
        resultTargetBox += '\t\t<ins_pitch_alignment_day>' + valueToText(klv[isMSL ? 27 : 25]) + '</ins_pitch_alignment_day>\n';
        resultTargetBox += '\t\t<px2cb_x_day>' + valueToText(klv[isMSL ? 28 : 26]) + '</px2cb_x_day>\n';
        resultTargetBox += '\t\t<px2cb_y_day>' + valueToText(klv[isMSL ? 29 : 27]) + '</px2cb_y_day>\n';
        resultTargetBox += '\t\t<px2cb_z_day>' + valueToText(klv[isMSL ? 30 : 28]) + '</px2cb_z_day>\n';
        resultTargetBox += '\t</object>\n';


        resultTargetBoxPPK += '\t<object>\n';
        resultTargetBoxPPK += '\t\t<box_id>' + box + '</box_id>\n';
        resultTargetBoxPPK += '\t\t<avs_id>' + valueToText(drone) + '</avs_id>\n';
        resultTargetBoxPPK += '\t\t<frame_index>' + frameIndex + '</frame_index>\n';
        resultTargetBoxPPK += '\t\t<bbox_cx>' + cx + '</bbox_cx>\n';
        resultTargetBoxPPK += '\t\t<bbox_cy>' + cy + '</bbox_cy>\n';
        resultTargetBoxPPK += '\t\t<bbox_width>' + bwidth + '</bbox_width>\n';
        resultTargetBoxPPK += '\t\t<bbox_height>' + bheight + '</bbox_height>\n';
        resultTargetBoxPPK += '\t\t<precision_time_stamp>' + valueToText(klv[0]) + '</precision_time_stamp>\n';
        resultTargetBoxPPK += '\t\t<platform_tail_number>' + drone + '</platform_tail_number>\n';
        resultTargetBoxPPK += '\t\t<platform_heading_angle>' + valueToText(klv[1]) + '</platform_heading_angle>\n';
        resultTargetBoxPPK += '\t\t<platform_pitch_angle>' + valueToText(klv[2]) + '</platform_pitch_angle>\n';
        resultTargetBoxPPK += '\t\t<platform_roll_angle>' + valueToText(klv[3]) + '</platform_roll_angle>\n';
        resultTargetBoxPPK += '\t\t<platform_designation>' + drone + '</platform_designation>\n';
        resultTargetBoxPPK += '\t\t<image_source_sensor>' + valueToText(klv[4]) + '</image_source_sensor>\n';
        resultTargetBoxPPK += '\t\t<sensor_latitude>' + valueToText(ppk[1]) + '</sensor_latitude>\n';
        resultTargetBoxPPK += '\t\t<sensor_longitude>' + valueToText(ppk[2]) + '</sensor_longitude>\n';
        resultTargetBoxPPK += '\t\t<sensor_true_altitude>' + valueToText(ppk[3]) + '</sensor_true_altitude>\n';
        resultTargetBoxPPK += '\t\t<sensor_horizontal_field_of_view>' + valueToText(klv[isMSL ? 10 : 8]) + '</sensor_horizontal_field_of_view>\n';
        resultTargetBoxPPK += '\t\t<sensor_vertical_field_of_view>' + valueToText(klv[isMSL ? 11 : 9]) + '</sensor_vertical_field_of_view>\n';
        resultTargetBoxPPK += '\t\t<sensor_relative_azimuth_angle>' + valueToText(klv[isMSL ? 12 : 10]) + '</sensor_relative_azimuth_angle>\n';
        resultTargetBoxPPK += '\t\t<sensor_relative_elevation_angle>' + valueToText(klv[isMSL ? 13 : 11]) + '</sensor_relative_elevation_angle>\n';
        resultTargetBoxPPK += '\t\t<sensor_relative_roll_angle>' + valueToText(klv[isMSL ? 14 : 12]) + '</sensor_relative_roll_angle>\n';
        resultTargetBoxPPK += '\t\t<slant_range>' + valueToText(klv[isMSL ? 15 : 13]) + '</slant_range>\n';
        resultTargetBoxPPK += '\t\t<frame_center_latitude>' + valueToText(klv[isMSL ? 16 : 14]) + '</frame_center_latitude>\n';
        resultTargetBoxPPK += '\t\t<frame_center_longitude>' + valueToText(klv[isMSL ? 17 : 15]) + '</frame_center_longitude>\n';
        resultTargetBoxPPK += '\t\t<frame_center_elevation>' + valueToText(klv[isMSL ? 18 : 16]) + '</frame_center_elevation>\n';
        resultTargetBoxPPK += '\t\t<offset_corner_latitude_point_1>' + valueToText(klv[isMSL ? 19 : 17]) + '</offset_corner_latitude_point_1>\n';
        resultTargetBoxPPK += '\t\t<offset_corner_longitude_point_1>' + valueToText(klv[isMSL ? 20 : 18]) + '</offset_corner_longitude_point_1>\n';
        resultTargetBoxPPK += '\t\t<offset_corner_latitude_point_2>' + valueToText(klv[isMSL ? 21 : 19]) + '</offset_corner_latitude_point_2>\n';
        resultTargetBoxPPK += '\t\t<offset_corner_longitude_point_2>' + valueToText(klv[isMSL ? 22 : 20]) + '</offset_corner_longitude_point_2>\n';
        resultTargetBoxPPK += '\t\t<offset_corner_latitude_point_3>' + valueToText(klv[isMSL ? 23 : 21]) + '</offset_corner_latitude_point_3>\n';
        resultTargetBoxPPK += '\t\t<offset_corner_longitude_point_3>' + valueToText(klv[isMSL ? 24 : 22]) + '</offset_corner_longitude_point_3>\n';
        resultTargetBoxPPK += '\t\t<offset_corner_latitude_point_4>' + valueToText(klv[isMSL ? 25 : 23]) + '</offset_corner_latitude_point_4>\n';
        resultTargetBoxPPK += '\t\t<offset_corner_longitude_point_4>' + valueToText(klv[isMSL ? 26 : 24]) + '</offset_corner_longitude_point_4>\n';
        resultTargetBoxPPK += '\t\t<plaftform_speed>' + valueToText(speed[isMSL ? 7 : 5]) + '</plaftform_speed>\n'; 
        resultTargetBoxPPK += '\t\t<ins_pitch_alignment_day>' + valueToText(klv[isMSL ? 27 : 25]) + '</ins_pitch_alignment_day>\n';
        resultTargetBoxPPK += '\t\t<px2cb_x_day>' + valueToText(klv[isMSL ? 28 : 26]) + '</px2cb_x_day>\n';
        resultTargetBoxPPK += '\t\t<px2cb_y_day>' + valueToText(klv[isMSL ? 29 : 27]) + '</px2cb_y_day>\n';
        resultTargetBoxPPK += '\t\t<px2cb_z_day>' + valueToText(klv[isMSL ? 30 : 28]) + '</px2cb_z_day>\n';
        resultTargetBoxPPK += '\t</object>\n';
    }

    resultTargetBox += '</root>';
    resultTargetBoxPPK += '</root>';
    resultTargetMain += '</root>';
    resultTargetPos += '</root>';
    console.log('compositeError: ', compositeError)
    return [resultTargetBox, resultTargetMain, resultTargetPos, resultTargetBoxPPK];
}

let count = 0
let countImg = 0
let countXml = 0
async function convertTxtToMCMOT(inputDir, outDir, fps, digitFileName, date, sortie, mode) {
    let fileData = {};
    
    let droneFolderPath = path.join(inputDir, date, 'MCMOT', sortie);
    let droneFolderFiles = fs.readdirSync(droneFolderPath);
    // Lọc ra chỉ các thư mục
    droneFolderFiles = droneFolderFiles.filter(object => {
        return fs.statSync(path.join(droneFolderPath, object)).isDirectory();
    });
    droneFolderFiles.forEach(drone => {
        if (!fileData[drone]) fileData[drone] = {}
        let clipsPath = path.join(inputDir, date, 'MCMOT', sortie, drone);
        let clipsFiles = fs.readdirSync(clipsPath);
        clipsFiles = clipsFiles.filter(object => {
            return fs.statSync(path.join(clipsPath, object)).isDirectory();
        });
        if(clipsFiles.length > 0) {
            clipsFiles.forEach(async clip => {
                count++
                fileData[drone][clip] = []
                const rangeFile = path.join(inputDir, date, 'MCMOT', sortie, drone, clip, 'range.txt')
                const rangeFileContent = fs.readFileSync(rangeFile, 'utf8');
                const range = rangeFileContent.trim().split(',');
                let startIndex = 0;
                if (mode === '4') {

                    MCMOTToFrames(date, sortie, clip, drone, 50)

                } else {
                    const droneOutDir = path.join(date, PATH_STRING.train,'MCMOT', sortie, '0001', drone)
                    if (!fs.existsSync(outDir+droneOutDir)) {
                        createDirectory(droneOutDir,outDir)
                    }

                    const filesInDrones = fs.readdirSync(path.join(inputDir, date, 'MCMOT', sortie, drone, clip));
                    if(filesInDrones.length === 0 ) {
                        return;
                    }
                    
                    const droneImgOutDir = path.join(droneOutDir, PATH_STRING.mcmot_visualized);
                    if (!fs.existsSync(outDir+droneImgOutDir)) {
                        createDirectory(droneImgOutDir,outDir)
                    }
                    let droneImgFiles = fs.readdirSync(path.join(inputDir, date, 'MCMOT', sortie, drone, clip, 'Images'));
                    droneImgFiles = droneImgFiles.sort((a, b) => a.localeCompare(b));
                    if(droneImgFiles.length > 0) {
                        const processFile = async (img, index) => {
                            const imgURL = path.join(inputDir, date, 'MCMOT', sortie, drone, clip, 'Images', img);
                            let fileName = img.split('.')[0];
                            
                            if (range.length > 1) {
                                startIndex = parseInt(range[1]) / 5
                            }
                            const startFrame = parseInt(range[0]) - getStartFrame(clip, drone)
                            fileName = (parseInt(fileName) - 1).toString().padStart(5, '0');
                            const imgName = ((parseInt(fileName) - startFrame)/5 + startIndex).toString().padStart(5, '0');
                            const pathOutImg = path.join(outDir, droneImgOutDir, `${date}_${'0001'}_${drone}_${imgName.slice(-digitFileName)}.jpg`);
                            const txtFileName = fileName.padStart(8, '0');
                            const txtFile = `${inputDir}/${date}/MCMOT/${sortie}/${drone}/${clip}/TXT/${txtFileName}.txt`;
                            let objs = [];
                            if (fs.existsSync(txtFile)) {
                                const txtFileContent = fs.readFileSync(txtFile, 'utf8');
                                objs = txtFileContent.trim().split('\n');
                                fileData[drone][clip] = [...fileData[drone][clip], ...objs];
                            }

                            if (mode === '5') {
                                await handleImageBoxMCMOT(imgURL, pathOutImg, objs, droneImgFiles.length);

                                let pathOutImgImg = path.join(outDir, droneOutDir, 'Images');
                                if (!fs.existsSync(pathOutImgImg)) {
                                    const pa = path.join(droneOutDir, 'Images')
                                    createDirectory(pa,outDir)
                                }
                                pathOutImgImg = path.join(pathOutImgImg,`${date}_${'0001'}_${drone}_${imgName.slice(-digitFileName)}.jpg`);

                                handleImageUpload(imgURL, pathOutImgImg);
                            }
                        };
                        
                        const processFiles = async () => {
                            console.log("Đang xử lý clip", clip, 'drone', drone);
                            const promises = [];
                            for (let i = 0; i < droneImgFiles.length; i += 5) {
                                const img = droneImgFiles[i];
                                if (mode == '2') {
                                    processFile(img, i);
                                    // promises.push(limit1(() => processFile(img, i)));
                                } else {
                                    promises.push(limit(() => processFile(img, i)));
                                }
                            }
                            await Promise.all(promises);
                            console.log("Hoàn thành xử lý clip", clip, 'drone', drone, countImg, count);
                            if (mode === '5') {
                                countImg++
                                if (countImg == count) {
                                    console.log("Hoàn thành xử lý tất cả", countImg, count);
                                    count = 0
                                    countImg = 0
                                }
                            }
                        };
                        
                        processFiles().catch(err => {
                            console.error("Đã xảy ra lỗi:", err);
                        });

                        if (mode !== '5') {
                            const processXML = async () => {
                                const [contentTargetBox, contentTargetMain, contentTargetPos, contentTargetBoxPPK] = contentMCMOT(date, sortie, drone ,clip, fileData[drone][clip], inputDir, fps)
                                await Promise.all([
                                    exportXmlToFile(contentTargetBox, `${outDir}/${date}/${PATH_STRING.train}/${PATH_STRING.mcmot}/${sortie}/${'0001/Pre'}/${PATH_STRING.mcmot_target_box}/${date}_${clip}_${drone}.xml`),
                                    exportXmlToFile(contentTargetBoxPPK,  `${outDir}/${date}/${PATH_STRING.train}/${PATH_STRING.mcmot}/${sortie}/${'0001/Pre'}/${PATH_STRING.mcmot_target_box_ppk}/${date}_${clip}(PPK)_${drone}.xml`),
                                    exportXmlToFile(contentTargetMain,  `${outDir}/${date}/${PATH_STRING.train}/${PATH_STRING.mcmot}/${sortie}/${'0001/Pre'}/${PATH_STRING.mcmot_target_main}/${date}_${clip}_${drone}.xml`),
                                    exportXmlToFile(contentTargetPos,  `${outDir}/${date}/${PATH_STRING.train}/${PATH_STRING.mcmot}/${sortie}/${'0001/Pre'}/${PATH_STRING.mcmot_target_pos}/${date}_${clip}_${drone}.xml`)
                                ])
                            };
                            processXML().then(e => {
                                countXml++
                                console.log("Xong rồi", countXml, count);
                                if (countXml == count) {
                                    console.log("Xong thật rồi", countXml, count);
                                    mergeXML(`${outDir}/${date}/${PATH_STRING.train}/${PATH_STRING.mcmot}/${sortie}/${'0001/'}`, `${date}_${'0001'}`)
                                    count = 0
                                    countXml = 0
                                }
                            }).catch(err => {
                                console.error("Đã xảy ra lỗi:", err);
                            });
                            
                        }
                    }
                }
            })
        }
        
    })
}

function convertToFramesMCMOT(inputVideo, outputFramesDir, fps) {
    // const ffmpegCommand = `ffmpeg -i ${inputVideo} -vf -qscale:v 2 -threads 0 "select='between(n\\,${startFrame}\\,${endFrame})',fps=${fps}" ${outputFramesDir}/%05d.jpg`;
    return new Promise((resolve, reject) => {
        exec(`ffmpeg -i ${inputVideo} -vf fps=${fps} -qscale:v 2 -threads 0 ${outputFramesDir}/%05d.jpg`, (error, stdout, stderr) => {
            if (error) {
                console.log('error', error)
                reject(error);
                return;
            }
            
            resolve();
        });
    });
}

async function convertMCMOT(inputDir, outDir, fps, digitFileName, date, sortie, mode) {
    try {
        await convertTxtToMCMOT(inputDir, outDir, fps, digitFileName, date, sortie, mode)
    } catch (error) {
        console.error(error)
    }
}

// Run the main function
export { convertMCMOT }