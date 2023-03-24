import * as Path from 'path';
import * as Fs from 'fs/promises';
import * as glob from 'fast-glob';
import { Command } from 'commander';
import { compile, patchCJS, patchMJS, isLocalFile, fileExists } from './utils';
// @ts-ignore
import { name, description, version } from '../package.json';

const commander = new Command();

interface Options {
  source: string;
  tsconfig: string,
  swcrc: string;
  ignore: string[];
}

const defaultSwcrc = {
  module: {
    strict: true,
  },
  jsc: {
    target: 'es2022',
    parser: {},
  },
};

commander
  .name(name)
  .description(description)
  .version(version)
  .argument('<source>', 'source directory')
  .argument('<build>', 'build directory')
  .option('-s, --swcrc <swcrc>', 'swcrc path', './.swcrc')
  .option('-i, --ignore [ignore...]', 'ignore patterns')
  .action(async (source: string, build: string, options: Options) => {
    const swcrcFilepath = isLocalFile.test(options.swcrc) ? Path.resolve(options.swcrc) : options.swcrc;
    const swcrcConfig = await fileExists(swcrcFilepath) ? JSON.parse(await Fs.readFile(swcrcFilepath, 'utf-8')) : defaultSwcrc;
    const swcrcCJS = patchCJS(swcrcConfig);
    const swcrcMJS = patchMJS(swcrcConfig);

    const sourceDir = Path.resolve(source);
    const buildDir = Path.resolve(build);
    const sourceFiles = await glob(`**/*.ts`, { ignore: options.ignore, cwd: sourceDir });

    for (const filename of sourceFiles) {
      const sourceFile = `${sourceDir}/${filename}`;
      const destinationFileCjs = `${buildDir}/${filename.replace(/\.ts$/, '')}.cjs`;
      const destinationFileMjs = `${buildDir}/${filename.replace(/\.ts$/, '')}.js`;
      await compile(sourceFile, destinationFileCjs, swcrcCJS).catch((e) => {
        console.error(`Error compiling ${filename} to CommonJS`, e)
      });
      await compile(sourceFile, destinationFileMjs, swcrcMJS).catch((e) => {
        console.error(`Error compiling ${filename} to ESM`, e)
      });
    }
  });

  commander.parse(process.argv);
