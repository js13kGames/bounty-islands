import { signRandom, vecFromAngle, colorGradient, typeNames, clamp, pi2random } from '../common';
import Vector from '../vector';
import { identity } from '../math';

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
    Miner,
    Player,
} from './components';

import { tileSize, mapSize, realRadius, hunterSize } from '../consts';
import {
    hunterCost,
    cooldownBountySpawn,
    cargoCost,
    mineCooldown,
    gunRateOfFire,
    bulletSpeed,
    baseLoyalty,
    baseSpawnDuration,
    maxBountyCount,
} from '../mechanics';

import { PI2, lerp, quint } from '../math';

const createParticle = (ecs, layer, frame, scale, alpha, position, velocity, tint, transform) => {
    const sprite = new Sprite(frame, {
        position,
        tint,
        alpha,
        scale: new Vector(scale),
    });
    layer.add(sprite);

    ecs.create().add(sprite, position, velocity, new Transform(transform));
};

const updateAlpha = (entity, stage, from, to, fn = identity) => {
    const sprite = entity.get(Sprite);
    sprite && (sprite.alpha = lerp(from, to, fn(1 - stage)));
};

const updateScale = (entity, stage, from, to, fn = identity) => {
    entity.get(Sprite)?.scale.set(lerp(from, to, fn(1 - stage)));
};

const endTransformEject = (entity) => entity.eject();

export const getAlphaTransform = (duration, from, to) => ({
    _duration: duration,
    end: endTransformEject,
    update(entity, stage) {
        updateAlpha(entity, stage, from, to);
    },
});

const getExhaustTransform = (duration, scale) => ({
    _duration: duration / 6,
    update(entity, stage) {
        updateAlpha(entity, stage, 0, 1);
        updateScale(entity, stage, scale, scale * 1.5);
    },
    next: {
        _duration: duration,
        update(entity, stage) {
            updateAlpha(entity, stage, 1, 0);
            updateScale(entity, stage, scale * 1.5, scale * 3);
        },
        end: endTransformEject,
    },
});

export const destinationTransform = {
    _duration: 2,
    end: endTransformEject,
    update(entity, stage) {
        updateAlpha(entity, stage, 1, 0);
        updateScale(entity, stage, 0.9, 0.5);
    },
};

export class Movement {
    constructor(ecs) {
        const selector = ecs.select(Position, Velocity);

        this.update = (delta) => {
            selector.iterate((entity, [position, velocity]) => {
                position.x += velocity.x * delta;
                position.y += velocity.y * delta;
                position.rotation += velocity.rotation * delta;
            });
        };
    }
}

export class Transformer {
    constructor(ecs) {
        const selector = ecs.select(Transform);

        this.update = (delta) => {
            selector.iterate((entity, transform) => {
                transform._remaining -= delta;

                if (transform._remaining <= 0) {
                    transform._transformer.end?.(entity);
                    transform._transformer = transform._transformer.next;

                    if (!transform._transformer) {
                        entity.remove(Transform);
                        return;
                    }

                    transform._remaining += transform._transformer._duration;
                }

                transform._transformer.update?.(
                    entity,
                    transform._remaining / transform._transformer._duration,
                );
            });
        };
    }
}

export class HunterTargetIntersectionProcessor {
    constructor(ecs) {
        const selector = ecs.select(Hunter, Position, Fraction);

        this.update = (delta) => {
            selector.iterate((entity, [hunter, position, fraction]) => {
                const targetEntity = hunter._target;

                if (targetEntity) {
                    const [targetPosition, targetBounty, targetBase, targetFraction] =
                        targetEntity.get(Position, Bounty, Base, Fraction);

                    const distance = position.distanceSq(targetPosition);

                    if (distance < 8 * 8) {
                        hunter._changeTarget(null);

                        if (targetBounty) {
                            hunter._cargo++;
                            hunter._price += targetBounty._price;

                            const bountyBase = targetBounty._base.get(Base);
                            bountyBase._bounties = bountyBase._bounties.filter(
                                (r) => r !== targetEntity,
                            );
                            bountyBase._aviableSpawns.push(targetBounty._spawn);

                            targetEntity.eject();

                            if (hunter._cargo >= hunter._capacity) {
                                hunter._changeTarget(hunter._destination);
                            }
                        }

                        if (targetBase && fraction._fraction === targetFraction._fraction) {
                            targetFraction._fraction._gold += hunter._price;
                            hunter._cargo = 0;
                            hunter._price = 0;
                        }
                    }
                }
            });
        };
    }
}

export class HunterTargetingSystem {
    constructor(ecs) {
        const selector = ecs.select(Hunter, Position, Fraction);

        this.update = () => {
            selector.iterate((hunterEntity, [hunter, hunterPosition, hunterFraction]) => {
                if (hunter._target) {
                    return;
                }

                const [destinationBase, destinationFraction] = hunter._destination.get(
                    Base,
                    Fraction,
                );

                if (destinationFraction._fraction === hunterFraction._fraction) {
                    let nearestBounty = null;
                    let nearestDistance = realRadius * realRadius;

                    destinationBase._bounties.forEach((bountyEntity) => {
                        const [bounty, bountyPosition] = bountyEntity.get(Bounty, Position);

                        if (!bounty || (bounty._targeted && bounty._targeted !== hunterEntity)) {
                            return;
                        }

                        const distance = hunterPosition.distanceSq(bountyPosition);

                        if (nearestDistance > distance) {
                            nearestBounty = bountyEntity;
                            nearestDistance = distance;
                        }
                    });

                    if (nearestBounty) {
                        hunter._changeTarget(nearestBounty);
                        nearestBounty.get(Bounty)._targeted = hunterEntity;
                    }
                }

                if (hunter._target === null) {
                    hunter._changeTarget(hunter._destination);
                }
            });
        };
    }
}

export class HunterMovementProcessor {
    constructor(ecs) {
        const selector = ecs.select(Hunter, Fraction, Position, Velocity);

        this.update = (delta, time) => {
            let i = 0;
            selector.iterate((entity, [hunter, hunterFraction, hunterPosition, velocity]) => {
                i++;

                const { _target, _speed, _agi, _capacity, _cargo } = hunter;
                let { _cspeed } = hunter;

                if (_target) {
                    const dist = _speed / 5;
                    const aroundInc = dist * dist;

                    const targetPosition = _target.get(Position);

                    const distance = hunterPosition.distanceSq(targetPosition);

                    let dir = targetPosition.clone().sub(hunterPosition).norm();

                    const destinationFraction = hunter._destination.get(Fraction);

                    if (
                        hunter._target === hunter._destination &&
                        destinationFraction._fraction !== hunterFraction._fraction &&
                        distance < realRadius * realRadius
                    ) {
                        // enemy base
                        const lvls = 12;
                        const minRadius = realRadius / 8 + (i % lvls) * (realRadius / 8 / lvls);
                        const maxRadius =
                            realRadius / 8 + ((i + 1) % lvls) * (realRadius / 8 / lvls);

                        const normal = new Vector().from(hunterPosition).sub(targetPosition);
                        const currentRadius = normal.length();

                        if (currentRadius < realRadius / 3) {
                            const sign = 1;
                            normal.norm();

                            const angle = PI2 / 32;

                            if (currentRadius > maxRadius) {
                                // Приближение к базе
                                normal.rotate((PI2 / 4 + angle) * sign);
                            } else if (currentRadius < minRadius) {
                                // Отдаление от базы
                                normal.rotate((PI2 / 4 - angle) * sign);
                            } else {
                                // Проход вдоль базы
                                normal.rotate((PI2 / 4) * sign);
                            }

                            dir = normal;
                        }
                    }

                    const maxAngle = _agi * delta;
                    const direction = vecFromAngle(hunterPosition.rotation).norm();
                    let angle = Math.atan2(direction.cross(dir), direction.dot(dir));

                    if (Math.abs(angle) > maxAngle) {
                        angle = Math.sign(angle) * maxAngle;
                    }

                    const maxSpeed = _speed * (1 - (_cargo / _capacity) * cargoCost);
                    const minSpeed = _speed / 3;

                    if (distance < aroundInc) {
                        _cspeed -= _speed * (delta * 4);
                        if (_cspeed < minSpeed) {
                            _cspeed = minSpeed;
                        }
                    } else {
                        _cspeed += _speed * delta;
                        if (_cspeed > maxSpeed) {
                            _cspeed = maxSpeed;
                        }
                    }

                    hunter._cspeed = _cspeed;

                    velocity.from(direction).mul(_cspeed);
                    velocity.rotation = angle / delta;
                } else {
                    velocity.x = 0;
                    velocity.y = 0;
                    velocity.rotation = 0;
                }
            });
        };
    }
}

export class AttractorProcessor {
    constructor(ecs) {
        const selector = ecs.select(Hunter, Position, Attractor);

        this.update = (delta) => {
            selector.iterate((entity, [hunter, position, attractor]) => {
                const [bounty, p] = hunter._target?.get(Bounty, Position) || [];

                if (bounty && p && position.distanceSq(p) < attractor._radius ** 2) {
                    const vec = position.clone().sub(p);
                    const speed =
                        attractor._speed * (1 + 3 * (1 - vec.length() / attractor._radius));
                    p.add(vec.norm().mul(speed * delta));
                }
            });
        };
    }
}

export class Spawner {
    constructor(ecs, frames, layer, levels, map, hunterColoredFrames, hunterLayer) {
        const baseSelector = ecs.select(Base, Position, Fraction);

        this.update = (delta) => {
            baseSelector.iterate((entity, [baseComponent, basePosition, baseFraction]) => {
                // spawn bounties
                baseComponent._cooldownBountySpawn -= delta;

                if (
                    baseComponent._cooldownBountySpawn < 0 &&
                    baseComponent._bounties.length < maxBountyCount
                ) {
                    const spawn = baseComponent._aviableSpawns.splice(
                        ~~(Math.random() * baseComponent._aviableSpawns.length),
                        1,
                    );

                    const position = new Position().from(ecs._spawns[spawn]);

                    const cx = ~~(position.x / tileSize);
                    const cy = ~~(position.y / tileSize);
                    const level = map[cx + cy * mapSize].level;
                    const sprite = new Sprite(frames[level], { position });
                    sprite.scale.set();

                    layer.add(sprite);

                    const bounty = ecs.create().add(
                        new Name('Bounty'),
                        position,
                        new Velocity(0, 0, signRandom(2) * Math.PI),
                        sprite,
                        new Transform({
                            _duration: 1,
                            update(entity, stage) {
                                updateScale(entity, stage, 0, 1, quint);
                            },
                            end(e) {
                                e.add(new Bounty(entity, spawn, 1 + level), new Collider());
                            },
                        }),
                    );

                    baseComponent._bounties.push(bounty);
                    baseComponent._cooldownBountySpawn = cooldownBountySpawn;
                }

                // spawn hunters

                const fraction = baseFraction._fraction;

                if (
                    entity.get(Transform) ||
                    baseComponent._ownHunters.length >= baseComponent._huntersLimit ||
                    fraction._gold < hunterCost
                ) {
                    return;
                }

                fraction._gold -= hunterCost;

                const hunterProps = [
                    {
                        _speed: 5 * tileSize,
                        _hp: 120,
                        _capacity: 3,
                        _damage: 2,
                    },
                    {
                        _speed: 6 * tileSize,
                        _hp: 60,
                        _capacity: 1,
                        _damage: 2,
                    },
                    {
                        _speed: 7 * tileSize,
                        _hp: 80,
                        _capacity: 2,
                        _damage: 4,
                    },
                ];

                entity.add(
                    new Transform({
                        _duration: baseSpawnDuration,
                        _name: 'spawning',
                        end() {
                            const type = baseComponent._type;

                            const position = new Position(
                                basePosition.x,
                                basePosition.y,
                                pi2random(),
                            );

                            const sprite = new Sprite(hunterColoredFrames[type][fraction._index], {
                                position,
                            });
                            hunterLayer.add(sprite);

                            const hunterExhaustScale = 1.4;
                            const hunter = ecs
                                .create()
                                .add(
                                    new Hunter(
                                        entity,
                                        baseComponent._destination,
                                        hunterProps[type],
                                    ),
                                    new Fraction(fraction),
                                    position,
                                    new Name(typeNames[type]),
                                    new Collider(),
                                    new Velocity(),
                                    new Exhaust(
                                        0.07,
                                        0xab2c16,
                                        hunterExhaustScale,
                                        hunterSize / 2,
                                        getExhaustTransform(1, hunterExhaustScale),
                                    ),
                                    new Attractor(tileSize, tileSize),
                                    new Gun(realRadius / 1.5, hunterProps[type]._damage),
                                    sprite,
                                    entity.get(Player) && new Player(),
                                );

                            if (type === 1) {
                                hunter.add(
                                    new RepairKit(realRadius / 2, /*cooldown*/ 1 / 3, /*repair*/ 1),
                                );
                            }

                            if (type === 0) {
                                hunter.add(new Miner(1, 1));
                            }

                            baseComponent._ownHunters.push(hunter);
                        },
                    }),
                );
            });
        };
    }
}

export class SpaceUpdater {
    constructor(ecs) {
        const selector = ecs.select(Position, Collider);

        this.update = () => {
            selector.iterate(ecs.sm.update);
        };
    }
}

export class SelectUpdater {
    constructor(ecs, layer, allframe, baseFrame, uiUpdater) {
        const selector = ecs.select(Position, Selector, Sprite);
        let selected = [];

        this.update = () => {
            selected.forEach(([entity, sprite]) => sprite.remove());
            selected = [];

            selector.iterate((entity, [position]) => {
                const frame = entity.get(Base) ? baseFrame : allframe;

                const selPosition = new Vector().from(position);
                const sprite = new Sprite(frame, {
                    billboard: true,
                    position: selPosition,
                });
                layer.add(sprite);

                selected.push([entity, sprite]);
            });

            let info = [];
            let name = '';
            let sprite = null;
            let entity = null;

            if (selected.length) {
                entity = selected[0][0];

                // const nameComponent = entity.get(Name);
                // if (nameComponent) {
                //     name = nameComponent._name;
                // }
                name = entity.get(Name)?._name;

                const [
                    base,
                    hunter,
                    fraction,
                    spriteComponent,
                    kit,
                    bounty,
                    gun,
                    miner,
                    transform,
                ] = entity.get(
                    Base,
                    Hunter,
                    Fraction,
                    Sprite,
                    RepairKit,
                    Bounty,
                    Gun,
                    Miner,
                    Transform,
                );
                sprite = spriteComponent;

                if (bounty) {
                    info.push(`worth: ${bounty._price} gold`);
                }

                const getPercent = (current, all) => ~~(100 * (1 - current / all));

                if (hunter) {
                    const hunterDestination = hunter._destination.get(Base);
                    const hunterHome = hunter._home.get(Name);

                    info.push(
                        `from: ${hunterHome._name}`,
                        `destination: ${hunterDestination._destination.get(Name)._name}`,
                        `speed: ${hunter._cspeed | 0}/${hunter._speed}`,
                        `hp: ${hunter._chp}/${hunter._hp}`,
                        `damage: ${gun._damage / gunRateOfFire}/s`,
                        `cargo: ${hunter._cargo}/${hunter._capacity} (${hunter._price} gold)`,
                    );
                }

                if (base) {
                    const destination = base._destination.get(Name)._name;
                    info.push(`gold: ${fraction._fraction._gold}`);
                    info.push(`destination: ${destination}`);
                    info.push(`loyalty: ${100 - getPercent(base._loyalty, baseLoyalty)}%`);
                    info.push(`upgrades: ${base._upgradeCount()}`);
                    info.push(`limit: ${base._ownHunters.length}/${base._huntersLimit}`);
                }

                miner && info.push(`mine: ${miner._value} gold/s`);
                kit &&
                    info.push(
                        `heal: ${kit._repair / kit._cooldown} hp/s${kit._mass ? ' aoe' : ''}`,
                    );

                if (base && transform) {
                    info.push(
                        `${transform._transformer._name}: ${getPercent(
                            transform._remaining,
                            transform._transformer._duration,
                        )}%`,
                    );
                }
            }

            uiUpdater(entity, name, sprite, info);
        };
    }
}

export class GunProcessor {
    constructor(ecs, frame, layer) {
        const selector = ecs.select(Gun, Fraction, Position, Gun);

        this.update = (delta) => {
            selector.iterate((entity, [gun, gunFraction, position]) => {
                if (gun._cooldownOfFire > 0) {
                    gun._cooldownOfFire -= delta;
                    return;
                }

                const fraction = gunFraction._fraction;

                const candidats = [];
                ecs.sm.get(position, gun._radius, (entity) => {
                    const [h, p, f] = entity.get(Hunter, Position, Fraction);

                    if (h && f._fraction !== fraction) {
                        candidats.push({ e: entity, p, d: p.distanceSq(position) });
                    }
                });

                candidats.sort((a, b) => a.d - b.d);
                const candidat = candidats[0];

                if (candidat) {
                    const offset = vecFromAngle(position.rotation).mul(-32);

                    const bulletPosition = new Position().from(position).sub(offset);

                    const sprite = new Sprite(frame, {
                        position: bulletPosition,
                        // tint: fraction._color,
                    });
                    layer.add(sprite);

                    ecs.create().add(
                        new Bullet(candidat.e, gun._damage),
                        bulletPosition,
                        new Velocity(),
                        sprite,
                        new Exhaust(
                            0.01,
                            // fraction._color,
                            0xffffff,
                            0.6,
                            12,
                            getAlphaTransform(0.05, 1, 0.3),
                        ),
                    );

                    gun._cooldownOfFire = gunRateOfFire;
                }
            });
        };
    }
}

export class ExhaustProcessor {
    constructor(ecs, frame, layer) {
        const selector = ecs.select(Exhaust, Position);

        this.update = (delta) => {
            selector.iterate((entity, [exhaust, position]) => {
                exhaust._exhaustCooldown -= delta;

                if (exhaust._exhaustCooldown <= 0) {
                    const direction = vecFromAngle(position.rotation + signRandom(PI2 / 8)).mul(-1);
                    direction.rotation = signRandom(PI2);
                    const offset = vecFromAngle(position.rotation).mul(exhaust._offset);
                    const exhaustPosition = new Position().from(position).sub(offset);

                    let tint = exhaust._tint;

                    const hunter = entity.get(Hunter);

                    if (hunter) {
                        const k = hunter._chp / hunter._hp;
                        tint =
                            k > 0.5
                                ? colorGradient(0xede43e, 0xe3e0d8, (k - 0.5) * 2)
                                : colorGradient(0xcc4129, 0xede43e, k * 2);
                    }

                    createParticle(
                        ecs,
                        layer,
                        frame,
                        exhaust._scale,
                        0,
                        exhaustPosition,
                        new Velocity().from(direction).mul((1 + Math.random()) * 30),
                        tint,
                        exhaust._transform,
                    );

                    exhaust._exhaustCooldown = exhaust._cooldown;
                }
            });
        };
    }
}

export class BulletProcessor {
    constructor(ecs, particleFrame, particleLayer) {
        const selector = ecs.select(Bullet, Position, Velocity, Sprite);

        const deathTransform = {
            _duration: 1,
            end(entity) {
                const position = entity.get(Position);
                for (let angle = 0; angle < PI2; angle += PI2 / 20) {
                    const velocity = vecFromAngle(angle + signRandom(0.1)).mul(
                        100 * (0.5 + Math.random()),
                    );

                    createParticle(
                        ecs,
                        particleLayer,
                        particleFrame,
                        3,
                        1,
                        new Position().from(position),
                        new Velocity().from(velocity),
                        colorGradient(0xff0000, 0x5c0606, Math.random()),
                        getAlphaTransform(1 + (1 / 8) * (1 + Math.random()), 1, 0),
                    );
                }
                entity.eject();
            },
            update(entity, stage) {
                updateScale(entity, stage, 0.3, 1);
            },
        };

        this.update = (delta) => {
            selector.iterate((entity, [bullet, position, velocity, sprite]) => {
                bullet._ttl -= delta;
                if (bullet._ttl <= 0) {
                    entity.eject();
                    return;
                }

                const target = bullet._target;
                const [hunter, targetPosition, targetVelocity] = target.get(
                    Hunter,
                    Position,
                    Velocity,
                );

                if (!hunter) {
                    return;
                }

                if (position.distanceSq(targetPosition) < 5 * 5) {
                    hunter._chp -= bullet._damage;
                    if (hunter._chp <= 0) {
                        target.remove(Hunter, Gun, RepairKit, Miner);
                        target.add(new Transform(deathTransform));
                        targetVelocity.rotation = PI2 * 2;
                    }

                    velocity.mul(1 / 2);
                    sprite.frame = particleFrame;
                    sprite.tint = 0xff0000;
                    entity.remove(Bullet, Exhaust);
                    entity.add(
                        new Transform({
                            _duration: 1 / 4,
                            end: endTransformEject,
                            update(entity, stage) {
                                updateAlpha(entity, stage, 1, 0, quint);
                                updateScale(entity, stage, 1, 2);
                            },
                        }),
                    );

                    return;
                }

                const direction = targetPosition.clone().sub(position).norm();

                velocity.from(direction).mul(bulletSpeed);
                position.rotation = direction.angle();
            });
        };
    }
}

export class RepairKitProcessor {
    constructor(ecs, frame, layer) {
        const selector = ecs.select(Position, RepairKit, Fraction);

        this.update = (delta) => {
            selector.iterate((entity, [position, kit, fractionComponent]) => {
                if (kit._repairCooldown > 0) {
                    kit._repairCooldown -= delta;
                    return;
                }

                const fraction = fractionComponent._fraction;

                let candidats = [];
                ecs.sm.get(position, kit._radius, (entity) => {
                    const [h, f] = entity.get(Hunter, Fraction);

                    if (h && f._fraction === fraction) {
                        const p = entity.get(Position);
                        candidats.push({ e: entity, p, h: h._hp - h._chp });
                    }
                });

                candidats = kit._mass ? candidats : [candidats.sort((a, b) => b.h - a.h)[0]];

                candidats.forEach((candidat) => {
                    if (candidat) {
                        const [repairTarget, position] = candidat.e.get(Hunter, Position);

                        if (repairTarget._hp > repairTarget._chp) {
                            repairTarget._chp = clamp(
                                0,
                                repairTarget._hp,
                                repairTarget._chp + kit._repair,
                            );

                            const direction = vecFromAngle(position.rotation + PI2 * signRandom());

                            const velocity = new Velocity().from(direction).mul(tileSize * 1);
                            velocity.rotation = PI2 * 2;

                            createParticle(
                                ecs,
                                layer,
                                frame,
                                1,
                                1,
                                new Position().from(position),
                                velocity,
                                0xffffff,
                                getAlphaTransform(0.4, 1, 0.5),
                            );
                        }
                    }
                });

                kit._repairCooldown = kit._cooldown;
            });
        };
    }
}

export class MineProcessor {
    constructor(ecs) {
        const selector = ecs.select(Miner, Fraction);

        this.update = (delta) => {
            selector.iterate((entity, [miner, fractionComponent]) => {
                if (miner._mineCooldown > 0) {
                    miner._mineCooldown -= delta;
                    return;
                }

                const fraction = fractionComponent._fraction;
                fraction._gold += miner._value;
                miner._mineCooldown = mineCooldown;
            });
        };
    }
}

export class BaseProcessor {
    constructor(ecs, baseColoredFrames) {
        const selector = ecs.select(Base, Position, Fraction, Sprite);

        this.update = (delta) => {
            selector.iterate((entity, [base, position, fraction, sprite]) => {
                const enemies = [];
                const enemiesFractions = new Map();
                const allies = [];

                const addToMap = (map, fraction, value) => {
                    const old = map.get(fraction) || 0;
                    map.set(fraction, old + value);
                };

                const maxFromMap = (map) => {
                    let max = 0;
                    let key = null;
                    map.forEach((v, k) => {
                        if (v > max) {
                            max = v;
                            key = k;
                        }
                    });
                    return [max, key];
                };

                ecs.sm.get(position, realRadius / 2, (e) => {
                    const [f, h] = e.get(Fraction, Hunter);

                    if (f && h) {
                        if (fraction._fraction === f._fraction) {
                            allies.push(f);
                        } else {
                            enemies.push(f);
                            addToMap(enemiesFractions, f._fraction, 1);
                        }
                    }
                });

                base._alliesCount = allies.length;
                base._enemiesCount = enemies.length;

                const [maxFractionsHuntersLength] = maxFromMap(enemiesFractions);

                let l = maxFractionsHuntersLength - allies.length;
                if (maxFractionsHuntersLength && l >= 0) {
                    l = l === 0 ? 0 : -1;
                } else {
                    l = 0.5;
                }

                const deltaLoyalty = l * delta;

                const newLoyalty = clamp(0, baseLoyalty, base._loyalty + deltaLoyalty);

                if (deltaLoyalty < 0) {
                    enemies.forEach((f) => {
                        addToMap(
                            base._loyaltyInvolved,
                            f._fraction,
                            -deltaLoyalty / enemies.length,
                        );
                    });
                }

                base._loyalty = newLoyalty;

                if (base._loyalty === baseLoyalty) {
                    base._loyaltyInvolved.clear();
                }

                if (base._loyalty <= 0) {
                    const [_, newFraction] = maxFromMap(base._loyaltyInvolved);

                    fraction._fraction = newFraction;

                    if (base._antagonist && !newFraction._isPlayer) {
                        newFraction._antagonist = true;
                    }

                    sprite.frame = baseColoredFrames[base._type][newFraction._index];
                    base._loyalty = 1;
                    base._loyaltyInvolved.delete(newFraction);
                    entity.remove(Transform, Player).add(
                        new Transform({
                            _duration: 0,
                            end() {
                                base._apllyUpgrades(
                                    entity,
                                    base._upgrades.map((v) => Math.max(0, v - 1)),
                                );
                            },
                        }),
                    );

                    if (newFraction._isPlayer) {
                        entity.add(new Player());
                    }
                }

                base._ownHunters = base._ownHunters.filter((e) => e.exists);
            });
        };
    }
}

export class BaseAIProcessor {
    constructor(ecs) {
        const selector = ecs.select(Base, Position, Fraction);

        this.update = (delta) => {
            selector.iterate((entity, [base, position, fraction]) => {
                if (entity.get(Player)) {
                    return;
                }

                let nextUpgrade = base._nextUpgrade;
                if (nextUpgrade === -1) {
                    nextUpgrade = fraction._fraction._antagonist ? 2 : ~~(Math.random() * 3);
                }

                base._nextUpgrade = nextUpgrade;

                base._startUpgrade(entity, nextUpgrade);

                if (base._loyalty < baseLoyalty * 0.75) {
                    base._changeDestination(entity);
                    return;
                }

                const [destinationBase, destinationFraction] = base._destination.get(
                    Base,
                    Fraction,
                );

                if (
                    destinationFraction._fraction === fraction._fraction &&
                    (destinationBase._enemiesCount > 0 ||
                        destinationBase._loyalty < baseLoyalty * 0.75)
                ) {
                    return;
                }

                let target = null;
                let targetDistance = (realRadius * 2) ** 2;

                let defTarget = null;
                let enemyDefCount = 99;

                base._neighbours.forEach((e) => {
                    const [canditateBase, canditateFraction, canditatePosition] = e.get(
                        Base,
                        Fraction,
                        Position,
                    );
                    if (canditateFraction._fraction === fraction._fraction) {
                        if (
                            canditateBase._enemiesCount &&
                            canditateBase._enemiesCount < enemyDefCount
                        ) {
                            defTarget = e;
                            enemyDefCount = canditateBase._enemiesCount;
                        }
                        return;
                    }

                    const distance = canditatePosition.distanceSq(position);
                    if (
                        canditateBase._alliesCount < base._ownHunters.length &&
                        distance < targetDistance
                    ) {
                        target = e;
                        targetDistance = distance;
                    }
                });

                if (defTarget) {
                    base._changeDestination(defTarget);
                    return;
                }

                if (
                    target &&
                    fraction._fraction._gold >
                        (fraction._fraction._antagonist ? hunterCost * 5 : hunterCost)
                ) {
                    base._changeDestination(target);
                } else {
                    base._changeDestination(entity);
                }
            });
        };
    }
}
