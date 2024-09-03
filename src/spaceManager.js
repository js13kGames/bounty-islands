import { realMapSize, tileSize } from './consts';
import { clamp, doubleFor, getArray } from './common';
import { Position } from './ecs/components';

export default class SpaceManager {
    constructor() {
        const cellSize = tileSize * 8;
        const size = Math.ceil(realMapSize / cellSize);
        const space = getArray(size * size).map(() => new Set());

        const getCellCoords = (x, y) => {
            const cx = clamp(0, size - 1, ~~(x / cellSize));
            const cy = clamp(0, size - 1, ~~(y / cellSize));
            return [cx, cy];
        };

        const getCell = (x, y) => {
            const [cx, cy] = getCellCoords(x, y);
            return space[cx + cy * size];
        };

        this.get = (point, radius, iterator) => {
            const { x, y } = point;
            const [left, top] = getCellCoords(x - radius, y - radius);
            const [right, bottom] = getCellCoords(x + radius, y + radius);

            // for (let cx = left; cx <= right; cx++) {
            //     for (let cy = top; cy <= bottom; cy++) {
            //         const cell = space[cx + cy * size];

            //         cell.forEach((entity) => {
            //             const position = entity.get(Position);
            //             position &&
            //                 position.distanceSq(point) < radius * radius &&
            //                 iterator(entity);
            //         });
            //     }
            // }
            doubleFor(top, bottom + 1, left, right + 1, (cx, cy) => {
                const cell = space[cx + cy * size];

                cell.forEach((entity) => {
                    const position = entity.get(Position);
                    position && position.distanceSq(point) < radius * radius && iterator(entity);
                });
            });
        };

        this.update = (entity, [{ x, y }, collider]) => {
            const cell = getCell(x, y);

            cell.add(entity);

            const colliderCell = collider._cell;
            collider._cell = cell;

            colliderCell && colliderCell !== cell && colliderCell.delete(entity);
        };
    }
}
