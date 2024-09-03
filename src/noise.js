import { lerp, quintic } from './math';
import { getArray } from './common';

const size = 12;
const length = 1 << size;
const mask = length - 1;
const wrap = 1 << ~~(size / 2);

const gradients = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
];

const dot = (g, x, y) => g[0] * x + g[1] * y;

export default (rnd) => {
    const table = getArray(length).map(() => gradients[(rnd() * 4) | 0]);

    const perlin = (x, y, fade) => {
        let X = Math.floor(x);
        let Y = Math.floor(y);
        const offset = X + Y * wrap;

        x -= X;
        y -= Y;

        const u = fade(x);

        return lerp(
            lerp(dot(table[offset & mask], x, y), dot(table[(offset + 1) & mask], x - 1, y), u),
            lerp(
                dot(table[(offset + wrap) & mask], x, y - 1),
                dot(table[(offset + wrap + 1) & mask], x - 1, y - 1),
                u,
            ),
            fade(y),
        );
    };

    return (x, y, octaves, persistence, fade) => {
        let noise = 0;
        let amplitude = 1;
        for (let octave = 0; octave < (octaves || 4); octave++) {
            const frequency = 1 << octave;
            noise += perlin(x * frequency, y * frequency, fade || quintic) * amplitude;
            amplitude *= persistence || 0.5;
        }
        return noise;
    };
};
