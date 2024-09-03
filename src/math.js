export const PI2 = 2 * Math.PI;

export const lerp = (a, b, t) => (1 - t) * a + t * b;
// export const cosine = t => 0.5 * (1 - Math.cos(t * Math.PI));
// export const cubic = t => t * t * (3 - 2 * t);
export const identity = (t) => t;
export const quintic = (t) => t * t * t * (t * (t * 6 - 15) + 10);
export const quint = (t) => t * t * t * t * t;
