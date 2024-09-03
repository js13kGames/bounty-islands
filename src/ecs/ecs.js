const DEVELOPMENT = false;

const selectors = [];
const systems = [];
const entities = new Set();

const ecsComponentMask = Symbol('m');
let bit = 0;

const noop = () => null;
const empty = { set: noop, get: noop, delete: noop };

const matchEntity = (entity) => {
    entity.exists && selectors.forEach((selector) => selector._match(entity));
};

const ejectEntity = (entity) => {
    entity._components.forEach((component) => component?.destructor?.(entity));
    selectors.forEach((selector) => selector._remove(entity));
    entities.delete(entity);
    entity._components = empty;
};

class Entity {
    constructor() {
        this._components = new Map();
        this._mask = 0;
    }

    get exists() {
        return this._components !== empty;
    }

    add(...components) {
        components.forEach((component) => {
            const mask = component?.constructor?.[ecsComponentMask];
            if (mask) {
                this._components.set(mask, component);
                this._mask |= mask;
            }
        });

        matchEntity(this);
        return this;
    }

    remove(...Components) {
        Components.forEach((Component) => {
            const sign = Component[ecsComponentMask];
            const component = this._components.get(sign);

            if (component) {
                component.destructor?.(this);
                this._components.delete(sign);
                this._mask &= ~sign;
            }
        });

        matchEntity(this);
        return this;
    }

    get(...Components) {
        const result = Components.map((Component) =>
            this._components.get(Component[ecsComponentMask]),
        );
        return result.length > 1 ? result : result[0];
    }

    eject() {
        ejectEntity(this);
    }
}

class Selector {
    constructor(mask, Components, parent) {
        if (DEVELOPMENT) {
            if (!mask) {
                throw new Error('Empty selector');
            }
        }

        const set = new Set();
        this._mask = mask;

        this.size = () => (parent ? parent.size() : set.size);

        this._check = (Comps) => Components.every((c, i) => c === Comps[i]);

        this._match = (entity) =>
            ((mask & entity._mask) === mask && set.add(entity)) || set.delete(entity);

        this._remove = (entity) => set.delete(entity);

        this.iterate = (fn, skipGetComponents) =>
            parent
                ? parent.iterate((entity) => fn(entity, entity.get(...Components)), true)
                : set.forEach((entity) =>
                      fn(entity, !skipGetComponents && entity.get(...Components)),
                  );

        !parent && entities.forEach(this._match);
    }
}

// const createMask = (number) => [number >>> 0, (number / 4294967296) >>> 0];

// const maskOrMask = (mask1, mask2) => {
//     mask1[0] |= mask2[0];
//     mask1[1] |= mask2[1];
//     return mask1;
// };

// const maskAndMask = (mask1, mask2) => {
//     mask1[0] &= mask2[0];
//     mask1[1] &= mask2[1];
//     return mask1;
// };

// const andMask = (mask1, mask2) => [mask1[0] & mask2[0], mask1[1] & mask2[1]];

// const equalMask = (mask1, mask2) => mask1[0] === mask2[0] && mask1[1] === mask2[1];

export default {
    register(...Components) {
        Components.forEach((Component) => {
            if (Component[ecsComponentMask]) {
                return;
            }

            if (DEVELOPMENT) {
                if (bit > 31) {
                    throw new Error('Components limit (32) reached');
                }
            }
            // if (bit > 53) { // for array mask
            //     throw new Error('Components limit reached');
            // }

            Component[ecsComponentMask] = (1 << bit++) >>> 0;
        });
    },

    process(...s) {
        systems.push(...s);
    },

    create() {
        const entity = new Entity();
        entities.add(entity);
        return entity;
    },

    select(...Components) {
        let mask = 0;

        Components.forEach((Component) => {
            mask |= Component[ecsComponentMask];
        });

        let selector = selectors.find((s) => s._mask === mask);

        if (!selector) {
            selector = new Selector(mask, Components);
            selectors.push(selector);
        }

        if (!selector._check(Components)) {
            return new Selector(mask, Components, selector);
        }

        return selector;
    },

    update(delta, now) {
        return systems.reduce((result, system) => {
            const begin = now && now();
            system.update(delta, begin);
            now && (result[system.constructor.name] = now() - begin);
            return result;
        }, {});
    },
};
