import * as Path from 'node:path';
import * as Fs from 'node:fs/promises';
import { Worker } from 'node:worker_threads';
import * as os from 'node:os';
import * as swc from '@swc/core';
import glob from 'fast-glob';

export const isLocalFile = /^(\.|\/)/;

export const RENAME_EXTENSION = ['', '.js', '.cjs', '.mjs', '.ts', '.cts', '.mts'];

export const fileNotExist = async (filename: string) => {
  return Fs.access(filename, Fs.constants.R_OK).catch(Boolean);
}

export const readJSON = async (filename: string) => {
  return JSON.parse(await Fs.readFile(filename, 'utf-8'));
}

export const writeJSON = async (filename: string, data: unknown, indent = 2) => {
  return await Fs.writeFile(filename, JSON.stringify(data, null, indent) + '\n');
}

export const setNodeExtension = (node: swc.StringLiteral, extension: string) => {
  const path = Path.parse(node.value);
  if (RENAME_EXTENSION.includes(path.ext)) {
    node.value = Path.format({ ...path, base: '', ext: extension });
    node.raw = JSON.stringify(node.value);
  }
};

export const visitModule = (program: swc.Module, extension: string, modules: Set<string>) => {
  for (const item of program.body) {
    if ('source' in item && item.source?.type === 'StringLiteral') {
      if (isLocalFile.test(item.source.value)) {
        setNodeExtension(item.source, extension);
      } else {
        const moduleName = item.source.value.split('/').slice(
          0,
          item.source.value.startsWith('@') ? 2 : 1,
        ).join('/');
        modules.add(moduleName);
      }
    }
    if ('expression' in item && item.expression?.type === 'StringLiteral' && isLocalFile.test(item.expression.value)) {
      setNodeExtension(item.expression, extension);
    }
  }
};

export const transformFile = async (sourceFile: string, destinationFile: string, config: swc.Options, extension: string, modules: Set<string>) => {
  const isTsx = /\.[jt]sx$/.test(sourceFile);
  const destinationMapFile = `${destinationFile}.map`;
  const ast = await swc.parseFile(sourceFile, {
    ...config?.jsc?.parser,
    syntax: 'typescript',
    tsx: (config?.jsc?.parser as swc.TsParserConfig | undefined)?.tsx ?? isTsx,
  } as swc.TsParserConfig);
  visitModule(ast, extension, modules);
  const output = await swc.transform(ast, {
    ...config,
    filename: sourceFile,
    isModule: true,
    sourceMaps: true,
  });

  await Fs.mkdir(Path.dirname(destinationFile), { recursive: true });
  await Fs.writeFile(destinationFile, `${output.code}\n//# sourceMappingURL=${Path.basename(destinationMapFile)}\n`);
  const map = JSON.parse(output.map || '');
  map.sources[0] = Path.relative(Path.dirname(destinationFile), sourceFile);
  await Fs.writeFile(destinationMapFile, JSON.stringify(map));
};

interface TransformCommandOptions {
  type: string;
  match: string;
  swcrc: string;
  ignore: string[];
  commonjsExt: string;
  skipCommonjs: boolean;
  esmExt: string;
  skipEsm: boolean;
  package?: boolean;
  copy?: boolean;
}

const defaultSwcrc: swc.Config = {
  module: {
    type: 'es6',
  },
  jsc: {
    target: 'es2024',
    parser: {
      syntax: 'typescript',
    },
  },
};

export const patchPackageJSON = async ({ name, version, description, main }: Record<string, string>, buildDir: string, sourceDir: string, sourceFiles: string[], options: TransformCommandOptions) => {
  const mainFile = Path.parse(main);
  return {
    name,
    description,
    version,
    type: 'module',
    types: Path.format({ ...mainFile, base: '', ext: '.d.ts' }),
    main: Path.format({ ...mainFile, base: '', ext: options.commonjsExt }),
    module: Path.format({ ...mainFile, base: '', ext: options.esmExt }),
    exports: {
      require: Path.format({ ...mainFile, dir: `./${mainFile.dir}`, base: '', ext: options.commonjsExt }),
      import: Path.format({ ...mainFile, dir: `./${mainFile.dir}`, base: '', ext: options.esmExt }),
    },
    files: [
      Path.relative(process.cwd(), buildDir),
      ...sourceFiles.map(file => Path.relative(process.cwd(), `${sourceDir}/${file}`)),
    ],
  };
};

interface WorkerTask {
  sourceFile: string;
  destinationFile: string;
  config: swc.Options;
  extension: string;
  filename: string;
  format: string;
}

interface WorkerResult {
  modules?: string[];
  error?: string;
  filename?: string;
  format?: string;
}

const workerUrl = new URL('./worker.js', import.meta.url);

const runWorkerPool = (tasks: WorkerTask[], modules: Set<string>) => {
  if (tasks.length === 0) return Promise.resolve();

  const poolSize = Math.min(tasks.length, os.availableParallelism?.() ?? os.cpus().length);

  return new Promise<void>((resolve, reject) => {
    const workers: Worker[] = [];
    let taskIndex = 0;
    let completed = 0;
    let rejected = false;

    const cleanup = () => {
      for (const w of workers) w.terminate();
    };

    for (let i = 0; i < poolSize; i++) {
      const worker = new Worker(workerUrl);
      workers.push(worker);

      const dispatch = () => {
        if (taskIndex < tasks.length) {
          worker.postMessage(tasks[taskIndex++]);
        } else {
          worker.terminate();
        }
      };

      worker.on('message', (result: WorkerResult) => {
        if (result.error) {
          console.error(`Error compiling ${result.filename} to ${result.format}`, result.error);
        } else if (result.modules) {
          for (const m of result.modules) modules.add(m);
        }
        completed++;
        if (completed === tasks.length) {
          cleanup();
          resolve();
        } else {
          dispatch();
        }
      });

      worker.on('error', (err) => {
        if (!rejected) {
          rejected = true;
          cleanup();
          reject(err);
        }
      });

      dispatch();
    }
  });
};

export const transformCommand = async (source: string, build: string, options: TransformCommandOptions) => {
  const swcrcFilepath = isLocalFile.test(options.swcrc) ? Path.resolve(options.swcrc) : options.swcrc;
  const swcrcConfig: swc.Config = await fileNotExist(swcrcFilepath) ? defaultSwcrc : await readJSON(swcrcFilepath);
  const swcrcCJS: swc.Options = {
    ...swcrcConfig,
    module: {
      strict: true,
      ...swcrcConfig?.module,
      type: 'commonjs',
    },
  };
  const modules = new Set<string>();
  const swcrcMJS: swc.Options = {
    ...swcrcConfig,
    module: {
      ...swcrcConfig?.module,
      type: 'es6',
    },
  };
  const sourceDir = Path.resolve(source);
  const buildDir = Path.resolve(build);
  const match = options.match ? options.match : (options.type === 'ts' ? '**/*.ts(x)?' : '**/*.js(x)?');
  const sourceFiles = await glob(match, { ignore: options.ignore, cwd: sourceDir });

  const tasks: WorkerTask[] = [];
  for (const filename of sourceFiles) {
    const sourceFile = `${sourceDir}/${filename}`;
    const base = `${buildDir}/${filename.replace(/\.[jt]s(x)?$/, '')}`;
    if (!options.skipEsm) {
      tasks.push({ sourceFile, destinationFile: `${base}${options.esmExt}`, config: swcrcMJS, extension: options.esmExt, filename, format: 'ESM' });
    }
    if (!options.skipCommonjs) {
      tasks.push({ sourceFile, destinationFile: `${base}${options.commonjsExt}`, config: swcrcCJS, extension: options.commonjsExt, filename, format: 'CommonJS' });
    }
  }

  await runWorkerPool(tasks, modules);

  if (options.package) {
    const packageJSONPath = Path.resolve('./package.json');
    const packageJSONTargetPath = options.copy
      ? Path.resolve(buildDir, './package.json')
      : packageJSONPath;

    if (await fileNotExist(packageJSONPath)) {
      throw new Error(`File package.json not found at ${packageJSONPath}`);
    }

    const { name, version, description, main, dependencies, devDependencies, ...rest } = await readJSON(packageJSONPath);
    if (await fileNotExist(main)) {
      throw new Error(`File ${main} of "main" section in package.json not found`);
    }

    if (options.copy) {
      const deps = { ...devDependencies, ...dependencies };
      rest.dependencies = {};
      for (const moduleName of [...modules].sort()) {
        if (deps[moduleName]) {
          rest.dependencies[moduleName] = deps[moduleName];
        }
      }
    } else {
      rest.dependencies = dependencies;
      rest.devDependencies = devDependencies;
    }

    const patchedPackageJSON = await patchPackageJSON({ name, version, description, main }, buildDir, sourceDir, sourceFiles, options);
    await writeJSON(packageJSONTargetPath, { ...patchedPackageJSON, ...rest });
  }
};
