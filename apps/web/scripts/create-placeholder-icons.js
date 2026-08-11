#!/usr/bin/env node

/**
 * Create placeholder PNG icons for PWA
 * 
 * This script creates simple placeholder icons.
 * Replace these with your actual branded icons before production.
 */

const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.join(__dirname, '../public/icons');
const SCREENSHOTS_DIR = path.join(__dirname, '../public/screenshots');

// Ensure directories exist
[ICONS_DIR, SCREENSHOTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Simple PNG generator (1x1 pixel PNG as base)
// In production, use proper icon generation tools
const createPlaceholderPNG = (size) => {
  // This creates a minimal valid PNG file
  // For production, replace with actual branded icons
  const PNG_HEADER = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
  ]);
  
  // For now, we'll just create a marker file
  return `Placeholder ${size}x${size} - Replace with actual icon`;
};

// Icon sizes needed
const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

console.log('Creating placeholder PWA icons...\n');

// Create placeholder files
ICON_SIZES.forEach(size => {
  const filename = `icon-${size}.png`;
  const filepath = path.join(ICONS_DIR, filename);
  
  if (!fs.existsSync(filepath)) {
    fs.writeFileSync(filepath, createPlaceholderPNG(size));
    console.log(`✓ Created ${filename} (placeholder)`);
  } else {
    console.log(`- ${filename} already exists`);
  }
});

// Maskable icons
[192, 512].forEach(size => {
  const filename = `icon-maskable-${size}.png`;
  const filepath = path.join(ICONS_DIR, filename);
  
  if (!fs.existsSync(filepath)) {
    fs.writeFileSync(filepath, createPlaceholderPNG(size));
    console.log(`✓ Created ${filename} (placeholder)`);
  } else {
    console.log(`- ${filename} already exists`);
  }
});

// Shortcut icons
[96].forEach(size => {
  ['search', 'play'].forEach(type => {
    const filename = `${type}-${size}.png`;
    const filepath = path.join(ICONS_DIR, filename);
    
    if (!fs.existsSync(filepath)) {
      fs.writeFileSync(filepath, createPlaceholderPNG(size));
      console.log(`✓ Created ${filename} (placeholder)`);
    } else {
      console.log(`- ${filename} already exists`);
    }
  });
});

// Screenshot placeholders
const SCREENSHOT_SIZES = [
  { name: 'desktop.png', width: 1920, height: 1080 },
  { name: 'mobile.png', width: 1080, height: 1920 },
];

SCREENSHOT_SIZES.forEach(({ name, width, height }) => {
  const filepath = path.join(SCREENSHOTS_DIR, name);
  
  if (!fs.existsSync(filepath)) {
    fs.writeFileSync(filepath, `Placeholder screenshot ${width}x${height}`);
    console.log(`✓ Created screenshots/${name} (placeholder)`);
  } else {
    console.log(`- screenshots/${name} already exists`);
  }
});

console.log('\n✅ Placeholder icons created!');
console.log('\n📝 To generate proper icons:');
console.log('   1. Design your icon as a 512x512 SVG');
console.log('   2. Save it as public/icons/icon.svg');
console.log('   3. Run: npm run generate-icons');
console.log('   Or use an online tool like https://progressier.com/');
