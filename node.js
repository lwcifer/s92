import fs from 'fs';
import pLimit from 'p-limit';
const limit = pLimit(100); 
const limit1 = pLimit(1); 
// const { createCanvas, loadImage } = require('canvas');
import { createCanvas, loadImage } from 'canvas';
import path from 'path';
import { exec } from 'child_process';
import { DOMParser } from "xmldom";

import { DETInputFormat, KLVInputFormat, PPKInputFormat } from './input_format_constants.js';
import { DETOutputFormat, MOTOutputFormat, metadataOutputFormat } from './output_format_constants.js';
import { getFileName, getFixedColor, mergeArrays, addDifferenceTime, getStartFrame, checkPlanned, addDifferenceTimeGetTime, valueToText, uCreateDirectory, createBaseForder, uFrameIndexToTime, timeDifference, exportXmlToFile, sortPromax, extraDataMCMOT, convertNumberToAnyDigit} from './util.js';
import { PATH_STRING, categories, DRONE_DEFAULT_VALUES } from './contanst.js';
import { drawText, drawTextMCMOT, drawBoundingBox, handleImageDET, handleImageMOT, handleImageMoving } from './images.js';
import { mergeXML } from './merge.js';


// Define input and output filenames
let inputDir = 'C:/Users/PC/Downloads/input';
let outDir = 'C:/Users/PC/Documents/s92';
let mod = 'all';
let fps = 50;
let ppkTimeDifference = 0;
let klvTimeDifference = 0;
const digitFileName = 5;
const fpsOutput = 10;
let linesKLV = [];
let linesLog = [];
let linesPPK = [];

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
   
    let xmin =  1*values[DETInputFormat.minx];
    let ymin = 1*values[DETInputFormat.miny]
    let width = 1*values[DETInputFormat.width];
    let height = 1*values[DETInputFormat.height];
    let xmax = xmin + width;
    let ymax = ymin + height;
    let cx = 1*values[DETInputFormat.minx] + values[DETInputFormat.width]/2;
    let cy = 1*values[DETInputFormat.miny] + values[DETInputFormat.height]/2;
    const category = categories[values[DETInputFormat.name]];

    // Check if the bounding box is out of the image
    if(xmax > 1280) {
      width = width - (xmax - 1280);
      xmax = 1280;
      cx = xmax - width/2;
    }
    if(ymax > 720) {
      height = height - (ymax - 720);
      ymax = 720;
      cy = ymax - height/2;
    }
    if(xmin < 0) {
      width = width - (0 - xmin);
      xmin = 0;
      cx = xmin + width/2;
    }
    if(ymin < 0) {
      height = height - (0 - ymin);
      ymin = 0;
      cy = ymin + height/2;
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

let indexOfKLV = 1;
let indexOfPPK = 1;
let indexOfLog = 1;
function convertTxtToDet (date, droneName, clipName, fileInput, sortie, index, unplanned = true) {
  console.log('sortie', sortie)
  return new Promise(async (resolve, reject) => {
    try {

      const plannedText = unplanned ? 'Unplanned' : 'Planned';
      const inputClipDir = path.join(inputDir, date, 'DETMOT', plannedText, droneName, sortie+'', clipName);
      const file = fileInput.split('.')[0];
      const sortieOutput = sortie.split('_')[1];
      const lines = labelClipDatas.filter((item) => item.includes(file));




      const timeOfFile = frameIndexToTime(addDifferenceTime(linesKLV[1][0], klvTimeDifference), index*1);
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
          if(item === 'precisionTimeStamp') {
            return linesKLV[indexOfKLV][0] && addDifferenceTime(linesKLV[indexOfKLV][0], klvTimeDifference) || '0';
          }
          if(item === 'platformTailNumber' || item === 'platformDesignation') {
            return droneName;
          }
          if(item === 'platformSpeed') {
            return linesLog[indexOfLog] && linesLog[indexOfLog][5] || '0' 
          }
          return KLVInputFormat.indexOf(item) >= 0 ? linesKLV[indexOfKLV][KLVInputFormat.indexOf(item)].replace(/\0+$/, '') || 'Null' : 'Null'
      });

      const contentMetadataPPK = metadataOutputFormat.map(item => {
          if(item === 'precisionTimeStamp') {
            return linesKLV[indexOfKLV][0] && addDifferenceTime(linesKLV[indexOfKLV][0], klvTimeDifference) || '0';
          }
          if(['sensorLatitude','sensorLongitude','sensorTrueAltitude'].includes(item)) {
              return PPKInputFormat.indexOf(item) >= 0 ? linesPPK[indexOfPPK][PPKInputFormat.indexOf(item)] || 'Null' : 'Null'
          }
          if(item === 'platformTailNumber' || item === 'platformDesignation') {
            return droneName;
          }
          if(item === 'platformSpeed') {
            return linesLog[indexOfLog] && linesLog[indexOfLog][5] || '0' 
          }
          return KLVInputFormat.indexOf(item) >= 0 ? linesKLV[indexOfKLV][KLVInputFormat.indexOf(item)].replace(/\0+$/, '') || 'Null' : 'Null'
      });

      const outputDir = path.join(date, PATH_STRING.train, PATH_STRING.det_mot, plannedText, droneName, sortieOutput, clipName);
      const outputMetaDir = path.join(outputDir, PATH_STRING.meta)
      if (!fs.existsSync(outDir+ outputMetaDir)) {
          createDirectory(outputMetaDir)
      }

      const fileKlv = `${date}_${droneName}_${clipName}_${convertNumberToAnyDigit(index+1, 5)}.txt`;
      const filePpk = `${date}_${droneName}_${clipName}_${convertNumberToAnyDigit(index+1, 5)}(PPK).txt`;
      const droneDefaultValue = DRONE_DEFAULT_VALUES[droneName];
      fs.writeFileSync(path.join(outDir, outputMetaDir, fileKlv), 
        (contentMetadataKLV.toString() + 
        `,${droneDefaultValue.INS_PITCH_ALIGNMENT_VISABLE},${droneDefaultValue.PX2CB_X_VISABLE},${droneDefaultValue.PX2CB_Y_VISABLE},${droneDefaultValue.PX2CB_Z_VISABLE}`)
        .replace( /[\r\n]+/gm, "" ));

      fs.writeFileSync(path.join(outDir, outputMetaDir, filePpk),
      (contentMetadataPPK.toString() + 
      `,${droneDefaultValue.INS_PITCH_ALIGNMENT_VISABLE},${droneDefaultValue.PX2CB_X_VISABLE},${droneDefaultValue.PX2CB_Y_VISABLE},${droneDefaultValue.PX2CB_Z_VISABLE}`)
      .replace( /[\r\n]+/gm, "" ));
      console.log('indexOfKLV', indexOfKLV, 'indexOfPPK', indexOfPPK, 'indexOfLog', indexOfLog)

      // Process each line and join them with '\n' to form the new content
      const newContent = lines.map(line => processDETLine(line)).join('\n');
      const outputDETPath = path.join(outputDir, PATH_STRING.det);
      if (!fs.existsSync(outDir+outputDETPath)) {
          createDirectory(outputDETPath)
      }

      const outputDETVisualizedPath = path.join(outputDir, PATH_STRING.det_visualized);
      if (!fs.existsSync(outDir + outputDETVisualizedPath)) {
          createDirectory(outputDETVisualizedPath)
      }
      const imgURL = path.join(path.join(outDir, outputDir, 'Images_Temp'), fileInput);

      const pathOutImg = path.join(outDir, outputDETVisualizedPath, `${date}_${droneName}_${clipName}_${convertNumberToAnyDigit(index+1, 5)}.jpg`);

      await handleImageDET(imgURL, pathOutImg, lines)
      fs.writeFileSync(path.join(outDir, outputDETPath, `${date}_${droneName}_${clipName}_${convertNumberToAnyDigit(index+1, 5)}.txt`), newContent);

      //return MOT content file
      const newContentMOT = lines.map(line => processMOTLine(line, convertNumberToAnyDigit(index+1, 5))).join('\n');
      resolve([newContentMOT, imgURL]);
    } catch (error) {
      reject(error);
    }
  });
}

let labelClipDatas = [];
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

      if(fs.readdirSync(path.join(clipDir)).length === 0 ) return;

      //const videoUrl = path.join(clipDir, 'video.mp4');
      const imagesPath = path.join(outDir, outputDir, 'Images_Temp');
      if (!fs.existsSync(imagesPath)) {
        createDirectory(path.join(outputDir, 'Images_Temp'))
      }
      const clipsSplitFiles = fs.readdirSync(path.join(clipDir, 'videos'));

      if(clipsSplitFiles.length > 0) {
        for(const file of clipsSplitFiles) {
          const videoUrl = path.join(clipDir, 'videos', file);
          const fileName = file.split('.')[0];
          await convertToFramesDET(videoUrl, imagesPath, 50, fileName);
          console.log('convert To Frames done.');
        }
      }

      //const detFolderFiles = fs.readdirSync(path.join(clipDir, 'TXT'))
      // Filter out only .txt files
      //const detFiles = detFolderFiles.filter(file => path.extname(file).toLowerCase() === '.txt').sort((a, b) => a - b);
      const fileXMLURL = path.join(clipDir, 'xml', sortie.split('_').join('')+'_0'+drone+'_'+clip*1+'_'+date+'.xml');
      console.log('clipDir', fileXMLURL)

      if (!fs.existsSync(fileXMLURL)) {
        console.log('file not found okkkokok', fileXMLURL)
        resolve();
        return;
      }
      // Read the file content synchronously
      labelClipDatas = await convertXML2JSON(fileXMLURL);
      const imagesFiles = fs.readdirSync(imagesPath);
      imagesFiles.sort((a, b) => a.localeCompare(b)); // sort by name ascending
      // Process each .txt file
      const outputImagePath = path.join(outputDir, 'Images');
      if (!fs.existsSync(outDir + outputImagePath)) {
        createDirectory(outputImagePath)
      }

      //get Content metadata klv
      const inputKlvDir = path.join(inputDir, date,'Metadata', 'KLV', sortie, convertNumberToAnyDigit(drone, 2));
      const klvFileUrl = path.join(inputKlvDir, `${sortie.split('_').join('')}_${convertNumberToAnyDigit(drone, 2)}_${clip*1}_${date}.csv`);
      const fileKLVContent = fs.readFileSync(klvFileUrl, 'utf8');
      linesKLV = fileKLVContent.trim().split('\n').map(line => line.split(','));

      for (let index = 0; index < imagesFiles.length; index = index + 5) {
        const file = imagesFiles[index];
       
        const [contentLine, imgURL] = await convertTxtToDet(date, drone, clip, file, sortie, index, unplanned );
        if(imgURL) {
          motImgs.push([imgURL, file, index+1]);
          handleImageMoving(imgURL, path.join(outDir, outputImagePath, `${date}_${drone*1}_${clip}_${convertNumberToAnyDigit(index+1, 5)}.jpg`));
        }
        if(contentLine) {
          motContentFile.push(contentLine);
        }
      }

      const outputMOTVisualizedPath = path.join(outputDir, PATH_STRING.mot_visualized);
      const pathOutMOTVisualized = path.join(outDir, outputMOTVisualizedPath);
      if (!fs.existsSync(outDir + outputMOTVisualizedPath)) {
        createDirectory(outputMOTVisualizedPath)
      }
      const outputFilePath = path.join(date, PATH_STRING.train, PATH_STRING.det_mot, plannedText, drone, sortieOutput, clip, PATH_STRING.mot);

      if (!fs.existsSync(outDir+outputFilePath)) {
          createDirectory(outputFilePath)
      }

      const newContent = motContentFile.join('\n');
      fs.writeFileSync(path.join(outDir, outputFilePath, `${date}_${drone}_${clip}.txt`), newContent);

      await handleImageMOT(motImgs, pathOutMOTVisualized, motContentFile, `${date}_${drone}_${clip}`);
      
     // Delete folder Images_Temp
      fs.rmSync(imagesPath, { recursive: true});
      console.log('All MOT files were saved.');
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

function processMOTLine(line, fileName) {
    // Split the line by comma ','
    const values = line.split(',').map(value => value.trim());
    let xmin =  1*values[DETInputFormat.minx];
    let ymin = 1*values[DETInputFormat.miny]
    let width = 1*values[DETInputFormat.width];
    let height = 1*values[DETInputFormat.height];
    let xmax = xmin + width;
    let ymax = ymin + height;
    let cx = 1*values[DETInputFormat.minx] + values[DETInputFormat.width]/2;
    let cy = 1*values[DETInputFormat.miny] + values[DETInputFormat.height]/2;
    const category = categories[values[DETInputFormat.name]];

    if(xmax > 1280) {
      width = width - (xmax - 1280);
      xmax = 1280;
      cx = xmax - width/2;
    }
    if(ymax > 720) {
      height = height - (ymax - 720);
      ymax = 720;
      cy = ymax - height/2;
    }
    if(xmin < 0) {
      width = width - (0 - xmin);
      xmin = 0;
      cx = xmin + width/2;
    }
    if(ymin < 0) {
      height = height - (0 - ymin);
      ymin = 0;
      cy = ymin + height/2;
    }

    const newValues = {
        'frame_index': fileName*1,
        'target_id': values[DETInputFormat.name]+ values[DETInputFormat.id],
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

function convertXML2JSON(xmlfile) {
  return new Promise((resolve, reject) => {
      try {
          const xml  = fs.readFileSync(xmlfile, 'utf8')
          // Get the results
          const results = parseAnnotations(xml);
          console.log('results', results)
          resolve(results);
      } catch (error) {
          reject(error);
      }
  })
}

// Parse the XML data and convert it to the desired format
function parseAnnotations(xmlData) {
  // Parse the XML data
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlData, 'text/xml');
  
  // Initialize an array to store the results
  const results = [];
  
  // Iterate over each annotation
  const annotations = xmlDoc.getElementsByTagName('annotation');
  for (let i = 0; i < annotations.length; i++) {
      const annotation = annotations[i];
      const fileName = annotation.getElementsByTagName('filename')[0].textContent.split('.')[0];
      // Extract data from the annotation
      const framenumber =  fileName +'_'+ convertNumberToAnyDigit(annotation.getElementsByTagName('framenumber')[0].textContent*1 +1, 8);
      const name = annotation.getElementsByTagName('name')[0].textContent;
      const id = annotation.getElementsByTagName('id')[0].textContent;
      const bndbox = annotation.getElementsByTagName("bndbox")[0];
      const xmin = bndbox.getElementsByTagName("xmin")[0].textContent;
      const ymin = bndbox.getElementsByTagName("ymin")[0].textContent;
      const width = bndbox.getElementsByTagName("width")[0].textContent;
      const height = bndbox.getElementsByTagName("height")[0].textContent;

      // Format the data into the desired format and append to the results array
      results.push(`${framenumber}, ${name}, ${id}, ${xmin}, ${ymin}, ${width}, ${height}`);
  }
  
  return results;
}
async function MCMOTToFrames(date = '240427', sortie, clip = '0007', drone = '3', fps = 10) {
    const clipDir = path.join(inputDir, date, 'MCMOT', sortie, clip, drone);
    const outputDir = path.join(date, 'MCMOT', sortie, clip, drone, 'Images');
    // const outputDirReal = path.join(date, 'MCMOT', sortie, clip, drone, 'Images');

    if(fs.readdirSync(path.join(clipDir)).length === 0 ) return;
    // console.log('clipDir', clipDir)
    const videoUrl = path.join(clipDir, getFileName(clipDir, '.mp4'));
    // if (!fs.existsSync(outputDirReal)) {
    //   createDirectory(outputDirReal)
    // }

    await convertToFramesMCMOT(videoUrl, path.join(inputDir, outputDir), fps);
    console.log('convert To MCMOTToFrames done', outputDir);
}

function contentMCMOT(date, sortie, clip, segments) {
    let resultTargetMain = '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n';
    let resultTargetBox = '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n';
    let resultTargetBoxPPK = '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n';
    let resultTargetPos = '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n';

    const mcmotDronesDir = `${inputDir}/${date}/MCMOT/${sortie}/${clip}/`;
    let filesMCMOTDrones = fs.readdirSync(mcmotDronesDir);
    // Lọc ra chỉ các thư mục
    filesMCMOTDrones = filesMCMOTDrones.filter(object => {
        return fs.statSync(path.join(mcmotDronesDir, object)).isDirectory();
    });

    let xxx = []
    const compositeKey = {}
    const compositeError = []
    if(filesMCMOTDrones.length > 0) {
        filesMCMOTDrones.forEach(drone => {
            const txtFile = path.join(inputDir, date, 'MCMOT', sortie, clip, drone, 'range.txt')
            const txtFileContent = fs.readFileSync(txtFile, 'utf8');
            const objs = txtFileContent.trim().split(',');
            let startFrame = objs[0]
            let startIndex = 0;
            if (objs.length > 1) {
                startIndex = parseInt(objs[1]) / 5
            }

            const filesInDrones = fs.readdirSync(path.join(mcmotDronesDir, drone));
            if(filesInDrones.length === 0 ) {
                return;
            }
            // Read the file content synchronously
            const fileKlvURL =  `${inputDir}/${date}/MCMOT/${sortie}/${clip}/${drone}/META_KLV.csv`;
            const filePpkURL =  `${inputDir}/${date}/MCMOT/${sortie}/${clip}/${drone}/META_PPK.csv`;
            const fileSpeedURL =  `${inputDir}/${date}/MCMOT/${sortie}/${clip}/${drone}/META_LOG.csv`;
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
            // console.log('lines.length', lines.length)
            if(segments[drone]) xxx = mergeArrays(segments[drone], lines, ppk, speedData, beacon, drone, rootTime, startFrame, startIndex, fps)
        })

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
    }

    resultTargetBox += '</root>';
    resultTargetBoxPPK += '</root>';
    resultTargetMain += '</root>';
    resultTargetPos += '</root>';
    console.log('compositeError: ', compositeError)
    return [resultTargetBox, resultTargetMain, resultTargetPos, resultTargetBoxPPK];
}

// Function to handle image upload
function handleImageUpload(fileInput, path) {
    fs.readFile(fileInput, (err, data) => {
        if (err) throw err;

        loadImage(data).then((img) => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            // Save the canvas as an image file
            const out = fs.createWriteStream(path);
            const stream = canvas.createJPEGStream({quality: 1});
            stream.pipe(out);
            // out.on('finish', () => console.log('The image was saved.'));
        }).catch((err) => {
            console.error('Error loading image:', err);
        });
    });
}

async function toMCMOTImages(fileInput, path, objects) {
    handleImageUpload(fileInput, path)
}

let count = 0
let countImg = 0
let countXml = 0
async function convertTxtToMCMOT(date, sortie, clip, mode) {
    let fileData = {};
    
    let directoryPath = path.join(inputDir, date, 'MCMOT',sortie,clip);
    let clipFolderFiles = fs.readdirSync(directoryPath);
    // Lọc ra chỉ các thư mục
    clipFolderFiles = clipFolderFiles.filter(object => {
        return fs.statSync(path.join(directoryPath, object)).isDirectory();
    });

    clipFolderFiles.forEach(drone => {
        count++
        fileData[drone] = []
        if (mode === '4') {
            // MCMOT To Frames
            MCMOTToFrames(date, sortie, clip, drone, 50)
        } else {
            const droneOutDir = path.join(date, PATH_STRING.train,'MCMOT', sortie, '0001', drone)
            if (!fs.existsSync(outDir+droneOutDir)) {
                createDirectory(droneOutDir)
            }

            const filesInDrones = fs.readdirSync(path.join(inputDir, date, 'MCMOT', sortie, clip, drone));
            if(filesInDrones.length === 0 ) {
                return;
            }
            
            const droneImgOutDir = path.join(droneOutDir, PATH_STRING.mcmot_visualized);
            if (!fs.existsSync(outDir+droneImgOutDir)) {
                createDirectory(droneImgOutDir)
            }
            let droneImgFiles = fs.readdirSync(path.join(inputDir, date, 'MCMOT', sortie, clip, drone, 'Images'));
            droneImgFiles = droneImgFiles.sort((a, b) => a.localeCompare(b));
            if(droneImgFiles.length > 0) {
                const processFile = async (img, index) => {
                    const imgURL = path.join(inputDir, date, 'MCMOT', sortie, clip, drone, 'Images', img);
                    let fileName = img.split('.')[0];
                    const rangeFile = path.join(inputDir, date, 'MCMOT', sortie, clip, drone, 'range.txt')
                    const rangeFileContent = fs.readFileSync(rangeFile, 'utf8');
                    const range = rangeFileContent.trim().split(',');
                    let startIndex = 0;
                    if (range.length > 1) {
                        startIndex = parseInt(range[1]) / 5
                    }
                    const startFrame = parseInt(range[0]) - getStartFrame(clip, drone)
                    fileName = (parseInt(fileName) - 1).toString().padStart(5, '0');
                    const imgName = ((parseInt(fileName) - startFrame)/5 + startIndex).toString().padStart(5, '0');
                    const pathOutImg = path.join(outDir, droneImgOutDir, `${date}_${'0001'}_${drone}_${imgName.slice(-digitFileName)}.jpg`);
                    const txtFileName = fileName.padStart(8, '0');
                    const txtFile = `${inputDir}/${date}/MCMOT/${sortie}/${clip}/${drone}/TXT/${txtFileName}.txt`;
                    let objs = [];
                    if (fs.existsSync(txtFile)) {
                        const txtFileContent = fs.readFileSync(txtFile, 'utf8');
                        objs = txtFileContent.trim().split('\n');
                        fileData[drone] = [...fileData[drone], ...objs];
                        
                    } else {
                        // console.log('existsSync:', clip, drone, txtFile)
                    }

                    if (mode === '5') {
                        await handleImageBoxMCMOT(imgURL, pathOutImg, objs, droneImgFiles.length);

                        let pathOutImgImg = path.join(outDir, droneOutDir, 'Images');
                        if (!fs.existsSync(pathOutImgImg)) {
                            const pa = path.join(droneOutDir, 'Images')
                            createDirectory(pa)
                        }
                        pathOutImgImg = path.join(pathOutImgImg,`${date}_${'0001'}_${drone}_${imgName.slice(-digitFileName)}.jpg`);

                        await toMCMOTImages(imgURL, pathOutImgImg, objs);
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
                    const processFiles = async () => {
                        const [contentTargetBox, contentTargetMain, contentTargetPos, contentTargetBoxPPK] = contentMCMOT(date, sortie, clip, fileData)
                        await Promise.all([
                            exportXmlToFile(contentTargetBox, `${outDir}/${date}/${PATH_STRING.train}/${PATH_STRING.mcmot}/${sortie}/${'0001/Pre'}/${PATH_STRING.mcmot_target_box}/${date}_${clip}_${drone}.xml`),
                            exportXmlToFile(contentTargetBoxPPK,  `${outDir}/${date}/${PATH_STRING.train}/${PATH_STRING.mcmot}/${sortie}/${'0001/Pre'}/${PATH_STRING.mcmot_target_box_ppk}/${date}_${clip}(PPK)_${drone}.xml`),
                            exportXmlToFile(contentTargetMain,  `${outDir}/${date}/${PATH_STRING.train}/${PATH_STRING.mcmot}/${sortie}/${'0001/Pre'}/${PATH_STRING.mcmot_target_main}/${date}_${clip}_${drone}.xml`),
                            exportXmlToFile(contentTargetPos,  `${outDir}/${date}/${PATH_STRING.train}/${PATH_STRING.mcmot}/${sortie}/${'0001/Pre'}/${PATH_STRING.mcmot_target_pos}/${date}_${clip}_${drone}.xml`)
                        ])
                    };
                    processFiles().then(e => {
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

// Function to handle image upload
async function handleImageBoxMCMOT(fileInput, path, objects, fileslength) {
    // console.log('handleImageBoxMCMOT', fileInput, path, objects)
    return new Promise((resolve, reject) => {
        try {
            fs.readFile(fileInput, (err, data) => {
                if (err) console.log(err);
        
                loadImage(data).then((img) => {
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);
                    // Draw bounding box and text
                    let cc = 0
                    objects.forEach((object, index) => {
                        object = object.split(',')
                        const minx = parseInt(object[3])
                        const miny = parseInt(object[4])
                        let width = parseInt(object[5]);
                        let height = parseInt(object[6]);
                        let xmax = minx + width;
                        let ymax = miny + height;
                        let xcenter = minx + width/2;
                        let ycenter = miny + height/2;
                        if (minx < 0) {
                            xcenter = (minx + width)/2
                            width = xcenter * 2
                            console.log(object[3], 'xcenter', xcenter)
                        }
                        if (miny < 0) {
                            ycenter = (miny + height)/2
                            height = ycenter * 2
                            console.log(object[4], 'ycenter', ycenter)
                        }
                        if (xmax > 1280) {
                            xcenter = (minx + 1280)/2
                            width = 1280 - minx
                            console.log(object[3], 'xcenter', xcenter)
                        }
                        if (ymax > 720) {
                            ycenter = (miny + 720)/2
                            height = 720 - miny
                            console.log(object[4], 'ycenter', ycenter)
                        }

                        let nem = object[1]
                        nem = nem.split('_')[0] + '_' + (+nem.split('_')[1] + 1)
                        const boxid = object[2]
                        const color = getFixedColor(nem)
                        drawTextMCMOT(ctx, nem, xcenter, ycenter, minx, xmax, miny, ymax, width, height);
                        drawBoundingBox(ctx, xcenter, ycenter, width, height, color);
                    });
        
                    // Save the canvas as an image file
                    const out = fs.createWriteStream(path);
                    const stream = canvas.createJPEGStream({quality: 1});
                    stream.pipe(out);
                    out.on('finish', () => {
                        resolve();
                    });
                    
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
function convertToFramesDET(inputVideo, outputFramesDir, fps, fileName, startFrame, endFrame) {
  return new Promise((resolve, reject) => {
      console.log('fileName', fileName)
      exec(`ffmpeg -i ${inputVideo} -vf fps=${fps} -qscale:v 2 -threads 0 ${outputFramesDir}/${fileName}_%05d.jpg`, (error, stdout, stderr) => {
          if (error) {
              console.log('error', error)
              reject(error);
              return;
          }
          
          resolve();
      });
  });
}

function convertToFramesMCMOT(inputVideo, outputFramesDir, fps) {
    return new Promise((resolve, reject) => {
      //   console.log('fileName', fileName)
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
function convertToFrames(inputVideo, outputFramesDir, fps, startFrame, endFrame) {
    return new Promise((resolve, reject) => {
        console.log(inputVideo, outputFramesDir, fps, startFrame, endFrame)

        const ffmpegCommand = `ffmpeg -i ${inputVideo} -vf -qscale:v 2 -threads 0 "select='between(n\\,${startFrame}\\,${endFrame})',fps=${fps}" ${outputFramesDir}/%05d.jpg`;

        exec(ffmpegCommand, (error, stdout, stderr) => {
            if (error) {
                console.log('error', error);
                reject(error);
                return;
            }
            resolve();
        });
    });
}


// Main function
async function convert(params) {
    try {        
        inputDir = params.input;
        outDir = params.output;
        mod = params.mode;
        fps =params.fps;
        klvTimeDifference =params.klvtimedifference;
        ppkTimeDifference =params.ppktimedifference;

        // Check if the current directory exists
        if (!fs.existsSync(outDir)) {
            // If not, create it
            fs.mkdirSync(outDir);
        }

        const filesDate = fs.readdirSync(inputDir);
        if(filesDate.length > 0) {
          for(const date of filesDate) {
                createBaseForder(path.join(outDir, date));
                
                if(!mod || mod === '1') {
                    const DETMOTFolder = fs.readdirSync(`${inputDir}/${date}/DETMOT`);

                    if(DETMOTFolder.length > 0) {
                      for (const unplanned of DETMOTFolder) {
                            const dirDETMOTUnplanned = `${inputDir}/${date}/DETMOT/${unplanned}`;
                            createDirectory(path.join(date, PATH_STRING.train, PATH_STRING.det_mot, unplanned))
                            // Read all files in the directory
                            const filesDETDrones = fs.readdirSync(dirDETMOTUnplanned);
        
                            if(filesDETDrones.length > 0) {
                                for (const drone of filesDETDrones){
                                    const droneDir = path.join(dirDETMOTUnplanned, drone);
                                    createDirectory(path.join(date, PATH_STRING.train, PATH_STRING.det_mot, unplanned, drone))
                                    // Read all files in the Unplanned directory
                                    const sortieDETClips = fs.readdirSync(droneDir);
                                    if(sortieDETClips.length > 0) {
                                      for(const sortie of sortieDETClips) {
                                            const sortieDir = path.join(droneDir, sortie);
                                            const filesDETClips = fs.readdirSync(sortieDir);
                                            const metaSortieInputDir =  path.join(inputDir, date, 'Metadata');
                                            
                                            const metadataFileName = `${sortie.split('_').join('')}_${convertNumberToAnyDigit(drone,2)}_${date}`;
                                            //get content metadata ppk
                                            const ppkFileUrl = path.join(metaSortieInputDir, 'PPK', metadataFileName+'_PPK.csv')
                                            const filePPKContent = fs.readFileSync(ppkFileUrl, 'utf8');
                                            linesPPK = filePPKContent.trim().split('\n').map(line => line.split(','));

                                            //get content metadata log
                                            const logFileUrl = path.join(metaSortieInputDir,'LOG', metadataFileName+'_FC LOG.csv')
                                            const fileLogContent = fs.readFileSync(logFileUrl, 'utf8');
                                            linesLog = fileLogContent.trim().split('\n').map(line => line.split(','));
                                            if(filesDETClips.length > 0) {
                                                for(const clip of filesDETClips) {
                                                    await convertInputToDETMOT(date, drone, sortie, clip, droneDir, unplanned === 'Unplanned')
                                                }
                                            }
                                        }
                                    }
                                };
                            };
                        }
                    }
                }

                if(!mod || mod === '2' || mod === '4' || mod === '5') {
                    createBaseForder(path.join(outDir, date));
                    let sortiePath = path.join(inputDir, date, 'MCMOT');
                    let sortieFiles = fs.readdirSync(sortiePath);
                    // Lọc ra chỉ các thư mục
                    sortieFiles = sortieFiles.filter(object => {
                        return fs.statSync(path.join(sortiePath, object)).isDirectory();
                    });
                    if(sortieFiles.length > 0) {
                        sortieFiles.forEach(sortie => {
                            let clipsPath = path.join(inputDir, date, 'MCMOT', sortie);
                            let clipsFiles = fs.readdirSync(clipsPath);
                            clipsFiles = clipsFiles.filter(object => {
                                return fs.statSync(path.join(clipsPath, object)).isDirectory();
                            });
                            if(clipsFiles.length > 0) {
                                clipsFiles.forEach(async clip => {
                                    await convertTxtToMCMOT(date, sortie, clip, mod);
                                })
                            }
                        })
                    }
                }
            }
        }

        console.log('Conversion complete.');
    } catch (error) {
        console.error('Error during conversion:', error);
    }
}

// Run the main function
export {convert}