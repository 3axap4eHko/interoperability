import * as swc from '@swc/core';
import {
  isLocalFile,
  fileNotExist,
  hasFilePath,
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
    console.log(access.mockRejectedValue);
    access.mockRejectedValue('error');
    await expect(fileNotExist('test')).resolves.toBeTruthy();
    access.mockResolvedValue(undefined);
    await expect(fileNotExist('test')).resolves.toBeFalsy();
  });
});

describe('hasFilePath test suite', () => {
  const span: swc.Span = {
    start: 0,
    end: 0,
    ctxt: 0,
  };
  const localFileStringLiteral: swc.StringLiteral = {
    type: 'StringLiteral',
    value: './test',
    span,
  };
  const moduleStringLiteral: swc.StringLiteral = {
    type: 'StringLiteral',
    value: 'test',
    span,
  };
  it.each([
    { type: 'ExportAllDeclaration', source: localFileStringLiteral, span },
    { type: 'ExportNamedDeclaration', source: localFileStringLiteral, span },
    { type: 'ImportDeclaration', source: localFileStringLiteral, span },
    { type: 'ExportDefaultExpression', expression: localFileStringLiteral, span },
  ] as (swc.ModuleItem | swc.Statement)[])('should detect if node $type has a file path', (node) => {
    expect(hasFilePath(node)).toEqual(true);
  });
  it.each([
    { type: 'ExportAllDeclaration', source: moduleStringLiteral, span },
    { type: 'ExportNamedDeclaration', source: moduleStringLiteral, span },
    { type: 'ImportDeclaration', source: moduleStringLiteral, span },
    { type: 'ExportDefaultExpression', expression: moduleStringLiteral, span },
  ] as (swc.ModuleItem | swc.Statement)[])('should detect if node $type has a file path', (node) => {
    expect(hasFilePath(node)).toEqual(false);
  });
});
