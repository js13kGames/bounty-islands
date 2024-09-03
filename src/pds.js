import { PI2 } from './math';

export default (width, height, radius, k = 5, rng = Math.random, enable = () => true) => {
    const sector = PI2 / k;
    const cellSize = radius / Math.SQRT2;
    const radius2 = radius * radius;
    const gridWidth = Math.ceil(width / cellSize);
    const gridHeight = Math.ceil(height / cellSize);
    const grid = new Array(gridWidth * gridHeight);
    const queue = [];

    const check = (x, y) => {
        if (!enable(x, y)) {
            return false;
        }

        let cellX = (x / cellSize) | 0;
        let cellY = (y / cellSize) | 0;

        const left = Math.max(cellX - 2, 0);
        const top = Math.max(cellY - 2, 0);
        const right = Math.min(cellX + 3, gridWidth);
        const bottom = Math.min(cellY + 3, gridHeight);

        for (cellY = top; cellY < bottom; cellY++) {
            const offset = cellY * gridWidth;

            for (cellX = left; cellX < right; cellX++) {
                const cell = grid[offset + cellX];
                if (cell) {
                    const dx = cell[0] - x;
                    const dy = cell[1] - y;

                    if (dx * dx + dy * dy < radius2) {
                        return false;
                    }
                }
            }
        }

        return true;
    };

    const put = (x, y) => {
        const sample = [x, y];
        grid[~~(y / cellSize) * gridWidth + ~~(x / cellSize)] = sample;
        queue.push(sample);
        return sample;
    };

    let x = rng() * width;
    let y = rng() * height;

    while (!check(x, y)) {
        x = rng() * width;
        y = rng() * height;
    }

    const first = [put(x, y)];

    return () => {
        while (queue.length) {
            const i = (rng() * queue.length) | 0;
            const sample = queue[i];
            const phase = rng() * PI2;

            for (let j = 0; j < k; ++j) {
                const a = phase + j * sector;
                const r = (1 + rng() * 0.4) * radius;

                const x = sample[0] + r * Math.cos(a);
                const y = sample[1] + r * Math.sin(a);

                if (x >= 0 && x <= width && y >= 0 && y <= height && check(x, y)) {
                    return put(x, y);
                }
            }

            const last = queue.pop();
            sample !== last && (queue[i] = last);
        }

        return first.pop();
    };
};
