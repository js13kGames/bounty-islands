const mask = 255;

export const colorToHex = (color) => '#' + color.toString(16).padStart(6, '0');

export const bytesToColor = (r, g, b) => (r << 16) | (g << 8) | b;
export const colorToBytes = (color) => [color >> 16, (color >> 8) & mask, color & mask];

export const hexToColor = (hex) =>
    bytesToColor(
        parseInt(hex.substring(0, 2), 16),
        parseInt(hex.substring(2, 4), 16),
        parseInt(hex.substring(4, 6), 16),
    );

export const hslToColor = (h, s, l) => {
    s /= 100;
    l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => mask * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))));

    return bytesToColor(f(0), f(8), f(4));
};
