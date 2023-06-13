import * as Path from 'path';
import {
  isLocalFile,
  fileNotExist,
  patchPackageJSON,
} from '../utils';

import * as Fs from 'fs/promises';

jest.mock('fs/promises');

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
    const access = Fs.access as jest.MockedFunction<typeof Fs.access>;
    access.mockRejectedValue('error');
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
