import { strict as assert } from 'assert';
import { transform } from '@swc/core';
import glob from 'fast-glob';

export class A {
  transform = transform;

  constructor(public value: number){
    assert.equal(typeof value, 'number');
    glob('');
  }
}
