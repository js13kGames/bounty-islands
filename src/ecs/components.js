import Renderer from '../renderer';
import Vector from '../vector';
import {
    baseUpgradeCost,
    baseLoyalty,
    startBaseMineValue,
    startBaseHealValue,
    baseUpgradeTime,
} from '../mechanics';

class VectorWithRotation extends Vector {
    constructor(x, y, rotation) {
        super(x, y);
        this.rotation = rotation || 0;
    }

    from(vec) {
        super.from(vec);
        this.rotation = vec.rotation || 0;
        return this;
    }
}

export class Position extends VectorWithRotation {}

export class Velocity extends VectorWithRotation {}

export class Sprite extends Renderer.Sprite {
    destructor() {
        this.remove();
    }
}

export class Transform {
    constructor(transformer) {
        this._transformer = transformer;
        this._remaining = transformer._duration;
    }
}

export class Bounty {
    constructor(base, spawn, price) {
        this._base = base;
        this._spawn = spawn;
        this._price = price;
        this._targeted = null;
    }
}

export class Hunter {
    constructor(base, destination, props) {
        this._home = base;
        this._destination = destination;

        this._speed = props._speed;
        this._cspeed = 0;

        this._capacity = props._capacity;
        this._cargo = 0;
        this._price = 0;

        this._hp = props._hp;
        this._chp = props._hp;

        this._agi = 1.2 * Math.PI;

        this._target = null;
    }

    _changeTarget(target) {
        const bounty = this._target?.get(Bounty);
        bounty && (bounty._targeted = null);
        this._target = target;
    }

    destructor() {
        this._changeTarget(null);
    }
}

export class Base {
    constructor(type, spawns, antagonist) {
        this._type = type;
        this._aviableSpawns = spawns;
        this._neighbours = [];
        this._bounties = [];
        this._cooldownBountySpawn = 0;
        this._huntersLimit = 1;
        this._ownHunters = [];
        this._upgrades = [0, 0, 0];
        this._destination = null;
        this._loyalty = baseLoyalty;
        this._loyaltyInvolved = new Map();
        this._alliesCount = 0;
        this._enemiesCount = 0;
        this._nextUpgrade = -1;
        this._antagonist = antagonist;
    }

    _changeDestination(destination) {
        if (this._destination !== destination) {
            this._destination = destination;
            this._ownHunters.forEach((entity) => {
                const hunter = entity.get(Hunter);
                if (hunter) {
                    hunter._destination = destination;
                    hunter._changeTarget(destination);
                }
            });
        }
    }

    _apllyUpgrades(entity, upgrades) {
        this._upgrades = upgrades;
        this._huntersLimit = 1 + upgrades[2];

        const [miner, kit] = entity.get(Miner, RepairKit);
        miner._value = startBaseMineValue + upgrades[0];
        kit._repair = startBaseHealValue + upgrades[1];

        this._nextUpgrade = -1;
    }

    _upgradePrice(upgrade) {
        const upgradeLevel = this._upgrades[upgrade];
        return baseUpgradeCost * 2 ** upgradeLevel + baseUpgradeCost * (this._upgradeCount() / 4);
    }

    _upgradeCount() {
        return this._upgrades.reduce((a, i) => a + i, 0);
    }

    _startUpgrade(entity, index) {
        const [fraction, transform] = entity.get(Fraction, Transform);

        if (!transform && this._upgradePrice(index) < fraction._fraction._gold) {
            fraction._fraction._gold -= this._upgradePrice(index);
            const upgrades = [...this._upgrades];
            upgrades[index]++;

            entity.add(
                new Transform({
                    _duration: baseUpgradeTime + (baseUpgradeTime / 2) * this._upgradeCount(),
                    _name: 'upgrading',
                    end: () => this._apllyUpgrades(entity, upgrades),
                }),
            );
        }
    }
}

export class Name {
    constructor(name) {
        this._name = name;
    }
}

export class Collider {
    constructor(radius) {
        this._radius = radius;
        this._cell = null;
    }

    destructor(entity) {
        this._cell?.delete(entity);
    }
}

export class Attractor {
    constructor(radius, speed) {
        this._radius = radius;
        this._speed = speed;
    }
}

export class Selector {}

export class Gun {
    constructor(radius, damage) {
        this._radius = radius;
        this._damage = damage;

        this._cooldownOfFire = 0;
    }
}

export class Bullet {
    constructor(target, damage) {
        this._target = target;
        this._damage = damage;

        this._ttl = 1;
    }
}

export class RepairKit {
    constructor(radius, cooldown, repair, mass) {
        this._radius = radius;
        this._cooldown = cooldown;
        this._repair = repair;
        this._mass = mass;

        this._repairCooldown = 0;
    }
}

export class Fraction {
    constructor(fraction) {
        this._fraction = fraction;
    }
}

export class Exhaust {
    constructor(cooldown, tint, scale, offset, transform) {
        this._tint = tint;
        this._scale = scale;
        this._offset = offset;
        this._transform = transform;
        this._cooldown = cooldown;
        this._exhaustCooldown = 0;
    }
}

export class Player {}

export class Miner {
    constructor(value) {
        this._value = value;
        this._mineCooldown = 0;
    }
}
