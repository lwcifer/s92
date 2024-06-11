import fs from 'fs';
import path from 'path';

import { createBaseForder } from './util.js';
import { convertMCMOT } from './mcmot.js';
import { convertDETMOT } from './src/detmot.js'


// Main function
async function convert(params) {
    try {        
        const timeStart = new Date();
        const inputDir = params.input;
        const outDir = params.output;
        const mod = params.mode;
        const fps =params.fps;
        const klvTimeDifference =params.klvtimedifference;
        const ppkTimeDifference =params.ppktimedifference;

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
                  await convertDETMOT(inputDir, date, outDir, klvTimeDifference, ppkTimeDifference, fps);
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
                            convertMCMOT(inputDir, outDir, fps, date, sortie, mod)
                        })
                    }
                }
            }
        }
        const timeEnd = new Date();
        console.log('Time taken:', timeEnd - timeStart, 'ms');
        console.log('Conversion complete.');
    } catch (error) {
        console.error('Error during conversion:', error);
    }
}

// Run the main function
export {convert}