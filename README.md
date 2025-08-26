# Interoperability

Fast [SWC](https://www.npmjs.com/package/@swc/core)-powered build tool that compiles TypeScript/JavaScript to dual ESM/CommonJS packages. Solve the [dual package hazard](https://nodejs.org/api/packages.html#dual-package-hazard) and ship modern packages with ease.

[![Build Status][github-image]][github-url]
[![NPM version][npm-image]][npm-url]
[![Downloads][downloads-image]][npm-url]

## Why inop?

Publishing JavaScript packages that work in both CommonJS and ESM environments is complicated:
- **Dual Package Hazard**: Risk of loading the same module twice in different formats
- **Extension Hell**: Managing `.js`, `.cjs`, `.mjs` extensions correctly
- **Import Rewriting**: Adjusting import paths for each module system
- **Package.json Exports**: Complex configuration for dual module support

`inop` handles all of this automatically - just write TypeScript, get both formats.

## Installation

```bash
npm install --save-dev inop
# or
pnpm add -D inop
# or
yarn add -D inop
```

## Quick Start

Transform your TypeScript source to dual modules:
```bash
npx inop src build
```

This creates both ESM (`.js`) and CommonJS (`.cjs`) versions of your code with proper source maps.

## Example

Given this source structure:
```
src/
├── index.ts
├── utils.ts
└── constants.ts
```

Running `npx inop src build` produces:
```
build/
├── index.js        # ESM version
├── index.cjs       # CommonJS version  
├── index.js.map    # Source map for ESM
├── index.cjs.map   # Source map for CommonJS
├── utils.js
├── utils.cjs
├── constants.js
└── constants.cjs
```

## Common Use Cases

### Publishing npm packages

Use the `-p` flag to automatically configure `package.json` for dual module publishing:
```bash
npx inop src build -p
```

This updates your `package.json` with:
```json
{
  "type": "module",
  "main": "build/index.cjs",       // CommonJS entry
  "module": "build/index.js",       // ESM entry
  "types": "build/index.d.ts",      // TypeScript types
  "exports": {
    "require": "./build/index.cjs", // Node.js require()
    "import": "./build/index.js"    // ESM import
  },
  "files": ["build", "src"]         // Include source for source maps
}
```

### Monorepo packages

Exclude test files and mocks when building:
```bash
npx inop src build -i __tests__ -i __mocks__
```

### Custom extensions

Use different file extensions for your output:
```bash
# Use .mjs for ESM and .js for CommonJS
npx inop src dist --esm-ext .mjs --commonjs-ext .js

# Generate only ESM
npx inop src dist --skip-commonjs

# Generate only CommonJS  
npx inop src dist --skip-esm
```

### Optimized packages

Create a standalone package with only used dependencies:
```bash
npx inop src dist -p --copy
```
This creates a `dist/package.json` with only the dependencies actually imported in your code.

## TypeScript Configuration

Since SWC doesn't generate type declarations, combine `inop` with TypeScript:

```bash
# Build modules and generate types
npx inop src build && tsc --declaration --emitDeclarationOnly
```

Or in your `package.json`:
```json
{
  "scripts": {
    "build": "inop src build && tsc --declaration --emitDeclarationOnly"
  }
}
```

### Recommended `tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "NodeNext",
    "declaration": true,
    "esModuleInterop": true,
    "moduleResolution": "NodeNext",
    "rootDir": "src",
    "outDir": "build"
  }
}
```

### Jest Configuration

For testing with Jest and SWC:
```javascript
export default {
  coverageProvider: 'v8',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',  // Handle .js extensions in imports
  },
  transform: {
    '^.+\\.ts$': '@swc/jest',      // Use SWC for fast transpilation
  },
};
```

## CLI Reference

```bash
npx inop <source> <build> [options]
```

### Arguments
- `source` - Source directory containing TypeScript/JavaScript files
- `build` - Output directory for compiled modules

### Options
- `-p, --package` - Update package.json with dual module configuration
- `-c, --copy` - Copy package.json to build directory with optimized dependencies
- `-i, --ignore [patterns...]` - Ignore file patterns (e.g., `__tests__`, `*.spec.ts`)
- `-t, --type <type>` - Source file type: `js` or `ts` (default: `ts`)
- `-m, --match <pattern>` - Override file matching pattern (default: `**/*.ts`)
- `-s, --swcrc <path>` - Custom .swcrc config path (default: `.swcrc`)
- `--commonjs-ext <ext>` - CommonJS file extension (default: `.cjs`)
- `--esm-ext <ext>` - ESM file extension (default: `.js`)
- `--skip-commonjs` - Generate only ESM output
- `--skip-esm` - Generate only CommonJS output
- `-V, --version` - Show version number
- `-h, --help` - Show help

## Troubleshooting

### Import paths not working?
Ensure your TypeScript uses `.js` extensions in imports:
```typescript
// ✅ Correct - will be transformed appropriately
import { utils } from './utils.js';

// ❌ Wrong - missing extension
import { utils } from './utils';
```

### Types not generated?
`inop` focuses on fast transpilation. Run TypeScript separately for declarations:
```bash
tsc --declaration --emitDeclarationOnly
```

### Source maps not resolving?
Make sure source files are included in your npm package by using the `-p` flag or manually adding them to `files` in package.json.

## License

License [The MIT License](http://opensource.org/licenses/MIT)
Copyright (c) 2023-2024 Ivan Zakharchanka


[npm-url]: https://www.npmjs.com/package/inop
[downloads-image]: https://img.shields.io/npm/dw/inop.svg?maxAge=43200
[npm-image]: https://img.shields.io/npm/v/inop.svg?maxAge=43200
[github-url]: https://github.com/3axap4eHko/interoperability/actions/workflows/cicd.yml
[github-image]: https://github.com/3axap4eHko/interoperability/actions/workflows/cicd.yml/badge.svg
