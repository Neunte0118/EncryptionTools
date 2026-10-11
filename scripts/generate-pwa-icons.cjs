const fs = require('fs');
const path = require('path');
const UPNG = require('@pdf-lib/upng').default;

const publicDir = path.resolve(__dirname, '../public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

function drawIcon(size, isMaskable = false) {
  const buffer = new Uint8Array(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;

  // Maskable scale has 15% padding
  const scale = isMaskable ? 0.75 : 0.88;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;

      // Background gradient: from (79, 70, 229) to (30, 27, 75)
      const t = (x + y) / (size * 2);
      let r = Math.round(79 * (1 - t) + 30 * t);
      let g = Math.round(70 * (1 - t) + 27 * t);
      let b = Math.round(229 * (1 - t) + 75 * t);
      let a = 255;

      // Rounded rectangle for non-maskable icons
      if (!isMaskable) {
        const cornerR = size * 0.22;
        const dx = Math.abs(x - cx) - (cx - cornerR);
        const dy = Math.abs(y - cy) - (cy - cornerR);
        if (dx > 0 && dy > 0 && dx * dx + dy * dy > cornerR * cornerR) {
          a = 0;
        }
      }

      // Shield and lock drawing (normalized coords -1 to 1)
      const nx = (x - cx) / (cx * scale);
      const ny = (y - cy) / (cy * scale);

      // Shield region: ny >= -0.7 && ny <= 0.8 && |nx| <= (0.8 - ny*0.4)
      const inShield =
        ny >= -0.7 &&
        ny <= 0.75 &&
        Math.abs(nx) <= (ny < 0 ? 0.75 : 0.75 * (1 - Math.pow(ny / 0.85, 2)));

      if (a > 0 && inShield) {
        // Shield color: indigo-500 #6366f1 to indigo-600 #4f46e5
        r = Math.min(255, r + 45);
        g = Math.min(255, g + 40);
        b = 245;

        // Border of shield
        const borderDist = Math.abs(nx) - (ny < 0 ? 0.72 : 0.72 * (1 - Math.pow(ny / 0.85, 2)));
        if (borderDist > -0.06 || ny < -0.66) {
          r = 210;
          g = 220;
          b = 255;
        }

        // Lock shackle: ny from -0.35 to 0.0, |nx| <= 0.24, inner |nx| <= 0.14
        const inShackleOuter = ny >= -0.38 && ny <= 0.05 && Math.abs(nx) <= 0.22;
        const inShackleInner = ny >= -0.28 && ny <= 0.1 && Math.abs(nx) <= 0.12;
        if (inShackleOuter && !inShackleInner) {
          r = 255;
          g = 255;
          b = 255;
        }

        // Lock body: ny from 0.0 to 0.42, |nx| <= 0.32
        const inLockBody = ny >= 0.0 && ny <= 0.42 && Math.abs(nx) <= 0.32;
        if (inLockBody) {
          r = 255;
          g = 255;
          b = 255;

          // Keyhole
          const keyholeCircle = Math.pow(nx, 2) + Math.pow(ny - 0.16, 2) < 0.005;
          const keyholeSlot = ny >= 0.16 && ny <= 0.3 && Math.abs(nx) <= 0.035;
          if (keyholeCircle || keyholeSlot) {
            r = 79;
            g = 70;
            b = 229;
          }
        }
      }

      buffer[idx] = r;
      buffer[idx + 1] = g;
      buffer[idx + 2] = b;
      buffer[idx + 3] = a;
    }
  }

  const png = UPNG.encode([buffer.buffer], size, size, 0);
  return Buffer.from(png);
}

// Generate all standard PWA icons
console.log('Generating PWA icons...');

fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), drawIcon(192, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), drawIcon(512, false));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), drawIcon(512, true));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), drawIcon(180, false));
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), drawIcon(64, false));

console.log('PWA icons generated successfully in public/');
