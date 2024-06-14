import { Transform } from 'stream';
import express from 'express';
import morganMiddleware from './src/morgan.middleware.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// The morgan middleware does not need this.
// This is for a manual log
import logger from './src/logger.js';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);
// const logFile = path.join(__dirname, '../logs/app.log');

const app = express();
import bodyParser from 'body-parser';
const PORT = process.env.PORT || 3000;
app.use(bodyParser.json());
let clients = [];

import { convert } from './node.js';

// Add the morgan middleware
app.use(morganMiddleware);

// Đường dẫn tĩnh cho các tệp HTML, CSS, JS
app.use(express.static('public'));

// Define the route handler using async/await
app.post('/api/data', async (req, res) => {
  try {
    // Call the convert function and wait for it to complete
    logger.info('Start convert');
    await convert(req.body);

    // Once the convert function completes, send the response
    res.json({ status: 200 });
  } catch (error) {
    // If an error occurs during the conversion process, handle it
    console.error('Error converting data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/logs', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send a comment to keep the connection alive
  res.write(': connected\n\n');

  clients.push(res);

  // Remove client when it disconnects
  req.on('close', () => {
    clients = clients.filter(client => client !== res);
  });
});

// Watch the log file for changes and notify clients
fs.watch('./logs/app.log', { encoding: 'buffer' }, (eventType, filename) => {
  if (filename) {
    fs.readFile('./logs/app.log', 'utf8', (err, data) => {
      if (err) throw err;

      const lines = data.trim().split('\n');
      const lastLog = lines[lines.length - 1];
      let logEntry;
      try {
        logEntry = JSON.parse(lastLog || '');
      } catch (error) {
        console.error('Error parsing log entry:', error);
        return;
      }

      const logMessage = `${new Date(logEntry.timestamp).toLocaleString()} - ${logEntry.message}\n`;

      // Send new log entry to all connected clients
      clients.forEach(client => client.write(`data: ${logMessage}\n\n`));
    });
  }
});

// Endpoint to stop listening and disconnect clients
app.post('/api/stop-logs', (req, res) => {
  if (fileWatcher) {
    fileWatcher.close();
    fileWatcher = null;
  }

  // Close SSE connections to all clients
  clients.forEach(client => client.end());
  clients = [];

  res.send('Stopped listening to log file changes.');
});

// Chạy server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
