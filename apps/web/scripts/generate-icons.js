#!/usr/bin/env node

/**
 * Generate PWA icons from the base SVG
 * 
 * Usage: node scripts/generate-icons.js
 * 
 * This script creates PNG icons at various sizes for PWA support.
 * Requires: sharp (npm install sharp)
 */

const fs = require('fs');
const path = require('path');

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const ICONS_DIR = path.join(__dirname, '../public/icons');
const SVG_PATH = path.join(ICONS_DIR, 'icon.svg');

async function generateIcons() {
  try {
    // Check if sharp is available
    let sharp;
    try {
      sharp = require('sharp');
    } catch {
      console.log('sharp not installed. Installing...');
      const { execSync } = require('child_process');
      execSync('npm install sharp --no-save', { cwd: path.join(__dirname, '..') });
      sharp = require('sharp');
    }

    // Read SVG
    const svgBuffer = fs.readFileSync(SVG_PATH);

    // Generate icons for each size
    for (const size of SIZES) {
      const outputPath = path.join(ICONS_DIR, `icon-${size}.png`);
      
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(outputPath);
      
      console.log(`✓ Generated icon-${size}.png`);
    }

    // Generate maskable icons (with padding)
    const maskableSizes = [192, 512];
    for (const size of maskableSizes) {
      const outputPath = path.join(ICONS_DIR, `icon-maskable-${size}.png`);
      
      // Add padding for maskable icons
      const padding = Math.round(size * 0.1);
      const innerSize = size - (padding * 2);
      
      await sharp(svgBuffer)
        .resize(innerSize, innerSize)
        .extend({
          top: padding,
          bottom: padding,
          left: padding,
          right: padding,
          background: { r: 10, g: 10, b: 11, alpha: 1 } // #0A0A0B
        })
        .png()
        .toFile(outputPath);
      
      console.log(`✓ Generated icon-maskable-${size}.png`);
    }

    console.log('\n✅ All icons generated successfully!');
    console.log('Icons are in: public/icons/');

  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

// Also generate search and play shortcut icons
async function generateShortcutIcons() {
  try {
    const sharp = require('sharp');
    
    // Create a simple search icon SVG
    const searchSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
      <rect width="96" height="96" rx="16" fill="#1a1a2e"/>
      <circle cx="42" cy="42" r="18" fill="none" stroke="#d0bcff" stroke-width="6"/>
      <line x1="56" y1="56" x2="72" y2="72" stroke="#d0bcff" stroke-width="6" stroke-linecap="round"/>
    </svg>`;
    
    const searchPath = path.join(ICONS_DIR, 'search-96.png');
    await sharp(Buffer.from(searchSvg)).resize(96, 96).png().toFile(searchPath);
    console.log('✓ Generated search-96.png');
    
    // Create a simple play icon SVG
    const playSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
      <rect width="96" height="96" rx="16" fill="#1a1a2e"/>
      <path d="M36 24 L72 48 L36 72 Z" fill="#d0bcff"/>
    </svg>`;
    
    const playPath = path.join(ICONS_DIR, 'play-96.png');
    await sharp(Buffer.from(playSvg)).resize(96, 96).png().toFile(playPath);
    console.log('✓ Generated play-96.png');
    
  } catch (error) {
    console.log('⚠ Could not generate shortcut icons (non-critical)');
  }
}

async function main() {
  console.log('🎬 Generating Veyra PWA icons...\n');
  
  await generateIcons();
  await generateShortcutIcons();
  
  console.log('\n🎬 Done! Your PWA icons are ready.');
}

main();
