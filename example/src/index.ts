import { randomInt } from 'crypto';
export { createServer } from 'http';
import { A } from './A';

export * from './A';

export const a = new A(randomInt(10));

export type Type = unknown;

export class C {}

const b = {};

export { b };

export default new A(1);
