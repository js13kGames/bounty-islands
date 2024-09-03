import init from './noise';
import { lerp, quintic } from './math';
import { doubleFor, levels } from './common';
import { createCanvas } from './common';

export default (mapSize, random, skipNeighbours) => {
    const mapHalfSize = mapSize / 2;
    const maxDistance = mapHalfSize * mapHalfSize * Math.SQRT2;
    const k = mapSize / 4;

    const map = new Array(mapSize * mapSize);
    const [minimap, ctx] = createCanvas(mapSize);

    const noise = init(random);

    let min = 9;
    doubleFor(0, mapSize, 0, mapSize, (x, y) => {
        const nx = x / k;
        const ny = y / k;
        const _elevation = noise(nx, ny, 6);

        min = Math.min(min, _elevation);

        const dx = x - mapHalfSize;
        const dy = y - mapHalfSize;

        const _distance = (dx * dx + dy * dy) / maxDistance;

        map[x + y * mapSize] = {
            _elevation,
            _distance,
            x,
            y,
            _neighbours: [],
        };
    });

    let max = 0;
    map.forEach((cell) => {
        cell._elevation = lerp(cell._elevation - min, 0, quintic(cell._distance));
        max = Math.max(max, cell._elevation);
    });

    map.forEach((cell) => {
        const elevation = (cell._elevation /= max);

        for (let i = 0; i < levels.length; i++) {
            const top = (levels[i + 1] && levels[i + 1].s) || 1;
            if (elevation <= top) {
                const bottom = levels[i].s;
                const range = top - bottom;
                const diffusion = range * levels[i].d;
                const height = elevation - bottom;

                cell.level = i - (height < diffusion && random() > height / diffusion && i > 0);
                break;
            }
        }

        ctx.fillStyle = `#${levels[cell.level].c}`;
        ctx.fillRect(cell.x, cell.y, 1, 1);
    });

    !skipNeighbours &&
        map.forEach((cell) => {
            const { x, y } = cell;

            for (let level = cell.level + 1; level < levels.length; level++) {
                let mask = 0;
                let bit = 1;

                for (let cy = y - 1; cy <= y + 1; cy++) {
                    for (let cx = x - 1; cx <= x + 1; cx++) {
                        if (cx !== x || cy !== y) {
                            if (
                                cx >= 0 &&
                                cy >= 0 &&
                                cx < mapSize &&
                                cy < mapSize &&
                                map[cx + cy * mapSize].level === level
                            ) {
                                mask |= bit;
                            }
                            bit <<= 1;
                        }
                    }
                }

                mask && (cell._neighbours[level] = mask);
            }
        });

    return [map, minimap];
};
