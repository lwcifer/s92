import fs from 'fs';
import path from 'path';
import { PATH_STRING, categories, DRONE_DEFAULT_VALUES } from './contanst.js';

function splitTextAndNumbers(input) {
  // Find all parts of the string that are either letters or digits
  const parts = input.match(/[A-Za-z]+|\d+/g);
  return parts;
}

/***/
// inputString: car_1
function getFixedColor(inputString) {
    let [category, id] = splitTextAndNumbers(inputString)
    let number = ''
    switch (category) {
        case 'car':
            number = '1' + id
            break;
        case 'bus':
            number = '2' + id
            break;
        case 'truck':
            number = '3' + id
            break;
        default:
            number = '1' + id
            break;
    }

    const randomValue = Math.abs(Math.sin(+number)) * 16777215;

    const hexColor = `#${Math.floor(randomValue).toString(16).padStart(6, '0')}`;

    return hexColor;
}

/***/
function valueToText(val) {
    if (!val) {
        return 'Null'
    }

    return val.trim().replace(/\0+$/, '')
}

// Function to create directory recursively
function uCreateDirectory(dirPath, outDir) {
    // Split the path into individual directories
    const dirs = dirPath.split(path.sep);
    // Initialize current path as the root directory
    let currentPath = '';
    // Iterate through each directory in the path
    for (const dir of dirs) {
        // Append the current directory to the current path
        currentPath = path.join(currentPath, dir);
        // Check if the current directory exists
        if (!fs.existsSync(outDir + '/' + currentPath)) {
            // If not, create it
            fs.mkdirSync(outDir + '/' + currentPath);
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

// Function to calculate the time difference between two timestamps
function timeDifference(t1, t2) {
    return Math.abs(new Date(t1) - new Date(t2));
}

function uFrameIndexToTime(startTime, index, fps) {
    const timestamp = (index / fps) * 1000
    const date = new Date(startTime)
    const timestampFromDateString = date.getTime() + timestamp

    return timestampFromDateString
}

/***/
function exportXmlToFile(xmlContent, filename) {
    console.log();
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
function setTimeToDate(date, timeString) {
    // Split the time string into its components
    const [hours, minutes, seconds, milliseconds] = timeString.split(/[.:]/).map(Number);

    // Set the time on the date object
    date.setHours(hours);
    date.setMinutes(minutes);
    date.setSeconds(seconds);
    date.setMilliseconds(milliseconds);

    return date;
}
function formatDate(date) {
    // Extract date components
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');

    // Format the date string
    const formattedDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;

    return formattedDate;
}

function addDifferenceTime(root, difference) {
    let rootDate = new Date(root.split(' ')[0]);

    // Create a new Date object from the root to avoid modifying the original date
    let res = setTimeToDate(rootDate, root.split(' ')[1]);
    //console.log('rootDate', res, root.split(' ')[1])

    // Add the difference in seconds to the new Date object
    res.setSeconds(res.getSeconds() + difference * 1);
    // Return the timestamp of the new date
    return formatDate(new Date(res));
}

function isValidDate(date) {
    return date instanceof Date && !isNaN(date.getTime());
}

function addDifferenceTimeGetTime(root, difference) {
    return new Date(root).getTime();

    let date = root.split(' ')[0]
    let rootDate = new Date(date);
    if (!isValidDate(rootDate)) {
        date = date.split('-')[2] + '-' + date.split('-')[1] + '-' + date.split('-')[0]
        rootDate = new Date(date);
    }

    // Create a new Date object from the root to avoid modifying the original date
    let res = setTimeToDate(rootDate, root.split(' ')[1]);

    // Add the difference in seconds to the new Date object
    res.setSeconds(res.getSeconds() + difference);
    // Return the timestamp of the new date

    res = new Date(formatDate(new Date(res)))
    // console.log('addDifferenceTimeGetTime:', rootDate, difference, res)
    return res.getTime();
}

/**/

function mergeArrays(array1, klv, ppk, speed, beacon, drone, rootTime, fps, klvTimeDifference, ppkTimeDifference, speedTimeDifference, beaconTimeDifference) {
    // Duyệt qua từng phần tử trong array1
    return array1.map(item1 => {
        let closestItemKLV = null;
        let closestItemPPK = null;
        let closestItemSpeed = null;
        let closestItemBeacon = null;
        let minTimeDifferenceKLV = Infinity;
        let minTimeDifferencePPK = Infinity;
        let minTimeDifferenceSpeed = Infinity;
        let minTimeDifferenceBeacon = Infinity;
        let timeklv = '';
        let timeppk = '';
        let timespeed = '';
        let timebeacon = '';
        // console.log('mergeArrays', (klv[item1.split(',')[0]].split(',')[0]))
        const g1 = new Date(klv[item1.split(',')[0]].split(',')[0]).getTime();

        // Tìm phần tử có thời gian gần đúng nhất trong klv
        closestItemKLV = extraDataMCMOT(klv[item1.split(',')[0]], drone);
        // klv.forEach(item2 => {
        //     if (item2 && item2.trim().length > 0) {
        //         timeklv = addDifferenceTimeGetTime(item2.split(',')[0], klvTimeDifference);
        //         const timeDifference = Math.abs(g1 - timeklv);
        //         if (timeDifference < minTimeDifferenceKLV) {
        //             minTimeDifferenceKLV = timeDifference;
        //             closestItemKLV = extraDataMCMOT(item2, drone);
        //         }
        //     }
        // });

        // Tìm phần tử có thời gian gần đúng nhất trong ppk
        ppk.forEach(item2 => {
            if (item2 && item2.trim().length > 0) {
                timeppk = addDifferenceTimeGetTime(item2.split(',')[0], ppkTimeDifference);
                const timeDifference = Math.abs(g1 - timeppk);
                if (timeDifference < minTimeDifferencePPK) {
                    minTimeDifferencePPK = timeDifference;
                    closestItemPPK = item2;
                }
            }
        });

        // Tìm phần tử có thời gian gần đúng nhất trong speed
        speed.forEach(item2 => {
            if (item2 && item2.trim().length > 0) {
                timespeed = addDifferenceTimeGetTime(item2.split(',')[0], speedTimeDifference);
                const timeDifference = Math.abs(g1 - timespeed);
                if (timeDifference < minTimeDifferenceSpeed) {
                    minTimeDifferenceSpeed = timeDifference;
                    closestItemSpeed =  item2;
                }
            }
        });

        // Tìm phần tử có thời gian gần đúng nhất trong beacon
        beacon.forEach(item2 => {
            if (item2 && item2.trim().length > 0) {
                timebeacon = addDifferenceTimeGetTime(item2.split(',')[0], beaconTimeDifference);
                const timeDifference = Math.abs(g1 - timebeacon);
                if (timeDifference < minTimeDifferenceBeacon) {
                    minTimeDifferenceBeacon = timeDifference;
                    closestItemBeacon = item2;
                }
            }
        });

        // Hợp nhất giá trị từ phần tử gần đúng nhất của klv, ppk, speed và beacon vào array1
        return {
            drone,
            segment: item1,
            klv: closestItemKLV || '',
            ppk: closestItemPPK || '',
            speed: closestItemSpeed || '',
            beacon: closestItemBeacon || ''
        };
    });
}


function sortPromax(arr, start, timeDiff, check) {
    let res = [];
    let min;
    let minItem;

    for (let i = 0; i < arr.length; i++) {
        const item = arr[i];
        if (item && item.split(',')[0]) {
            const num = addDifferenceTimeGetTime(item.split(',')[0], timeDiff, check);

            if (num >= start) {
                res.push(item);
                // Sắp xếp các phần tử mới thêm vào `res`
                for (let j = res.length - 1; j > 0; j--) {
                    const g1 = addDifferenceTimeGetTime(res[j].split(',')[0], timeDiff, check);
                    const g0 = addDifferenceTimeGetTime(res[j - 1].split(',')[0], timeDiff, check);
                    if (g1 < g0) {
                        [res[j], res[j - 1]] = [res[j - 1], res[j]];
                    } else {
                        break;
                    }
                }
            } else {
                // Lưu lại phần tử gần với `start` nhất nhưng nhỏ hơn `start`
                if (!min || start - num < min) {
                    min = start - num;
                    minItem = item;
                }
            }
        }
    }

    // Đưa phần tử nhỏ hơn `start` nhưng gần với `start` nhất vào đầu `res`
    if (minItem) {
        res = [minItem, ...res];
    }
    console.log('sortPromax: ', res.length)
    return res;
}

function extraDataMCMOT(item, dr) {
    switch (dr) {
        case '2':
            item += `,-0.5,0.3,1.7,182.4`;
            break;
        case '3':
            item += `,0,-1,0,178`;
            break;
        case '4':
            item += `,2,-2.6,0.5,180`;
            break;
        case '5':
            item += `,0,-1.5,3,180`;
            break;
    }

    return item
}

function getFileName(dir, type) {
    const files = fs.readdirSync(dir);
    const file = files.find(file => path.extname(file) === type);
    if (!file) {
        throw new Error('No .mp4 file found in the directory');
    }
    return file;
}

function convertNumberToAnyDigit (number, digit) {
    return number.toString().padStart(digit, '0');
}

export { convertNumberToAnyDigit, getFileName, mergeArrays, addDifferenceTimeGetTime, getFixedColor, valueToText, uCreateDirectory, createBaseForder, uFrameIndexToTime, timeDifference, exportXmlToFile, sortPromax, extraDataMCMOT, addDifferenceTime }


