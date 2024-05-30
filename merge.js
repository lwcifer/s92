import fs from 'fs';
import path from 'path';
import xml2js from 'xml2js';

function mergeXML (folderDir, fileName) {
    // const folderDir = 'D:\\FTP07\\out01\\240427\\Train\\MCMOT\\07\\0001\\'
    const folderPaths = [
        'Annotation MCMOT TargetBox',
        'Annotation MCMOT TargetBox PPK',
        'Annotation MCMOT TargetMain',
        'Annotation MCMOT TargetPos',
    ];

    folderPaths.forEach(fPath => {
        const outputFile = fPath == 'Annotation MCMOT TargetBox PPK' ? `${fileName}(PPK).xml` : `${fileName}.xml`;
        const outputFolder = folderDir + (fPath == 'Annotation MCMOT TargetBox PPK' ? 'Annotation MCMOT TargetBox' : fPath)
        const folderPath = folderDir + 'Pre/' + fPath
        const parser = new xml2js.Parser();
        const builder = new xml2js.Builder({ headless: true, renderOpts: { pretty: true } });

        // Function to sanitize XML element names
        function sanitizeElementName(name) {
            return name.replace(/[^a-zA-Z0-9._:-]/g, '_');
        }

        // Function to recursively sanitize XML object
        function sanitizeXmlObject(obj) {
            if (typeof obj !== 'object' || obj === null) return obj;

            return Object.keys(obj).reduce((sanitizedObj, key) => {
                const sanitizedKey = sanitizeElementName(key);
                sanitizedObj[sanitizedKey] = Array.isArray(obj[key])
                ? obj[key].map(sanitizeXmlObject)
                : sanitizeXmlObject(obj[key]);
                return sanitizedObj;
            }, {});
        }

        const getLargestFile = (folderPath) => {
            const files = fs.readdirSync(folderPath).filter(file => file.endsWith('.xml'));
            let largestFile = null;
            let maxSize = 0;
        
            files.forEach(file => {
                const filePath = path.join(folderPath, file);
                const stats = fs.statSync(filePath);
                if (stats.size > maxSize) {
                    maxSize = stats.size;
                    largestFile = file;
                }
            });
        
            return [largestFile];
        };

        async function mergeXmlFiles(folderPath, outputFile) {
            const root = { root: { object: [] } };

            let files = fs.readdirSync(folderPath).filter(file => file.endsWith('.xml'));
            files = files.sort((a, b) => a.localeCompare(b));
            if (fPath == 'Annotation MCMOT TargetMain') {
                files = getLargestFile(folderPath)
            }
            for (const file of files) {
                const filePath = path.join(folderPath, file);
                const data = fs.readFileSync(filePath, 'utf8');
                const result = await parser.parseStringPromise(data);
                if (result.root && result.root.object) {
                    root.root.object.push(...result.root.object.map(sanitizeXmlObject));
                }
            }
            if (!fs.existsSync(outputFolder)) {
                fs.mkdirSync(outputFolder, { recursive: true });
            }
            const xml = builder.buildObject(root);
            fs.writeFileSync(outputFolder +'/'+ outputFile, xml, { encoding: 'utf-8' });
        }

        mergeXmlFiles(folderPath, outputFile)
        .then(() => console.log('XML files merged successfully!', outputFolder +'/'+ outputFile))
        .catch(err => console.error('Error merging XML files:', err));
    });
}


export {mergeXML}
