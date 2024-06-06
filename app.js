import express from 'express';
const app = express();
import bodyParser from 'body-parser';
const PORT = process.env.PORT || 3000;
app.use(bodyParser.json());

import { convert } from './node.js';

// Đường dẫn tĩnh cho các tệp HTML, CSS, JS
app.use(express.static('public'));

// Define the route handler using async/await
app.post('/api/data', async (req, res) => {
  try {
    // Call the convert function and wait for it to complete
    await convert(req.body);

    // Once the convert function completes, send the response
    res.json({ status: 200 });
  } catch (error) {
    // If an error occurs during the conversion process, handle it
    console.error('Error converting data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// Chạy server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
