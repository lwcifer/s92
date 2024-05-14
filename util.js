const fs = require('fs');
const path = require('path');
const { PATH_STRING } = require('./contanst');

/***/
function getFixedColor(inputString) {
    // Tính toán hash từ chuỗi đầu vào
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

function addDifferenceTime(root, difference) {
    let res = new Date(root)

    res.setSeconds(res.getSeconds() + difference)

    return res.getTime()
}

/**/
function sortPromax(arr, start, timeDiff) {
    let res = [];
    let min;
    let minItem;
    for (let i = 0; i < arr.length; i++) {
        const item = arr[i];
        const num = addDifferenceTime(item.split(',')[0], timeDiff);
        if (num >= start) {
            res.push(item);
            for (let j = res.length - 1; j > 0; j--) {
                const g1 = addDifferenceTime(res[j].split(',')[0], timeDiff);
                const g0 = addDifferenceTime(res[j - 1].split(',')[0], timeDiff);
                if (g1 < g0) {
                    [res[j], res[j - 1]] = [res[j - 1], res[j]];
                } else {
                    break;
                }
            }
        } else {
            if (!min || start - num < min) {
                min = start - num
                minItem = item
            }
        }
    }
    if (min < new Date(res[0].split(',')[0]).getTime() - start) {
        res = [minItem, ...res]
    }

    return res
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

module.exports = { getFixedColor, valueToText, uCreateDirectory, createBaseForder, uFrameIndexToTime, timeDifference, exportXmlToFile, sortPromax, extraDataMCMOT, addDifferenceTime }