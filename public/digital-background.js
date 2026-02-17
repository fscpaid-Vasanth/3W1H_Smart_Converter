/**
 * Digital Theme Background Animation
 * Creates a "Digital Rain" effect with binary/hex symbols
 * Brand Colors: Purple (#667eea) to Blue (#764ba2)
 */

const canvas = document.getElementById('bgCanvas');
const ctx = canvas.getContext('2d');

let width, height;
let columns;
const fontSize = 16;
const drops = [];

// Brand Colors Function
function getBrandColor() {
    const colors = [
        '#667eea', // Purple-Blue
        '#764ba2', // Deep Purple
        '#a78bfa', // Light Purple
        '#60a5fa', // Blue
        '#ffffff'  // White accent
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

// Initialize Canvas
function init() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    columns = Math.floor(width / fontSize);

    // Reset drops
    drops.length = 0;
    for (let i = 0; i < columns; i++) {
        drops[i] = Math.random() * -100; // Start above screen randomly
    }
}

// Draw Frame
function draw() {
    // Semi-transparent black background to create trail effect
    // Use deep dark blue/purple tint for brand consistency instead of pure black
    ctx.fillStyle = 'rgba(10, 10, 30, 0.1)';
    ctx.fillRect(0, 0, width, height);

    ctx.font = fontSize + 'px monospace';

    for (let i = 0; i < columns; i++) {
        // Random digital character (0, 1, or hex)
        const char = Math.floor(Math.random() * 2); // Binary 0 or 1
        // const char = String.fromCharCode(0x30A0 + Math.random() * 96); // Matrix Katakana style (optional)

        // Set color with glow effect
        ctx.fillStyle = getBrandColor();

        // Draw character
        ctx.fillText(char, i * fontSize, drops[i] * fontSize);

        // Reset drop to top randomly after it crosses bottom
        if (drops[i] * fontSize > height && Math.random() > 0.975) {
            drops[i] = 0;
        }

        // Move drop down
        drops[i]++;
    }
}

// Resize Handler
window.addEventListener('resize', init);

// Start Animation
init();
setInterval(draw, 50); // ~20 FPS for matrix style
