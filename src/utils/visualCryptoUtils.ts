/**
 * Naor-Shamir (2,2) Visual Cryptography (視覚復号型暗号 / 視覚秘密分散法)
 * Reference: Moni Naor & Adi Shamir, "Visual Cryptography", EUROCRYPT 1994.
 *
 * Each secret binary pixel (W x H) expands into a 2x2 subpixel block in each share (2W x 2H).
 * White pixel -> identical random 2-subpixel pattern in both shares (OR overlay = 50% gray).
 * Black pixel -> complementary 2-subpixel patterns in the two shares (OR overlay = 100% black).
 * Individual shares reveal mathematically 0 information (Shannon perfect secrecy).
 */

export interface VisualShareResult {
  width: number;
  height: number;
  share1DataUrl: string;
  share2DataUrl: string;
  share1Blob: Blob;
  share2Blob: Blob;
}

// 6 balanced 2x2 subpixel configurations (each has exactly two black subpixels)
// Represented as flat boolean arrays [top-left, top-right, bottom-left, bottom-right]
const BALANCED_PATTERNS: [boolean, boolean, boolean, boolean][] = [
  [true, false, false, true],   // Pattern 0: diagonal
  [false, true, true, false],   // Pattern 1: anti-diagonal
  [true, true, false, false],   // Pattern 2: top row
  [false, false, true, true],   // Pattern 3: bottom row
  [true, false, true, false],   // Pattern 4: left col
  [false, true, false, true],   // Pattern 5: right col
];

/**
 * Generate binary ImageData from text rendered onto an offscreen canvas.
 */
export function renderTextToBinaryImageData(
  text: string,
  maxWidth: number = 320,
  fontSize: number = 36
): ImageData {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D context not available');

  canvas.width = maxWidth;
  canvas.height = 160;

  // Fill pure white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Render text bold black
  ctx.fillStyle = '#000000';
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Handle multi-line if needed
  const lines = text.split('\n');
  const lineHeight = fontSize * 1.3;
  const startY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;

  lines.forEach((line, idx) => {
    ctx.fillText(line, canvas.width / 2, startY + idx * lineHeight);
  });

  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * Convert arbitrary image canvas/image element into binary monochrome ImageData with thresholding.
 */
export function binarizeImageData(
  sourceImageData: ImageData,
  threshold: number = 128,
  invert: boolean = false
): ImageData {
  const { width, height, data } = sourceImageData;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context not available');

  const binarized = ctx.createImageData(width, height);
  const out = binarized.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    // If transparent pixel, treat as white
    let isBlack = false;
    if (a < 64) {
      isBlack = false;
    } else {
      // Luminance formula
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      isBlack = lum < threshold;
    }

    if (invert) isBlack = !isBlack;

    const val = isBlack ? 0 : 255;
    out[i] = val;     // R
    out[i + 1] = val; // G
    out[i + 2] = val; // B
    out[i + 3] = 255; // A
  }

  return binarized;
}

/**
 * Perform Naor-Shamir (2,2) visual cryptography share generation.
 * Input: binary ImageData (width x height) where 0=black (secret), 255=white (background)
 * Output: Share 1 and Share 2, each dimension (2*width x 2*height)
 * Returns Blobs and DataURLs with transparent pixels for white, black for black.
 */
export async function generateVisualCryptoShares(
  binaryImageData: ImageData
): Promise<VisualShareResult> {
  const srcW = binaryImageData.width;
  const srcH = binaryImageData.height;
  const srcData = binaryImageData.data;

  const shareW = srcW * 2;
  const shareH = srcH * 2;

  const canvas1 = document.createElement('canvas');
  canvas1.width = shareW;
  canvas1.height = shareH;
  const ctx1 = canvas1.getContext('2d');
  if (!ctx1) throw new Error('Cannot get canvas 1 context');
  const imgData1 = ctx1.createImageData(shareW, shareH);
  const data1 = imgData1.data;

  const canvas2 = document.createElement('canvas');
  canvas2.width = shareW;
  canvas2.height = shareH;
  const ctx2 = canvas2.getContext('2d');
  if (!ctx2) throw new Error('Cannot get canvas 2 context');
  const imgData2 = ctx2.createImageData(shareW, shareH);
  const data2 = imgData2.data;

  // Use crypto.getRandomValues for true entropy in pattern assignment
  const randomBytes = new Uint8Array(srcW * srcH);
  crypto.getRandomValues(randomBytes);

  let byteIdx = 0;
  for (let y = 0; y < srcH; y++) {
    for (let x = 0; x < srcW; x++) {
      const srcOffset = (y * srcW + x) * 4;
      // Is original pixel black? (secret feature)
      // Lum < 128 means black
      const isBlack = srcData[srcOffset] < 128;

      // Pick one of the 6 balanced pattern pairs randomly
      const patternIdx = randomBytes[byteIdx++] % 6;
      const basePattern = BALANCED_PATTERNS[patternIdx];

      // For Share 1, always use basePattern
      const pat1 = basePattern;

      // For Share 2:
      // If secret is white (0), Share 2 gets same pattern (pat1)
      // If secret is black (1), Share 2 gets complement pattern (NOT pat1)
      const pat2: [boolean, boolean, boolean, boolean] = isBlack
        ? [!pat1[0], !pat1[1], !pat1[2], !pat1[3]]
        : [pat1[0], pat1[1], pat1[2], pat1[3]];

      // Write 2x2 subpixels to (2x, 2y), (2x+1, 2y), (2x, 2y+1), (2x+1, 2y+1)
      const subCoords = [
        [2 * x, 2 * y],         // Top-left
        [2 * x + 1, 2 * y],     // Top-right
        [2 * x, 2 * y + 1],     // Bottom-left
        [2 * x + 1, 2 * y + 1], // Bottom-right
      ];

      for (let s = 0; s < 4; s++) {
        const [sx, sy] = subCoords[s];
        const outOffset = (sy * shareW + sx) * 4;

        // Share 1 pixel: if true, black (opaque #000000), if false, transparent (white)
        if (pat1[s]) {
          data1[outOffset] = 0;       // R
          data1[outOffset + 1] = 0;   // G
          data1[outOffset + 2] = 0;   // B
          data1[outOffset + 3] = 255; // A (black)
        } else {
          data1[outOffset] = 255;
          data1[outOffset + 1] = 255;
          data1[outOffset + 2] = 255;
          data1[outOffset + 3] = 0;   // Transparent for physical OHP overlay
        }

        // Share 2 pixel:
        if (pat2[s]) {
          data2[outOffset] = 0;
          data2[outOffset + 1] = 0;
          data2[outOffset + 2] = 0;
          data2[outOffset + 3] = 255;
        } else {
          data2[outOffset] = 255;
          data2[outOffset + 1] = 255;
          data2[outOffset + 2] = 255;
          data2[outOffset + 3] = 0;
        }
      }
    }
  }

  ctx1.putImageData(imgData1, 0, 0);
  ctx2.putImageData(imgData2, 0, 0);

  const share1Blob = await new Promise<Blob>((resolve) => canvas1.toBlob((b) => resolve(b!), 'image/png'));
  const share2Blob = await new Promise<Blob>((resolve) => canvas2.toBlob((b) => resolve(b!), 'image/png'));

  const share1DataUrl = canvas1.toDataURL('image/png');
  const share2DataUrl = canvas2.toDataURL('image/png');

  return {
    width: shareW,
    height: shareH,
    share1DataUrl,
    share2DataUrl,
    share1Blob,
    share2Blob,
  };
}

/**
 * Digitally overlay (superimpose) two share images.
 * Models light transmission through transparency sheets: if EITHER share has a black subpixel,
 * the resulting subpixel is black (OR operation).
 */
export function overlayShares(
  img1: HTMLImageElement | HTMLCanvasElement,
  img2: HTMLImageElement | HTMLCanvasElement,
  targetCanvas: HTMLCanvasElement,
  offsetX: number = 0,
  offsetY: number = 0
): void {
  const width = targetCanvas.width;
  const height = targetCanvas.height;
  const ctx = targetCanvas.getContext('2d');
  if (!ctx) return;

  // Clear canvas with white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Draw Share 1
  ctx.drawImage(img1, 0, 0);

  // Draw Share 2 with offset
  ctx.drawImage(img2, offsetX, offsetY);
}
