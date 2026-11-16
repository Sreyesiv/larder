// Renders the PNG icons the web app manifest and iOS need from public/icon.svg.
import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const svg = readFileSync(new URL('../public/icon.svg', import.meta.url));
const square = Buffer.from(svg.toString().replace('rx="112"', 'rx="0"'));
const out = (name) => new URL(`../public/${name}`, import.meta.url).pathname;

await sharp(svg, { density: 300 }).resize(192, 192).png().toFile(out('icon-192.png'));
await sharp(svg, { density: 300 }).resize(512, 512).png().toFile(out('icon-512.png'));
// Maskable and iOS icons are full-bleed squares; the platform applies its own corner shape.
await sharp(square, { density: 300 }).resize(512, 512).png().toFile(out('icon-maskable-512.png'));
await sharp(square, { density: 300 }).resize(180, 180).png().toFile(out('apple-touch-icon.png'));
console.log('icons written');
