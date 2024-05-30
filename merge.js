import fs from 'fs';
import path from 'path';
import xml2js from 'xml2js';

const folderPath = 'D:/S92/ABC/0006/Annotation MCMOT TargetPos';
const outputFile = 'merged_output.xml';    // Update this to your desired output file name

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

async function mergeXmlFiles(folderPath, outputFile) {
  const root = { root: { object: [] } };

  const files = fs.readdirSync(folderPath).filter(file => file.endsWith('.xml'));

  for (const file of files) {
    const filePath = path.join(folderPath, file);
    const data = fs.readFileSync(filePath, 'utf8');
    const result = await parser.parseStringPromise(data);
    if (result.root && result.root.object) {
      root.root.object.push(...result.root.object.map(sanitizeXmlObject));
    }
  }

  const xml = builder.buildObject(root);
  console.log(xml)
  fs.writeFileSync(folderPath +'/'+ outputFile, xml);
}

mergeXmlFiles(folderPath, outputFile)
  .then(() => console.log('XML files merged successfully!', folderPath +'/'+ outputFile))
  .catch(err => console.error('Error merging XML files:', err));
