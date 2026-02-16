import { Module } from 'node:module';
import { Command, Option } from 'commander';
import { transformCommand } from './utils.js';

const require = Module.createRequire(import.meta.url);

const { name, description, version } = require('../package.json');

const commander = new Command();

commander
  .name(name)
  .description(description)
  .version(version)
  .argument('<source>', 'source directory')
  .argument('<build>', 'build directory')
  .addOption(new Option('-t, --type <type>', 'code type').choices(['js', 'ts']).default('ts'))
  .option('-m, --match <match>', 'files match pattern to overwrite type', '')
  .option('-s, --swcrc <swcrc>', 'swcrc path', '.swcrc')
  .option('-i, --ignore [ignore...]', 'ignore patterns')
  .option('-p, --package', 'adjust package.json according to main property')
  .option('-c, --copy', 'copy package.json to build directory with optimized dependencies')
  .option('--commonjs-ext [commonjs-ext]', 'file extension of CommonJS files', '.cjs')
  .option('--esm-ext [esm-ext]', 'file extension of ESM files', '.js')
  .option('--skip-commonjs', 'do not generate CommonJS files')
  .option('--skip-esm', 'do not generate ESM files')
  .action(transformCommand);

  commander.parse(process.argv);

