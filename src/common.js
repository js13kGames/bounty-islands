import Vector from './vector';
import { colorToBytes, bytesToColor } from './colors';
import { PI2 } from './math';

/*
const x0 = 1;
const y0 = 0;
const cos = Math.cos(angle);
const sin = Math.sin(angle);
const x = x0 * cos - y0 * sin;
const y = x0 * sin + y0 * cos;
return new Vector(x, y);
*/
export const vecFromAngle = (angle) => new Vector(Math.cos(angle), Math.sin(angle));

export const signRandom = (scale = 1) => (Math.random() - 0.5) * scale;

export const pi2random = () => Math.random() * PI2;

export const colorGradient = (startColor, endColor, stage) => {
    const start = colorToBytes(startColor);
    const end = colorToBytes(endColor);

    return bytesToColor(...end.map((e, i) => e * stage + start[i] * (1 - stage)));
};

export const clamp = (a, b, c) => {
    if (c < a) {
        return a;
    }

    if (c > b) {
        return b;
    }

    return c;
};

export const getArray = (length) => Array.from({ length });

export const levels = [
    { s: 0, d: 0, c: '1a4ea3' },
    { s: 0.15, d: 1.2, c: '1657ad', r: 1 },
    { s: 0.28, d: 2, c: '176ad8', r: 7, l: 40 },
    { s: 0.34, d: 1, c: '309eb2', r: 13, l: 30 },
    { s: 0.4, d: 0.1, c: 'd3cd6e', r: 15, l: 20 }, // beach
    { s: 0.42, d: 0.7, c: '97c621', r: 10 },
    { s: 0.45, d: 1.5, c: '649e17', r: 16 },
    { s: 0.49, d: 1.2, c: '397c12', r: 30, l: 30 },
    { s: 0.56, d: 1.2, c: '2d5b12', r: 8, l: 50 },
    { s: 0.7, d: 1.2, c: '80663c', r: 5, l: 50 },
    { s: 0.85, d: 0.5, c: 'b28a49', r: 9, l: 60 },
    { s: 0.86, d: 1, c: 'baa27b', r: 19, l: 60 },
    { s: 0.92, d: 0.5, c: 'cccccc', l: 60 },
    { s: 0.94, d: 0.5, c: 'ffffff', r: 32, l: 20 },
];

export const typeNames = ['Miner', 'Repairer', 'Fighter'];

export const doubleFor = (y0, y1, x0, x1, fn) => {
    for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
            fn(x, y);
        }
    }
};

export const createCanvas = (width, height) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height || width;
    const ctx = canvas.getContext('2d');

    return [canvas, ctx];
};
