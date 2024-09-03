const geo = [
    'Bay',
    'Bush',
    'Cave',
    'Crag',
    'Dale',
    'Down',
    'Fern',
    'Fork',
    'Hill',
    'Lake',
    'Pass',
    'Peak',
    'Pond',
    'Reef',
    'Tree',
    'Vale',
];

const choose = (rnd) => geo[~~(rnd() * geo.length)];

export default (rnd) => () => {
    const pref = choose(rnd);
    let suf = pref;
    while (suf === pref) {
        suf = choose(rnd);
    }
    return pref + suf.toLowerCase();
};
