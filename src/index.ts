import { Command } from 'commander';
import { transformCommand } from './utils.js';
// @ts-ignore
import packageJSON from '../package.json' assert { type: 'json' };
const { name, description, version } = packageJSON;

const commander = new Command();

commander
  .name(name)
  .description(description)
  .version(version)
  .argument('<source>', 'source directory')
  .argument('<build>', 'build directory')
  .option('-m, --match <match>', 'files match pattern', '**/*.ts')
  .option('-s, --swcrc <swcrc>', 'swcrc path', '.swcrc')
  .option('-i, --ignore [ignore...]', 'ignore patterns')
  .option('-p, --package', 'adjust package.json according to main property')
  .option('--commonjs-ext [commonjs-ext]', 'file extension of CommonJS files', '.cjs')
  .option('--esm-ext [esm-ext]', 'file extension of ESM files', '.js')
  .option('--skip-commonjs', 'do not generate CommonJS files')
  .option('--skip-esm', 'do not generate ESM files')
  .action(transformCommand);

  commander.parse(process.argv);
