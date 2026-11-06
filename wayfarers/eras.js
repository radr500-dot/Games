// The ages your band travels through. Each era changes the scenery, the road,
// what your band wears and what it throws. Colors come in a Daytime (light)
// and a Dusk (dark) version.

export const STAGES_PER_ERA = 5;

export const ERAS = [
  {
    key: 'stone', name: 'Stone Age', blurb: 'Your band gathers by the first fires and sets off over the hills.',
    hat: 'hair', item: 'club', proj: 'rock', road: 'dirt', wall: 'boulder',
    props: [['tree', 5], ['bush', 4], ['rock', 4], ['hut', 2], ['pine', 3]],
    outfit: '#b8794a',
    light: { skyTop: '#9fd3ef', skyBottom: '#e6f3f2', fog: '#dcecef', grass: ['#a9d08e', '#94c47c', '#bcd99a'], road: '#ecd9b0', roadEdge: '#c9ad7d', wall: '#9c8f80' },
    dark:  { skyTop: '#151a36', skyBottom: '#4b3e63', fog: '#2f3150', grass: ['#2f4a4f', '#294247', '#36545a'], road: '#55495e', roadEdge: '#3d3448', wall: '#6d6672' },
  },
  {
    key: 'bronze', name: 'Bronze Age', blurb: 'Bronze helmets, long spears and the first great temples.',
    hat: 'helmet', item: 'spear', proj: 'spear', road: 'sandstone', wall: 'sandstone',
    props: [['palm', 4], ['bush', 3], ['temple', 2], ['obelisk', 2], ['rock', 3]],
    outfit: '#c98b3a',
    light: { skyTop: '#8fcdf0', skyBottom: '#f6ead2', fog: '#f1e6d2', grass: ['#c7d58c', '#b5c97a', '#d6dc9c'], road: '#f1dca8', roadEdge: '#cfae70', wall: '#d7b27a' },
    dark:  { skyTop: '#161a38', skyBottom: '#5a4560', fog: '#35304d', grass: ['#3a4a43', '#33423c', '#43544b'], road: '#5e5060', roadEdge: '#433849', wall: '#8a7262' },
  },
  {
    key: 'castle', name: 'Castle Age', blurb: 'Knights, bows and towers with bright red roofs.',
    hat: 'knight', item: 'bow', proj: 'arrow', road: 'cobble', wall: 'brick',
    props: [['tree', 4], ['pine', 4], ['tower', 2], ['cottage', 3], ['bush', 3]],
    outfit: '#5b7fb5',
    light: { skyTop: '#9fcff0', skyBottom: '#e8f1ee', fog: '#dde9e8', grass: ['#9fcd86', '#8ac173', '#b2d693'], road: '#d9d2c4', roadEdge: '#a99f8f', wall: '#a7a29a' },
    dark:  { skyTop: '#141936', skyBottom: '#47406a', fog: '#2c2f50', grass: ['#2c4a49', '#264143', '#335452'], road: '#4f4b5c', roadEdge: '#383547', wall: '#6c6878' },
  },
  {
    key: 'sail', name: 'Age of Sail', blurb: 'A boardwalk by the sea, tall ships and tricorn hats.',
    hat: 'tricorn', item: 'musket', proj: 'ball', road: 'planks', wall: 'barrels', sea: true,
    props: [['ship', 3], ['lighthouse', 1], ['palm', 3], ['rock', 2], ['cottage', 2]],
    outfit: '#3f6f8f',
    light: { skyTop: '#86c8f0', skyBottom: '#e9f4f6', fog: '#dceef2', grass: ['#e9dcb0', '#dccf9f', '#f1e5bf'], road: '#c9a47a', roadEdge: '#9c7a55', wall: '#a8784f', sea: '#5fb2cf' },
    dark:  { skyTop: '#121834', skyBottom: '#3c3f69', fog: '#28304f', grass: ['#4b4a5a', '#434253', '#555466'], road: '#5b4b4c', roadEdge: '#41363a', wall: '#7c5f50', sea: '#24496a' },
  },
  {
    key: 'steam', name: 'Steam Age', blurb: 'Top hats, brass gadgets and puffing factory chimneys.',
    hat: 'tophat', item: 'gear', proj: 'bolt', road: 'brickroad', wall: 'redbrick',
    props: [['factory', 2], ['windmill', 2], ['lamp', 4], ['tree', 3], ['cottage', 2]],
    outfit: '#6b5a4a',
    light: { skyTop: '#a9cde3', skyBottom: '#efe9e0', fog: '#e4e0da', grass: ['#a7c592', '#94b780', '#b8d0a1'], road: '#c78f73', roadEdge: '#8f6250', wall: '#b9644d' },
    dark:  { skyTop: '#16182f', skyBottom: '#4d3d55', fog: '#302c43', grass: ['#33463f', '#2c3e38', '#3b5047'], road: '#5e4648', roadEdge: '#43333a', wall: '#7e4d47' },
  },
  {
    key: 'modern', name: 'Modern Age', blurb: 'City streets, glass towers and baseball caps.',
    hat: 'cap', item: 'blaster', proj: 'pellet', road: 'asphalt', wall: 'concrete',
    props: [['tower2', 4], ['tree', 4], ['lamp', 3], ['bush', 3]],
    outfit: '#3b8f7a',
    light: { skyTop: '#8ccaf2', skyBottom: '#edf4f6', fog: '#e1ecf0', grass: ['#9fd08f', '#8bc27c', '#b2dba0'], road: '#8a8f96', roadEdge: '#d4d6d8', wall: '#b8bcc0' },
    dark:  { skyTop: '#111733', skyBottom: '#3b3d66', fog: '#262c4a', grass: ['#2a4644', '#253e3d', '#30504d'], road: '#3b3e4a', roadEdge: '#5d6070', wall: '#5f6474' },
  },
  {
    key: 'space', name: 'Space Age', blurb: 'Bubble helmets and light beams on a soft lilac moon.',
    hat: 'bubble', item: 'laser', proj: 'laser', road: 'panels', wall: 'metal',
    props: [['dome', 3], ['crystal', 4], ['antenna', 2], ['rock', 4]],
    outfit: '#e9e6f2',
    light: { skyTop: '#b7b2ec', skyBottom: '#f0e6f4', fog: '#e7def0', grass: ['#d6cde6', '#c8bedb', '#e2daef'], road: '#a7b4c8', roadEdge: '#7f8ca3', wall: '#8ea7b8' },
    dark:  { skyTop: '#0b0d22', skyBottom: '#2e2652', fog: '#1d1b38', grass: ['#3a3552', '#332f49', '#433d5e'], road: '#2f3650', roadEdge: '#4b5675', wall: '#4d6274' },
  },
];

export function eraFor(level) {
  return ERAS[Math.min(Math.floor(level / STAGES_PER_ERA), ERAS.length - 1)];
}
export function eraIndex(level) {
  return Math.min(Math.floor(level / STAGES_PER_ERA), ERAS.length - 1);
}
// "Stone Age · Stage 3". After the last era the stages keep counting up.
export function stageLabel(level) {
  const ei = eraIndex(level);
  const stage = level - ei * STAGES_PER_ERA + 1;
  return `${ERAS[ei].name} · Stage ${stage}`;
}

// Coin shop. Each upgrade has a level; cost grows each time.
export const UPGRADES = [
  { key: 'band',   name: 'Bigger band',     desc: (l) => `Start with ${4 + l} travelers`, next: (l) => `${5 + l}`, base: 30, grow: 1.28, max: 46 },
  { key: 'power',  name: 'Stronger throws', desc: (l) => `Hits do ${Math.round(100 * Math.pow(1.09, l))}% damage`, next: (l) => `${Math.round(100 * Math.pow(1.09, l + 1))}%`, base: 45, grow: 1.3, max: 60 },
  { key: 'rate',   name: 'Quicker hands',   desc: (l) => `${(2.2 * (1 + 0.07 * l)).toFixed(1)} throws a second`, next: (l) => `${(2.2 * (1 + 0.07 * (l + 1))).toFixed(1)}`, base: 45, grow: 1.3, max: 30 },
  { key: 'range',  name: 'Longer reach',    desc: (l) => `Throws go ${16 + l * 1.2 | 0} steps`, next: (l) => `${16 + (l + 1) * 1.2 | 0}`, base: 35, grow: 1.32, max: 14 },
  { key: 'coins',  name: 'Lucky coins',     desc: (l) => `Coins worth ${100 + l * 10}%`, next: (l) => `${110 + l * 10}%`, base: 60, grow: 1.34, max: 40 },
  { key: 'magnet', name: 'Coin magnet',     desc: (l) => `Pulls coins from ${(1.2 + l * 0.45).toFixed(1)} steps`, next: (l) => `${(1.2 + (l + 1) * 0.45).toFixed(1)}`, base: 30, grow: 1.3, max: 10 },
];
export function upgradeCost(u, lvl) { return Math.round(u.base * Math.pow(u.grow, lvl) / 5) * 5; }

export const TIPS = [
  'Shoot a gray gate to raise its number. Enough hits can turn it blue.',
  'Blue gates add travelers. Gray gates take some away.',
  'Half walls can be dodged. Steer around them if your band is small.',
  'Crates are full of coins. Your band opens them by throwing at them.',
  'Each step on the bonus stairs at the end multiplies the coins from that stage.',
  'A bigger band throws more at once, so gates early on pay off later.',
  'Coins are kept even if your band runs out before the finish.',
  'The coin magnet pulls coins in from the edges of the road.',
];
