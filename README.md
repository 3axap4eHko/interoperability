# Interoperability

[SWC](https://www.npmjs.com/package/@swc/core) based tool, helps to compile TypeScript code to ESM and CommonJS Interoperable modules.

[![Build Status][github-image]][github-url]
[![NPM version][npm-image]][npm-url]
[![Downloads][downloads-image]][npm-url]

## Usage

Just run build directory
```bash
npx inop src build
```

Use option `-p` to adjust `package.json` with following changes
```json
{
  ...
  "type": "module",
  "main": "build/index.cjs",
  "module": "build/index.js",
  "types": "build/index.d.ts",
  "exports": {
    "require": "./build/index.cjs",
    "import": "./build/index.js"
  },
  "files": [ //list build directory and sources for sourceMap
    "build",
    "src/index.ts"
  ],
  ...
}
```

As for module declarations and typechecking use the following command, since swc does not support them yet
```bash
tsc --declaration --emitDeclarationOnly
```

## Help
```
Arguments:
  source                         source directory
  build                          build directory

Options:
  -V, --version                  output the version number
  -m, --match <match>            files match pattern (default: "**/*.ts")
  -s, --swcrc <swcrc>            swcrc path (default: ".swcrc")
  -i, --ignore [ignore...]       ignore patterns
  -p, --package                  adjust package.json according to main property
  --commonjs-ext [commonjs-ext]  file extension of CommonJS files (default: ".cjs")
  --esm-ext [esm-ext]            file extension of ESM files (default: ".js")
  --skip-commonjs                do not generate CommonJS files
  --skip-esm                     do not generate ESM files
  -h, --help                     display help for command
```

## License

License [Apache-2.0](http://www.apache.org/licenses/LICENSE-2.0)
Copyright (c) 2023-present Ivan Zakharchanka


[npm-url]: https://www.npmjs.com/package/inop
[downloads-image]: https://img.shields.io/npm/dw/inop.svg?maxAge=43200
[npm-image]: https://img.shields.io/npm/v/inop.svg?maxAge=43200
[github-url]: https://github.com/3axap4eHko/interoperability/actions/workflows/cicd.yml
[github-image]: https://github.com/3axap4eHko/interoperability/actions/workflows/cicd.yml/badge.svg
