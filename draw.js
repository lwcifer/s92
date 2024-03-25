const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');

// Create a canvas and context
const canvas = createCanvas(500, 500);
const ctx = canvas.getContext('2d');

// Function to draw a dot at a specific position
function drawDot(x, y, radius, color) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = color;
    ctx.fill();
}

// Function to handle image upload
function handleImageUpload(fileInput) {
    fs.readFile(fileInput, (err, data) => {
        if (err) throw err;

        loadImage(data).then((img) => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            // Example usage: draw a dot at the specified position
            drawDot(100, 100, 3, 'red');

            // Save the canvas as an image file
            const out = fs.createWriteStream('canvas_image.png');
            const stream = canvas.createPNGStream();
            stream.pipe(out);
            out.on('finish', () => console.log('The image was saved.'));
        }).catch((err) => {
            console.error('Error loading image:', err);
        });
    });
}

// Example usage: handle image upload
handleImageUpload('frame_1.png');
