// https://github.com/lifthrasiir/roadroller

import Renderer from './renderer';
import seedrandom from './seedrandom';
import pds from './pds';
import generateMap from './map';
import Controller from './controller';
import getNameGenerator from './names';
import Vector from './vector';

import {
    Position,
    Velocity,
    Sprite,
    Bounty,
    Hunter,
    Transform,
    Base,
    Collider,
    Attractor,
    Selector,
    Name,
    Gun,
    Bullet,
    RepairKit,
    Fraction,
    Exhaust,
    Player,
    Miner,
} from './ecs/components';

import {
    Movement,
    HunterTargetingSystem,
    Spawner,
    ExhaustProcessor,
    Transformer,
    SpaceUpdater,
    AttractorProcessor,
    SelectUpdater,
    GunProcessor,
    BulletProcessor,
    RepairKitProcessor,
    HunterMovementProcessor,
    HunterTargetIntersectionProcessor,
    MineProcessor,
    BaseProcessor,
    BaseAIProcessor,
    getAlphaTransform,
} from './ecs/systems';

import ecs from './ecs/ecs';

import {
    mapSize,
    realMapSize,
    tileSize,
    minimapSize,
    extMinimapSize,
    radius,
    realRadius,
    uiPanelHeight,
    uiAvatarRectSize,
    uiPadding,
    uiMargin,
    hunterSize,
    baseSize,
} from './consts';

import { hunterCost, startBaseMineValue, startBaseHealValue } from './mechanics';

import { PI2 } from './math';

import { clamp, getArray, levels, doubleFor, createCanvas, pi2random } from './common';

import SpaceManager from './spaceManager';

import { hexToColor, hslToColor } from './colors';

import {
    shapes,
    getTileImg,
    getPixelImg,
    getMinimapMask,
    getMinimapCover,
    getBaseImg,
    getSelectImg,
    getBountyImg,
    getHunterImg,
    getParticleImg,
    getInterface,
    getBulletImg,
    getHealImg,
    getBigMinimap,
    getStartInterface,
    getGameTitle,
    getBackground,
} from './shapes';

const view = document.getElementById('view');
const loading = document.getElementById('l');
view.style.background = '#000';

document.addEventListener('DOMContentLoaded', () => {
    ecs.register(
        Position,
        Velocity,
        Sprite,
        Bounty,
        Hunter,
        Transform,
        Base,
        Collider,
        Attractor,
        Selector,
        Name,
        Gun,
        Bullet,
        RepairKit,
        Fraction,
        Exhaust,
        Player,
        Miner,
    );

    Renderer.anchor = new Vector(0.5);

    const controller = new Controller(view);
    const scene = Renderer(view);
    const { camera } = scene;

    const atlas = scene.atlas(0.5, false, false, 1024);
    const smoothAtlas = scene.atlas(0, true);

    const bountyFrames = levels.map((_, i) => smoothAtlas.frame(getBountyImg(i)));
    const selectorFrame = smoothAtlas.frame(getSelectImg(hunterSize * 1.3));
    const selectorBaseFrame = smoothAtlas.frame(getSelectImg(baseSize * 1.3));
    const minimapMask = atlas.frame(getMinimapMask());
    const minimapCoverFrame = smoothAtlas.frame(getMinimapCover(minimapSize));

    const particleFrame = atlas.frame(getParticleImg(8));
    const bulletFrame = smoothAtlas.frame(getBulletImg());
    const healFrame = smoothAtlas.frame(getHealImg(20));
    const damageFrame = smoothAtlas.frame(getParticleImg(8));

    const interfaceFrame = smoothAtlas.frame(getInterface()[0]);
    const avatarFrame = smoothAtlas.frame(getPixelImg());

    const overlayFrame = smoothAtlas.frame(getPixelImg('#000'));
    overlayFrame.size.set(9999);

    const mapRadius = realMapSize / 2;
    const mapCenter = new Vector(mapRadius, mapRadius);

    const groundLayer = scene.layer(21);
    const particleLayer = scene.layer(22);
    const hunterLayer = scene.layer(23);
    const bulletLayer = scene.layer(24);
    const selectLayer = groundLayer;

    const uiInterfaceLayer = scene.ui(25);
    const uiAvatarLayer = scene.ui(26);
    const uiMapLayer = scene.ui(27);
    const uiMapCoverLayer = scene.ui(28);
    const overlayLayer = scene.ui(29);
    const menuLayer = scene.ui(30);

    let started = false;
    let win = false;
    let finished = false;

    let seed = +(location.hash || '#').substring(1) || 253667892;

    let random = seedrandom(seed);
    view.style.background = `center / cover url(${getBackground(seedrandom(seed)).toDataURL(
        'image/jpeg',
    )})`;
    loading.remove();

    const changeRandomSeed = () => {
        seed = Math.floor(Math.random() * 4294967296);
        random = seedrandom(seed);
    };

    const bigMinimapSize = mapSize * 4;

    const generateBigMap = () => {
        const [_, bigMinimap] = generateMap(bigMinimapSize, random, true);

        const bm = getBigMinimap(bigMinimap, bigMinimapSize);

        return bm;
    };

    const interfaceSpritePosition = new Vector();
    const startInterfaceFrame = smoothAtlas.frame(
        getStartInterface(500, 200, controller._keys),
        true,
    );
    const startInterfaceSprite = new Sprite(startInterfaceFrame, {
        position: interfaceSpritePosition,
        anchor: new Vector(0, 0.5),
    });

    const bigMinimapPosition = new Vector();
    const bigMinimapFrame = smoothAtlas.frame(generateBigMap(), true);
    const bigMinimapSprite = new Sprite(bigMinimapFrame, {
        position: bigMinimapPosition,
    });

    const gameTitleBountySpritePosition = new Vector();
    const gameTitleBountyFrame = smoothAtlas.frame(getGameTitle('Bounty'));
    const gameTitleBountySprite = new Sprite(gameTitleBountyFrame, {
        position: gameTitleBountySpritePosition,
        anchor: new Vector(0, 0.5),
    });

    const gameTitleIslandsSpritePosition = new Vector();
    const gameTitleIslandsFrame = smoothAtlas.frame(getGameTitle('Islands'));
    const gameTitleIslandsSprite = new Sprite(gameTitleIslandsFrame, {
        position: gameTitleIslandsSpritePosition,
        anchor: new Vector(0, 0.5),
    });

    const menuSprites = [
        startInterfaceSprite,
        bigMinimapSprite,
        gameTitleBountySprite,
        gameTitleIslandsSprite,
    ];

    menuLayer.add(
        startInterfaceSprite,
        bigMinimapSprite,
        gameTitleBountySprite,
        gameTitleIslandsSprite,
    );

    const resizeMenu = () => {
        bigMinimapPosition.set(scene.width / 2 - bigMinimapSize / 3, scene.height / 2);
        interfaceSpritePosition
            .from(bigMinimapPosition)
            .add(new Vector(bigMinimapSize / 2 - 100, 0));
        gameTitleBountySpritePosition
            .from(bigMinimapPosition)
            .add(new Vector(bigMinimapSize / 2 - 20, -170));
        gameTitleIslandsSpritePosition
            .from(bigMinimapPosition)
            .add(new Vector(bigMinimapSize / 2 - 20, 170));

        startInterfaceFrame.redraw(getStartInterface(500, 200, controller._keys, finished, win));
        bigMinimapSprite.rotation += 0.001;

        if (!started) {
            scene.render();
            requestAnimationFrame(resizeMenu);
        }
    };

    requestAnimationFrame(resizeMenu);

    const requestFullscreen = () => {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            view.requestFullscreen();
        }
    };

    controller._callbacks._onKeyUp = (keyCode) => {
        if (keyCode === 83) {
            menuSprites.forEach((s) => {
                s.visible = false;
            });

            started = true;
            init();
        }

        if (keyCode === 67) {
            changeRandomSeed();
            bigMinimapFrame.redraw(generateBigMap());
            location.hash = seed;
        }

        if (keyCode === 70) {
            requestFullscreen();
        }
    };

    const init = () => {
        view.style.background = '#1a4ea3';
        random = seedrandom(seed);
        const [map, minimap] = generateMap(mapSize, random);

        const enable = (x, y) => {
            return map[(x | 0) + (y | 0) * mapSize].level > 4;
        };

        let basesPoints = [];
        let playerIndex = 0;

        while (basesPoints.length < 10) {
            basesPoints = [];
            const generator = pds(mapSize, mapSize, radius, 20, random, enable);

            let playerDistance = 0;
            let bi = 0;

            let basePoint;
            while ((basePoint = generator())) {
                const position = new Position(
                    basePoint[0] * tileSize,
                    basePoint[1] * tileSize,
                    random() * PI2,
                );

                const distance = position.distanceSq(mapCenter);

                if (distance > playerDistance) {
                    playerIndex = bi;
                    playerDistance = distance;
                }

                basesPoints.push(position);
                bi++;
            }
        }

        let antagonistIndex = 0;
        let antagonistDistance = 0;
        basesPoints.forEach((position, i) => {
            const distance = position.distanceSq(basesPoints[playerIndex]);
            if (distance > antagonistDistance) {
                antagonistIndex = i;
                antagonistDistance = distance;
            }
        });

        const playerColor = 0x474747;
        const colorsCount = basesPoints.length;
        const colorPallete = ~~(colorsCount / 3) + 1;
        const colorDelta = 360 / colorPallete;

        const lights = [70, 55, 40];
        const saturations = [100, 80, 60];
        const getColor = (i) => {
            if (i === playerIndex) {
                return playerColor;
            }

            const light = ~~(i / colorPallete);
            const color = i % colorPallete;
            return hslToColor(
                color * colorDelta + (light * colorDelta) / 3,
                saturations[light],
                lights[light],
            );
        };

        const hunterColoredFrames = getArray(3).map((_, i) =>
            getArray(colorsCount).map((_, c) => smoothAtlas.frame(getHunterImg(i, getColor(c)))),
        );

        const baseColoredFrames = getArray(3).map((_, i) =>
            getArray(colorsCount).map((_, c) => smoothAtlas.frame(getBaseImg(i, getColor(c)))),
        );

        const generator = pds(realMapSize, realMapSize, tileSize * 2, 10, random);
        let spawnPoints = [];
        let spawn;
        while ((spawn = generator())) {
            spawnPoints.push(spawn);
        }

        const spawns = spawnPoints.map((p) => new Position(p[0], p[1], pi2random()));

        const fractions = [];

        const nameGenetator = getNameGenerator(random);
        const bases = basesPoints.map((position, i) => {
            const type = i === antagonistIndex ? 0 : ~~(random() * 3);

            const sprite = new Sprite(baseColoredFrames[type][i], { position });
            groundLayer.add(sprite);

            const fraction = {
                _color: getColor(i),
                _index: i,
                _gold: hunterCost,
                _isPlayer: i === playerIndex,
                _antagonist: i === antagonistIndex,
            };
            fractions.push(fraction);

            const spawnMaxRadius = realRadius / 2;
            const spawnMinRadius = tileSize * 3;
            const baseSpawns = spawns
                .map((p, i) => {
                    const distance = p.distanceSq(position);
                    return distance < spawnMaxRadius * spawnMaxRadius &&
                        distance > spawnMinRadius * spawnMinRadius
                        ? i
                        : 0;
                })
                .filter(Boolean);

            const base = new Base(type, baseSpawns, i === antagonistIndex);

            const entity = ecs
                .create()
                .add(
                    base,
                    sprite,
                    position,
                    new RepairKit(realRadius / 2, 1, startBaseHealValue, true),
                    new Miner(startBaseMineValue, 1),
                    new Fraction(fraction),
                    new Name(i === antagonistIndex ? 'Triskaidekaphobia' : nameGenetator()),
                    new Collider(),
                    i === playerIndex && new Selector(),
                    i === playerIndex && new Player(),
                );
            base._destination = entity;

            i === playerIndex && (playerBasePosition = position);

            return entity;
        });

        const playerSelector = ecs.select(Player);
        const huntersSelector = ecs.select(Hunter);
        const baseSelector = ecs.select(Base);

        const ctx = minimap.getContext('2d');
        bases.forEach((entity) => {
            const base = entity.get(Base);
            const position = entity.get(Position);

            base._neighbours = bases
                .filter(
                    (b) =>
                        b !== entity &&
                        b.get(Position).distanceSq(position) < (realRadius * 2) ** 2,
                )
                .sort(
                    (a, b) =>
                        a.get(Position).distanceSq(position) - b.get(Position).distanceSq(position),
                );

            ctx.fillStyle = `#4f3710`;
            ctx.fillRect(~~(position.x / tileSize - 1), ~~(position.y / tileSize - 1), 3, 3);
            ctx.fillStyle = `#ffffff`;
            ctx.fillRect(~~(position.x / tileSize), ~~(position.y / tileSize), 1, 1);
        });

        const [extMinimap, mctx] = createCanvas(extMinimapSize);
        mctx.rect(0, 0, extMinimapSize, extMinimapSize);
        mctx.fillStyle = `#${levels[0].c}`;
        mctx.fill();
        mctx.drawImage(
            minimap,
            extMinimapSize / 2 - minimapSize / 2,
            extMinimapSize / 2 - minimapSize / 2,
        );

        const minimapFrame = atlas.frame(extMinimap, true);

        const mapSprite = new Sprite(minimapFrame, {
            mask: minimapMask,
            scale: new Vector(0.94),
        });
        uiMapLayer.add(mapSprite);

        const mapCoverSprite = new Sprite(minimapCoverFrame);
        uiMapCoverLayer.add(mapCoverSprite);

        const interfaceSprite = new Sprite(interfaceFrame, {
            anchor: new Vector(0, 1),
        });
        uiInterfaceLayer.add(interfaceSprite);

        const avatarSprite = new Sprite(avatarFrame, {
            rotation: -PI2 / 8,
        });
        uiAvatarLayer.add(avatarSprite);

        /*
            0 |-----------| 1
              | 0 | 1 | 2 |
              | 3 |   | 4 |
              | 5 | 6 | 7 |
            3 |-----------| 2
        */

        const corners = [
            [3, 0, 1],
            [1, 2, 4],
            [4, 7, 6],
            [6, 5, 3],
        ];

        const calcMask = (mask) => {
            const submask = (corner) => {
                const cornerMask =
                    !!(mask & (1 << corners[corner][0])) |
                    (!!(mask & (1 << corners[corner][1])) << 1) |
                    (!!(mask & (1 << corners[corner][2])) << 2);

                if (!cornerMask) {
                    return `00`;
                }

                if (cornerMask === 2) {
                    return `1${corner}`;
                }

                if ((cornerMask & 5) === 5) {
                    return `3${corner}`;
                }

                if (cornerMask & 1) {
                    return `2${corner}`;
                }

                return `2${(corner + 1) % 4}`;
            };

            return submask(0) + submask(1) + submask(2) + submask(3);
        };

        const drawMask = (mask) => {
            const [canvas, ctx] = createCanvas(8);

            const x = [0, 4, 4, 0];
            const y = [0, 0, 4, 4];

            for (let i = 0; i < 4; i++) {
                const shape = shapes[+mask.charAt(i * 2)];
                const hw = shape.width / 2;
                const hh = shape.height / 2;

                ctx.save();
                ctx.translate(x[i] + hw, y[i] + hh);
                ctx.rotate(+mask.charAt(i * 2 + 1) * (Math.PI / 2));
                ctx.drawImage(shape, -hw, -hh);
                ctx.restore();
            }

            return canvas;
        };

        const framesTable = getArray(255).map((_, i) => {
            const mask = calcMask(i);
            const frame = atlas.frame(drawMask(mask), true);
            frame.size.set(tileSize);
            return frame;
        });

        const textures = levels.map((l, i) => {
            const frame = atlas.frame(
                getTileImg(i === 0 ? () => 1 : seedrandom(l.r || i), l.l),
                true,
            );
            frame.size.set(tileSize);
            return frame;
        });

        map.forEach((cell) => {
            const { x, y, level } = cell;

            const sprite = new Sprite(textures[level], {
                position: new Vector(x * tileSize, y * tileSize),
                tint: hexToColor(levels[level].c),
            });

            const tile = {
                _base: sprite,
                _neighbours: [],
            };

            cell._neighbours.forEach((mask, level) => {
                const sprite = new Sprite(textures[level], {
                    position: new Vector(x * tileSize, y * tileSize),
                    tint: hexToColor(levels[level].c),
                    mask: framesTable[mask],
                });
                tile._neighbours[level] = sprite;
            });

            cell.tile = tile;
        });

        const uiUpdater = (entity, name, sprite, info) => {
            interfaceFrame.redraw(getInterface(controller, entity, name, sprite, info)[0]);
            const frame = sprite?.frame || avatarFrame;
            // const scale = frame.size.x > uiAvatarRectSize ? (uiAvatarRectSize * 0.8) / frame.size.x : 1;
            const scale = frame.size.x > 40 ? 0.5 : 1;

            avatarSprite.frame = frame;
            avatarSprite.scale.set(scale);
        };

        ecs.process(
            new Movement(ecs),
            new Transformer(ecs),
            new BaseProcessor(ecs, baseColoredFrames),
            new Spawner(
                ecs,
                bountyFrames,
                groundLayer,
                levels,
                map,
                hunterColoredFrames,
                hunterLayer,
            ),
            new BaseAIProcessor(ecs),
            new HunterTargetIntersectionProcessor(ecs),
            new HunterTargetingSystem(ecs),
            new HunterMovementProcessor(ecs),
            new ExhaustProcessor(ecs, particleFrame, particleLayer),
            new GunProcessor(ecs, bulletFrame, bulletLayer),
            new BulletProcessor(ecs, damageFrame, particleLayer),
            new RepairKitProcessor(ecs, healFrame, bulletLayer),
            new AttractorProcessor(ecs),
            new MineProcessor(ecs),
            new SpaceUpdater(ecs),
            new SelectUpdater(ecs, selectLayer, selectorFrame, selectorBaseFrame, uiUpdater),
        );

        ecs.sm = new SpaceManager();
        ecs._spawns = spawns;
        ecs._fractions = fractions;

        camera.at.from(basesPoints[playerIndex]);

        camera.to.set(0.5);

        const speed = 3000;
        let direction =
            -PI2 / 4 - new Vector().from(mapCenter).sub(basesPoints[playerIndex]).angle();

        const selectSelector = ecs.select(Selector);
        const baseInterfaceSelector = ecs.select(Base, Fraction, Selector, Player);
        const hunterInterfaceSelector = ecs.select(Hunter, Fraction, Selector, Player);

        const changeDestination = (destination) => {
            baseInterfaceSelector.iterate((entity, [base]) => {
                base._changeDestination(destination || entity);
            });
            hunterInterfaceSelector.iterate((entity, [hunter]) => {
                const hunterHome = hunter._home.get(Base);
                hunterHome._changeDestination(destination || hunter._home);
            });
        };

        controller._callbacks._onKeyUp = (keyCode) => {
            if (keyCode === 70) {
                requestFullscreen();
            }

            if (keyCode === 66) {
                changeDestination();
            }

            baseInterfaceSelector.iterate((entity, [base]) => {
                const index = keyCode === 77 ? 0 : keyCode === 72 ? 1 : keyCode === 76 ? 2 : -1;
                index !== -1 && base._startUpgrade(entity, index);
            });
        };

        view.addEventListener(
            'mouseup',
            (event) => {
                const rightButton = !!event.button;

                !rightButton && selectSelector.iterate((entity) => entity.remove(Selector));

                const point = new Vector(
                    (event.x - view.clientWidth / 2) * devicePixelRatio,
                    (event.y - view.clientHeight / 2) * devicePixelRatio,
                )
                    .rotate(-direction)
                    .add(camera.at);

                const candidats = [];

                ecs.sm.get(point, tileSize, (entity) => {
                    if (rightButton && !entity.get(Base)) {
                        return;
                    }
                    const position = entity.get(Position);
                    candidats.push({ e: entity, p: position, d: point.distanceSq(position) });
                });

                candidats.sort((a, b) => a.d - b.d);
                const candidat = candidats.find((c) => c.e.get(Base)) || candidats[0];

                if (candidat) {
                    if (rightButton) {
                        changeDestination(candidat.e);
                    } else {
                        candidat.e.add(new Selector());
                    }
                }
            },
            false,
        );

        const resize = () => {
            const mx = scene.width - minimapSize / 2 - uiMargin;
            const my = minimapSize / 2 + uiMargin;
            mapSprite.position.set(mx, my);
            mapCoverSprite.position.set(mx, my);

            interfaceSprite.position.set(uiMargin, scene.height - uiMargin);

            avatarSprite.position.set(
                uiMargin + uiPadding + uiAvatarRectSize / 2,
                scene.height - uiMargin - uiPanelHeight + uiPadding + uiAvatarRectSize / 2,
            );
        };

        resize();

        let minimapZoom = 1 / 2;

        const finish = () => {
            menuSprites.forEach((s) => {
                s.visible = true;
            });

            const gameFinishFrame = smoothAtlas.frame(
                win ? getGameTitle('V', '#6ffc03', true) : getGameTitle('X', 'red', true),
            );
            const gameFinishSprite = new Sprite(gameFinishFrame, {
                position: bigMinimapPosition,
            });
            menuLayer.add(gameFinishSprite);

            const overlaySprite = new Sprite(overlayFrame, {
                position: bigMinimapPosition,
                alpha: 0,
            });
            overlayLayer.add(overlaySprite);

            const transform = getAlphaTransform(5, 0, 0.8);
            transform.end = null;

            ecs.create().add(overlaySprite, new Transform(transform));
        };

        let last = 0;
        const loop = () => {
            if (!finished && playerSelector.size() < 1) {
                finished = true;
                finish();
            }

            if (
                !finished &&
                playerSelector.size() === huntersSelector.size() + baseSelector.size()
            ) {
                finished = true;
                win = true;
                finish();
            }

            if (finished) {
                resizeMenu();
            }

            const getNow = () => performance.now();

            const now = getNow();
            let delta = now - last || now;
            if (delta > 100) {
                delta = 20;
            }

            const secondsDelta = delta / 1000;
            ecs.update(secondsDelta / 1, getNow);
            last = now;

            const { _keys } = controller;

            _keys[33] && (minimapZoom -= secondsDelta); // pu
            _keys[34] && (minimapZoom += secondsDelta); // pd

            minimapZoom = clamp(1 / 2, 1, minimapZoom);

            _keys[81] && (direction += secondsDelta * 4); // q
            _keys[69] && (direction -= secondsDelta * 4); // e

            // const vecDirection = vecFromAngle(direction);
            const vecDirection = new Vector(Math.sin(direction), Math.cos(direction));

            // const vecStrafe = vecFromAngle(direction + PI2 / 4);
            const vecStrafe = new Vector(
                Math.sin(direction + PI2 / 4),
                Math.cos(direction + PI2 / 4),
            );

            const point = new Vector();

            _keys[65] && point.sub(vecStrafe); // a
            _keys[68] && point.add(vecStrafe); // d
            _keys[87] && point.sub(vecDirection); // w
            _keys[83] && point.add(vecDirection); // s

            const offset = point.length() ? point.norm().mul(speed * secondsDelta) : point;
            const newPosition = offset.add(camera.at);

            if (mapCenter.distanceSq(newPosition) < mapRadius * mapRadius) {
                camera.at = newPosition;
            }

            camera.angle = direction;

            const minimapVisibleSize = minimapZoom * mapSize;
            const frame = minimapFrame.subframe(
                camera.at.x / tileSize - minimapVisibleSize / 2 + minimapSize,
                camera.at.y / tileSize - minimapVisibleSize / 2 + minimapSize,
                minimapVisibleSize,
                minimapVisibleSize,
            );
            frame.size.set(minimapSize);

            avatarSprite.rotation += secondsDelta / 2;

            mapSprite.frame = frame;
            mapSprite.rotation = direction;
            mapCoverSprite.rotation = direction;

            // if (scene.resize()) {
            resize();
            // }

            scene.layer(0).clear();
            levels.forEach((_, level) => scene.layer(level + 1).clear());

            const mx = Math.floor(camera.at.x / tileSize);
            const my = Math.floor(camera.at.y / tileSize);

            const dx = Math.ceil(view.width / tileSize / 2) + 1;
            const dy = Math.ceil(view.height / tileSize / 2) + 1;

            const dv = Math.ceil(Math.sqrt(dx * dx + dy * dy));

            // for (let y = my - dv; y < my + dv; y++) {
            //     for (let x = mx - dv; x < mx + dv; x++) {
            //         if (x >= 0 && y >= 0 && x < mapSize && y < mapSize) {
            //             const { tile } = map[x + y * mapSize];
            //             scene.add(tile._base);
            //             tile._neighbours.forEach((sprite, level) => scene.layer(level + 1).add(sprite));
            //         }
            //     }
            // }

            doubleFor(my - dv, my + dv, mx - dv, mx + dv, (x, y) => {
                if (x >= 0 && y >= 0 && x < mapSize && y < mapSize) {
                    const { tile } = map[x + y * mapSize];
                    scene.add(tile._base);
                    tile._neighbours.forEach((sprite, level) => scene.layer(level + 1).add(sprite));
                }
            });

            scene.render();

            requestAnimationFrame(loop);
        };

        loop();
    };
});
