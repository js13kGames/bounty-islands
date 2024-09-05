import {
    minimapSize,
    uiPanelWidth,
    uiPanelHeight,
    uiAvatarRectSize,
    uiPadding,
    uiKeycapSize,
    hunterSize,
    baseSize,
} from './consts';
import { PI2, quint } from './math';
import { doubleFor } from './common';
import init from './noise';
import { Base, Hunter, Transform, Player } from './ecs/components';
import { createCanvas } from './common';
import { colorToHex } from './colors';

const context = () => {
    const size = 4;
    const [canvas, ctx] = createCanvas(size);
    const data = ctx.getImageData(0, 0, size, size);
    return [canvas, ctx, data];
};

const fill = (data, mask) => {
    const gradients = [0, 0x22, 0x55, 0x88, 0xbb, 255];

    mask.forEach((p, i) => {
        if (p > 0) {
            let offset = i * data.width;
            data.data[offset] = 255;
            data.data[++offset] = 255;
            data.data[++offset] = 255;
            data.data[++offset] = gradients[p];
        }
    });
};

const getMask = (mask) => {
    const [canvas, ctx, data] = context();
    fill(data, mask);
    ctx.putImageData(data, 0, 0);
    return canvas;
};

const empty = () => context()[0];

const corner = () => {
    // prettier-ignore
    const mask = [
		2,1,0,0,
		0,1,0,0,
		1,0,0,0,
		0,0,0,0
	];
    return getMask(mask);
};

const edge = () => {
    // prettier-ignore
    const mask = [
		3,2,0,0,
		5,2,1,0,
		5,3,1,0,
		4,2,1,0
	];
    return getMask(mask);
};

const inner = () => {
    // prettier-ignore
    const mask = [
		5,5,4,3,
		5,4,2,1,
		3,2,1,0,
		4,1,1,0
	];
    return getMask(mask);
};

export const shapes = [empty(), corner(), edge(), inner()];

const wood = (x, y, k, noise) =>
    (1 + Math.sin(x * 0.5 + Math.sqrt((x / k) ** 2 + (y / k) ** 2) + 8 * noise) / 8) / 2;

const drawPerlinNoiseRect = (ctx, k, tint, random, width, height, fn = wood) => {
    const noise = init(random);
    doubleFor(0, height, 0, width, (x, y) => {
        const c = fn(x, y, k, noise(x / k, y / k));
        const mask = 255;
        ctx.fillStyle = `rgb(${c * ((tint >> 16) & mask)}, ${c * ((tint >> 8) & mask)}, ${
            c * (tint & mask)
        })`;
        ctx.fillRect(x, y, 1, 1);
    });
};

export const getBackground = (random, size = 2000) => {
    const [canvas, ctx] = createCanvas(size);

    const fn = (x, y, k, n) => quint((1 + Math.sin(0.1 * x + 60 * n) / 2) / 2);

    drawPerlinNoiseRect(ctx, 200, 0xffffff, random, size, size, fn);

    return canvas;
};

export const getTileImg = (random, light = 25) => {
    const [canvas, ctx] = createCanvas(8);

    for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
            const color = ~~(random() * light + (255 - light));
            ctx.fillStyle = `rgb(${color}, ${color}, ${color})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    return canvas;
};

export const getPixelImg = (color) => {
    const [canvas, ctx] = createCanvas(1);

    if (color) {
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
    }

    return canvas;
};

export const getMinimapMask = () => {
    const [canvas, ctx] = createCanvas(minimapSize);

    ctx.beginPath();
    ctx.arc(minimapSize / 2, minimapSize / 2, minimapSize / 2 - 2, 0, PI2);
    ctx.closePath();
    ctx.fillStyle = `#ffffff`;
    ctx.fill();

    return canvas;
};

const draw = (ctx, color, lineWidth, strokeWidth) => {
    ctx.fillStyle = color;
    ctx.fill();

    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = `#4f3710`;
    ctx.stroke();

    ctx.lineWidth = strokeWidth ? lineWidth - strokeWidth : lineWidth / 3;
    ctx.strokeStyle = `#c49242`;
    ctx.stroke();
};

export const drawCircle = (ctx, color, size, lineWidth, strokeWidth) => {
    ctx.beginPath();
    ctx.arc(0, 0, size / 2 - lineWidth / 2, 0, PI2);
    ctx.closePath();

    draw(ctx, color, lineWidth, strokeWidth);
};

const drawRect = (ctx, color, width, height, radius, lineWidth) => {
    ctx.beginPath();
    ctx.roundRect(
        -width / 2 + lineWidth / 2,
        -height / 2 + lineWidth / 2,
        width - lineWidth,
        height - lineWidth,
        radius,
    );
    ctx.closePath();

    draw(ctx, color, lineWidth);
};

const drawDefaultVenicle = (ctx, color, size, lineWidth) => {
    const padding = lineWidth / 2;
    const halfSize = size / 2;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(-halfSize + padding, -halfSize * (3 / 4));
    ctx.lineTo(-halfSize / 4, -halfSize / 4);
    ctx.lineTo(halfSize - padding, 0);
    ctx.lineTo(-halfSize / 4, halfSize / 4);
    ctx.lineTo(-halfSize + padding, halfSize * (3 / 4));
    ctx.lineTo(-halfSize / 2, 0);
    ctx.closePath();

    draw(ctx, color, lineWidth);
};

const drawRepairer = (ctx, color, size, lineWidth) => {
    drawDefaultVenicle(ctx, color, size, lineWidth);
    const halfSize = size / 2;

    ctx.translate(-halfSize / 3, 0);
    drawCircle(ctx, color, halfSize, lineWidth);
};

const drawFighter = (ctx, color, size, lineWidth) => {
    drawDefaultVenicle(ctx, color, size, lineWidth);
    // const halfSize = size / 2;

    // ctx.translate(-halfSize / 3, 0);
    // drawTriangle(ctx, color, size * 0.65, lineWidth * 0.65);
};

const drawTriangle = (ctx, color, size, lineWidth) => {
    const padding = lineWidth / 2;
    const halfSize = size / 2;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(-halfSize + padding, -halfSize + padding);
    ctx.lineTo(halfSize - padding, 0);
    ctx.lineTo(-halfSize + padding, halfSize - padding);
    ctx.lineTo(-halfSize / 2, 0);
    ctx.closePath();

    draw(ctx, color, lineWidth);
};

export const getMinimapCover = (size) => {
    const [canvas, ctx] = createCanvas(size);

    ctx.translate(size / 2, size / 2);
    drawCircle(ctx, '#ffffff00', size, 10, 4);
    drawCircle(ctx, '#ffffff00', size / 8, 6);
    ctx.resetTransform();

    ctx.translate(size / 2, 25);
    ctx.rotate(PI2 / 4);
    drawTriangle(ctx, '#4f3710', 20, 6);

    return canvas;
};

export const getBigMinimap = (bigMinimap, size) => {
    const [canvas, ctx] = createCanvas(size);

    const halfSize = size / 2;
    ctx.arc(halfSize, halfSize, halfSize - 2, 0, PI2, true);
    ctx.clip();
    ctx.drawImage(bigMinimap, 0, 0);
    ctx.resetTransform();
    ctx.translate(halfSize, halfSize);
    drawCircle(ctx, '#ffffff00', size - 3, 6);
    drawCircle(ctx, '#ffffff00', size - 13, 6);
    drawCircle(ctx, '#ffffff00', size - 23, 6);

    return canvas;
};

export const getHunterImg = (i, color) => {
    const [canvas, ctx] = createCanvas(hunterSize);

    ctx.translate(hunterSize / 2, hunterSize / 2);

    const hunderProps = [drawTriangle, drawRepairer, drawFighter];

    hunderProps[i](ctx, colorToHex(color), hunterSize, 6);

    return canvas;
};

export const getBaseImg = (i, color) => {
    const baseColor = colorToHex(color);

    const size = baseSize;
    const k = 2 / 3;
    const circleSize = size / 1.7;
    const aSize = circleSize * k;
    const baseProps = [
        { f: (ctx) => drawRect(ctx, baseColor, aSize, aSize, 3, 6), c: 3, s: aSize * k },
        { f: (ctx) => drawCircle(ctx, baseColor, aSize, 6), c: 3, s: aSize * k },
        { f: (ctx) => drawDefaultVenicle(ctx, baseColor, aSize, 6), c: 3, s: aSize * k * 1.1 },
    ];
    const props = baseProps[i];

    const [canvas, ctx] = createCanvas(size);

    for (let angle = 0; angle < PI2; angle += PI2 / props.c) {
        ctx.translate(size / 2 + Math.cos(angle) * props.s, size / 2 + Math.sin(angle) * props.s);
        ctx.rotate(angle);
        props.f(ctx);
        ctx.resetTransform();
    }

    ctx.translate(size / 2, size / 2);
    drawCircle(ctx, baseColor, circleSize, 6);

    return canvas;
};

export const getSelectImg = (size) => {
    const [canvas, ctx] = createCanvas(size);
    const padding = size / 6;

    ctx.rect(3, 3, size - 6, size - 6);

    ctx.lineWidth = 3.5;
    ctx.strokeStyle = `#000`;
    ctx.stroke();

    ctx.lineWidth = 3;
    ctx.strokeStyle = `#fff`;
    ctx.stroke();

    ctx.clearRect(padding, 0, size - padding * 2, size);
    ctx.clearRect(0, padding, size, size - padding * 2);

    return canvas;
};

export const getHealImg = (size) => {
    const [canvas, ctx] = createCanvas(size);
    const lineHalfWidth = size / 6;
    const halfSize = size / 2;

    ctx.moveTo(halfSize, lineHalfWidth);
    ctx.lineTo(halfSize, size - lineHalfWidth);

    ctx.moveTo(lineHalfWidth, halfSize);
    ctx.lineTo(size - lineHalfWidth, halfSize);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.lineWidth = lineHalfWidth * 2;
    // ctx.strokeStyle = `#124a0d`;
    ctx.strokeStyle = `#fff`;
    // ctx.strokeStyle = `#21bd13`;
    ctx.stroke();

    ctx.lineWidth = lineHalfWidth;
    ctx.strokeStyle = `#124a0d`;
    // ctx.strokeStyle = `#ff0000`;
    ctx.stroke();

    return canvas;
};

export const getBountyImg = (i) => {
    const size = 24 + i * 1.1;
    const halfSize = size / 2;
    const lineWidth = 4;
    const [canvas, ctx] = createCanvas(size);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // ctx.lineWidth = lineWidth;
    // ctx.fillStyle = '#' + levels[i].c;
    // ctx.strokeStyle = '#999999';

    ctx.moveTo(halfSize, halfSize);
    for (let angle = 0; angle < Math.PI * 2; angle += PI2 / 5) {
        ctx.lineTo(
            halfSize + Math.cos(angle) * (halfSize - lineWidth),
            halfSize + Math.sin(angle) * (halfSize - lineWidth),
        );
    }
    ctx.lineTo(halfSize, halfSize);

    draw(ctx, '#fff', lineWidth);

    return canvas;
};

export const getBulletImg = () => {
    const width = 12;
    const height = 8;
    const [canvas, ctx] = createCanvas(width, height);

    ctx.translate(width / 2, height / 2);
    drawRect(ctx, '#fff', width, height, 4, 2);

    return canvas;
};

export const getParticleImg = (size) => {
    const [canvas, ctx] = createCanvas(size);

    for (let i = 0.2; i <= 1; i += 0.2) {
        ctx.fillStyle = `rgba(255,255,255,${i})`;
        // ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2 - (i * size) / 3, 0, PI2);
        // ctx.closePath();
        ctx.fill();
    }

    return canvas;
};

export const getPatternImg = (width, height) => {
    const [canvas, ctx] = createCanvas(width, height);
    drawPerlinNoiseRect(ctx, 40, 0xc49242, Math.random, width, height);
    return canvas;
};

const patternImg = getPatternImg(uiPanelWidth, uiPanelHeight);

const drawText = (ctx, text, size, bold, center, fill, x = 0, y = 0, stroke) => {
    ctx.font = `${bold ? 'bold ' : ''}${size}px sans-serif`;

    ctx.textAlign = center ? 'center' : 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
    stroke && ctx.strokeText(text, x, y);
};

export const drawKeycap = (ctx, pressed, key, text) => {
    const size = uiKeycapSize;
    const offset = size / 5;

    ctx.save();

    // ctx.save();
    // ctx.translate(150 + uiPadding, 0);
    const hintWidth = 200;
    const hintTranslate = hintWidth / 2 + size / 2 + uiPadding * 3;
    ctx.translate(hintTranslate, 0);
    drawRect(ctx, '#baa88abb', hintWidth, size * 0.8, 5, 2);

    drawText(ctx, text, 16, false, true, '#362414', 0, 2);
    ctx.translate(-hintTranslate, 0);

    // ctx.restore();

    drawRect(ctx, '#baa88a', size, size, 10, 2);

    ctx.translate(0, ((pressed ? 1 : -1) * offset) / 6);
    // ctx.translate(0, -offset / 2);
    drawRect(ctx, '#e6d6be', size - offset, size - offset, 8, 1);

    ctx.lineWidth = 0.5;
    ctx.strokeStyle = '#4f3710';
    drawText(ctx, key, 25, true, true, '#baa88a', 0, 2, true);

    ctx.restore();
};

export const getStartInterface = (width, height, keys, finished, win, triskaidekaphobia) => {
    const [canvas, ctx] = createCanvas(width * 3, height);

    ctx.translate(width / 2, height / 2);

    const pattern = ctx.createPattern(patternImg, null);
    const matrix = new DOMMatrix();
    pattern.setTransform(matrix.translate(width / 2, height / 2));
    drawRect(ctx, pattern, width, height, 10, 6);
    const padding = height / 5;
    drawRect(ctx, '#baa88a99', width - padding, height - padding, 10, 3);

    const buttonOffset = 47;

    ctx.translate(-width / 5, -buttonOffset * 1.5);

    if (!finished) {
        drawKeycap(ctx, keys[83], 'S', `Start game`);

        ctx.translate(0, buttonOffset);
        drawKeycap(ctx, keys[67], 'C', `Change island`);

        ctx.translate(0, buttonOffset);
        drawKeycap(ctx, keys[70], 'F', document.fullscreenElement ? 'Window mode' : 'Full screen');

        ctx.translate(0, buttonOffset);
        drawKeycap(ctx, keys[84], 'T', triskaidekaphobia);
    } else {
        ctx.translate(0, buttonOffset * 1.5);
        drawKeycap(ctx, false, 'F5', `Restart game`);
        ctx.translate(width / 13, -buttonOffset);
        drawText(ctx, `The island is ${win ? 'captured' : 'lost'}!`, 25, true, false, '#362414');
    }

    return canvas;
};

export const getGameTitle = (text, color = '#c49242', big, size = 400) => {
    const [canvas, ctx] = createCanvas(size, size);

    ctx.translate(size / 2, size / 2);

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#4f3710';
    ctx.shadowColor = '#baa88a';
    ctx.shadowBlur = 20;
    drawText(ctx, text, big ? size : 80, true, true, color, 0, big ? 40 : 0, true);

    // ctx.lineWidth = 2;
    // ctx.strokeStyle = '#c49242';
    // drawText(ctx, text, 80, true, false, '#c49242', 0, 0, true);

    return canvas;
};

export const getInterface = (controller, entity, name, sprite, info = [], bind) => {
    const [canvas, ctx] = createCanvas(uiPanelWidth * 2, uiPanelHeight);

    if (!name) {
        return [canvas];
    }

    ctx.translate(uiPanelWidth / 2, uiPanelHeight / 2);

    const pattern = ctx.createPattern(patternImg, null);
    const matrix = new DOMMatrix();
    pattern.setTransform(matrix.translate(uiPanelWidth / 2, uiPanelHeight / 2));
    drawRect(ctx, pattern, uiPanelWidth, uiPanelHeight, 10, 6);
    ctx.resetTransform();

    if (name) {
        ctx.translate(uiAvatarRectSize / 2 + uiPadding, uiAvatarRectSize / 2 + uiPadding);
        drawRect(ctx, '#baa88a', uiAvatarRectSize, uiAvatarRectSize, 10, 3);

        if (bind !== -1) {
            drawText(ctx, bind, 25, true, true, '#baa88a', 0, uiAvatarRectSize * 0.8, true);
        }
        ctx.resetTransform();

        ctx.translate(uiPanelWidth / 2 + uiAvatarRectSize / 2 + uiPadding / 2, uiPanelHeight / 2);
        drawRect(
            ctx,
            '#baa88a99',
            uiPanelWidth - uiAvatarRectSize - uiPadding * 3,
            uiPanelHeight - uiPadding * 2,
            10,
            3,
        );

        ctx.resetTransform();
    }

    let offetX = uiAvatarRectSize + uiPadding * 3;
    let offetY = uiPadding * 2 + 25 / 2;

    if (name) {
        drawText(ctx, name, 25, true, false, '#362414', offetX, offetY);
        offetY += 30;
    }

    const baseOffsetY = offetY;

    let maxTextWidth = 0;
    info.forEach((text, i) => {
        if (i && i % 8 === 0) {
            offetX += uiPadding + maxTextWidth;
            maxTextWidth = 0;
            offetY = baseOffsetY;
        }

        maxTextWidth = Math.max(maxTextWidth, ctx.measureText(text).width);

        drawText(ctx, text, 18, false, false, '#362414', offetX, offetY);
        offetY += 20;
    });

    if (entity.get(Player)) {
        const [base, hunter, transform] = entity.get(Base, Hunter, Transform);

        if (base || hunter) {
            ctx.translate(450, uiPadding * 2 + uiKeycapSize / 2);
            drawKeycap(ctx, controller._keys[66], 'B', 'Back to home');
        }

        if (base && !transform) {
            const buttonOffset = ~~(uiPadding / 4) + uiKeycapSize;

            ctx.translate(0, buttonOffset);
            drawKeycap(
                ctx,
                controller._keys[76],
                'L',
                `+1 to limit (${base._upgradePrice(2)} gold)`,
            );

            ctx.translate(0, buttonOffset);
            drawKeycap(
                ctx,
                controller._keys[77],
                'M',
                `+1 to mine (${base._upgradePrice(0)} gold)`,
            );

            ctx.translate(0, buttonOffset);
            drawKeycap(
                ctx,
                controller._keys[72],
                'H',
                `+1 to heal (${base._upgradePrice(1)} gold)`,
            );
        }
    }

    return [canvas, sprite];
};
