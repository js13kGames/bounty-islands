// const m = 4294967296;
// const a = 1664525;
// const c = 1013904223;
const m = 2**32;
const a = 134775813;
const c = 1;

export default (seed) => () => {
    seed = (a * seed + c) % m;
    return seed / m;
};
