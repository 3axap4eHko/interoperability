import * as Path from 'path';
import * as swc from '@swc/core';
import {
  isLocalFile,
  fileNotExist,
  patchPackageJSON,
  ModuleVisitor,
} from '../utils';

import * as Fs from 'fs/promises';

jest.mock('node:fs/promises');

describe('ModuleVisitor', () => {
  it('should visit module', async () => {
    const code = `
import { createRequire } from 'module';
import { asdf } from './module';

`;
    const ast = await swc.parse(code, { syntax: 'typescript' });
    const visitor = new ModuleVisitor('.js');
    visitor.visitProgram(ast);
    expect([...visitor.modules.values()]).toEqual(['module']);
    expect(ast.body[1]).toMatchObject({ source: { value: './module.js' } });
  });
});

describe('isLocalFile test suite', () => {
  it.each([
    { path: '/test' },
    { path: './test' },
    { path: '../test' },
    { path: '.test' },
  ])('should detect $path as local file', ({ path }) => {
    expect(path).toMatch(isLocalFile);
  });

  it.each([
    { path: 'test' },
  ])('should detect $path as non-local file', ({ path }) => {
    expect(path).not.toMatch(isLocalFile);
  });
});

describe('fileNotExist test suite', () => {
  it('should check if file does not exist', async () => {
    const access = jest.spyOn(Fs, 'access');
    access.mockRejectedValueOnce('error');
    await expect(fileNotExist('test')).resolves.toBeTruthy();
    access.mockResolvedValue(undefined);
    await expect(fileNotExist('test')).resolves.toBeFalsy();
  });
});

describe('patchPackageJSON test suite', () => {
  it ('should patch json file', async () => {
    const options = {
      match: '',
      swcrc: '',
      ignore: [''],
      commonjsExt: '.cjs',
      skipCommonjs: false,
      esmExt: '.mjs',
      skipEsm: false,
    };
    const packageJSON = { name: 'name', version: '1.0.0', description: 'description', main: 'build/index.js' };
    const patchedJSON = await patchPackageJSON(packageJSON, Path.resolve('build'), Path.resolve('source'), ['index.ts', 'test.ts'], options);
    expect(patchedJSON).toMatchSnapshot();
  });
});
