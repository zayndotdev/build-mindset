const fs = require('fs');
const path = require('path');

async function processLogo() {
  const sharp = require('sharp');
  const inputPath = 'C:\\Users\\hp-new\\.gemini\\antigravity-ide\\brain\\638cb13e-9c1e-4a84-8061-2941323ebb7d\\mindset_minimal_logo_1790887261731.jpg';
  
  console.log('Loading source image:', inputPath);
  const metadata = await sharp(inputPath).metadata();
  console.log(`Original dimensions: ${metadata.width}x${metadata.height}`);

  // 1. Get raw pixel buffer
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const channels = info.channels; // 4 (RGBA)

  console.log(`Raw buffer: ${width}x${height}, channels: ${channels}`);

  // 2. Cut off the bottom text ("Mindset")
  // Let's inspect where the text starts. Usually in 1024x1024, the text starts around y = 620-650.
  // We can also detect rows of white space between the logo mark and the text.
  
  // Find horizontal projection of non-white pixels
  const rowNonWhite = new Array(height).fill(0);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      // if not near white:
      if (r < 240 || g < 240 || b < 240) {
        rowNonWhite[y]++;
      }
    }
  }

  // Print non-white row ranges
  let inBlock = false;
  let blocks = [];
  let blockStart = 0;
  for (let y = 0; y < height; y++) {
    if (rowNonWhite[y] > 20) {
      if (!inBlock) {
        inBlock = true;
        blockStart = y;
      }
    } else {
      if (inBlock) {
        inBlock = false;
        blocks.push({ start: blockStart, end: y - 1, count: y - blockStart });
      }
    }
  }
  if (inBlock) {
    blocks.push({ start: blockStart, end: height - 1, count: height - blockStart });
  }

  console.log('Detected vertical visual blocks:', blocks);
  // Block 0 is the logo emblem mark, Block 1 (if any) is the text "Mindset"
  const logoBlock = blocks[0];
  const cutoffY = blocks.length > 1 ? Math.floor((blocks[0].end + blocks[1].start) / 2) : Math.floor(height * 0.65);
  console.log(`Using cutoff Y = ${cutoffY} to isolate emblem mark from text`);

  // 3. Remove white background with smooth alpha feathering
  // Create output RGBA buffer
  const outData = Buffer.alloc(width * height * 4);

  let minX = width, maxX = 0, minY = height, maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      if (y >= cutoffY) {
        // Discard text completely
        outData[idx] = 0;
        outData[idx + 1] = 0;
        outData[idx + 2] = 0;
        outData[idx + 3] = 0;
        continue;
      }

      // Check lightness / whiteness
      // Background in JPG compression can have subtle noise (e.g. 250-255).
      const minChannel = Math.min(r, g, b);
      const maxChannel = Math.max(r, g, b);
      const isNeutral = (maxChannel - minChannel) < 15;
      const brightness = (r * 0.299 + g * 0.587 + b * 0.114);

      let alpha = 255;
      if (isNeutral && minChannel > 248) {
        alpha = 0;
      } else if (isNeutral && minChannel > 225) {
        // Smooth transition zone
        const t = (minChannel - 225) / (248 - 225);
        alpha = Math.round(255 * (1 - t));
      } else if (brightness > 245) {
        const t = (brightness - 245) / 10;
        alpha = Math.round(255 * (1 - Math.min(1, Math.max(0, t))));
      }

      if (alpha > 0) {
        // Un-multiply white background fringe to preserve vivid orange tones
        // If color was mixed with white (255): C_orig = (C_observed - (1-a)*255) / a
        const aNorm = alpha / 255;
        let cleanR = r;
        let cleanG = g;
        let cleanB = b;
        if (aNorm > 0.05 && aNorm < 0.98) {
          cleanR = Math.max(0, Math.min(255, Math.round((r - (1 - aNorm) * 255) / aNorm)));
          cleanG = Math.max(0, Math.min(255, Math.round((g - (1 - aNorm) * 255) / aNorm)));
          cleanB = Math.max(0, Math.min(255, Math.round((b - (1 - aNorm) * 255) / aNorm)));
        }

        outData[idx] = cleanR;
        outData[idx + 1] = cleanG;
        outData[idx + 2] = cleanB;
        outData[idx + 3] = alpha;

        if (alpha > 15) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      } else {
        outData[idx] = 0;
        outData[idx + 1] = 0;
        outData[idx + 2] = 0;
        outData[idx + 3] = 0;
      }
    }
  }

  console.log(`Tight bounding box: minX=${minX}, maxX=${maxX}, minY=${minY}, maxY=${maxY}`);
  const cropWidth = maxX - minX + 1;
  const cropHeight = maxY - minY + 1;
  console.log(`Tight logo dimensions: ${cropWidth} x ${cropHeight}`);

  // Create full transparent image
  const fullTransparent = sharp(outData, {
    raw: { width, height, channels: 4 }
  });

  // Extract EXACT tight bounding box (zero padding/margin)
  const tightLogo = fullTransparent.clone().extract({
    left: minX,
    top: minY,
    width: cropWidth,
    height: cropHeight
  });

  // 4. Output files
  const publicDir = path.resolve(__dirname, '../apps/web/public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // A. Save high-res master transparent logo (tight crop)
  const logoPngPath = path.join(publicDir, 'logo.png');
  await tightLogo.clone().png().toFile(logoPngPath);
  console.log('Saved tight transparent logo:', logoPngPath);

  // B. Save a 512x512 square centered version for standard app icons / PWA
  const squareLogoPath = path.join(publicDir, 'logo-square.png');
  const maxDim = Math.max(cropWidth, cropHeight);
  await tightLogo.clone()
    .resize(512, 512, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toFile(squareLogoPath);
  console.log('Saved square transparent app icon:', squareLogoPath);

  // C. Save favicons (64x64, 32x32, 16x16, and apple-touch-icon 180x180)
  const favicon32Path = path.join(publicDir, 'favicon.png');
  await tightLogo.clone()
    .resize(64, 64, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toFile(favicon32Path);
  console.log('Saved transparent favicon.png:', favicon32Path);

  const appleTouchPath = path.join(publicDir, 'apple-touch-icon.png');
  await tightLogo.clone()
    .resize(180, 180, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toFile(appleTouchPath);
  console.log('Saved apple-touch-icon.png:', appleTouchPath);

  // D. Save transparent favicon.svg with tight viewBox matching logo aspect ratio (510x429)
  const logoBuffer = await tightLogo.clone().png().toBuffer();
  const logoBase64 = logoBuffer.toString('base64');
  const faviconSvgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cropWidth} ${cropHeight}" width="${cropWidth}" height="${cropHeight}">
  <image href="data:image/png;base64,${logoBase64}" width="${cropWidth}" height="${cropHeight}" />
</svg>
`;
  const faviconSvgPath = path.join(publicDir, 'favicon.svg');
  fs.writeFileSync(faviconSvgPath, faviconSvgContent);
  console.log('Saved transparent favicon.svg:', faviconSvgPath);

  console.log('Logo extraction and generation completed successfully!');
}

processLogo().catch(err => {
  console.error('Error processing logo:', err);
  process.exit(1);
});
