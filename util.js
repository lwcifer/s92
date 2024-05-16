const fs = require('fs');
const path = require('path');
const { PATH_STRING } = require('./contanst');

/***/
function getFixedColor(inputString) {
    // Tính toán hash từ chuỗi đầu vào
    let category = inputString.split('_')[0]
    switch (category) {
        case 'car':
            category = 0
            break;
        case 'bus':
            category = 1
            break;
        case 'truck':
            category = 2
            break;
        default:
            category = 0
            break;
    }

    let hash = 0;
    for (let i = 1; i < inputString.length; i++) {
        hash = inputString.charCodeAt(i) + ((hash << 6) - hash);
    }

    // Chọn một màu dựa trên hash, kết hợp với một số điều chỉnh
    let color = "#";
    for (let i = 0; i < 3; i++) {
        const value = ((hash >> (i * 8)) + i * 133) % 256; // Sử dụng số điều chỉnh i * 133
        color += ("00" + value.toString(16)).substr(-2);
    }

    console.log(inputString, color)
    return color;
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
  console.log('rootDate', res, root.split(' ')[1])

  // Add the difference in seconds to the new Date object
  res.setSeconds(res.getSeconds() + difference);
  // Return the timestamp of the new date
  return formatDate(new Date(res));
}

function isValidDate(date) {
    return date instanceof Date && !isNaN(date.getTime());
}

function addDifferenceTimeGetTime(root, difference) {
    let date = root.split(' ')[0]
    let rootDate = new Date(date);
    if (isValidDate(rootDate)) {
        date = date.split('-')[2] + '-' + date.split('-')[1] + '-' + date.split('-')[0]
        rootDate = new Date(date);
    }

    // Create a new Date object from the root to avoid modifying the original date
    let res = setTimeToDate(rootDate, root.split(' ')[1]);
    
    // Add the difference in seconds to the new Date object
    res.setSeconds(res.getSeconds() + difference);
    // Return the timestamp of the new date

    res = new Date(formatDate(new Date(res)))
    console.log('Invalid Date:', root, difference, rootDate, res.getTime())
    return res.getTime();
}

/**/
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

module.exports = { addDifferenceTimeGetTime, getFixedColor, valueToText, uCreateDirectory, createBaseForder, uFrameIndexToTime, timeDifference, exportXmlToFile, sortPromax, extraDataMCMOT, addDifferenceTime }