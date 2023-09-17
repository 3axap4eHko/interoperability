import * as Path from 'path';
import * as Fs from 'fs/promises';
import * as swc from '@swc/core';
import { Visitor } from '@swc/core/Visitor.js';
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

export class ModuleVisitor extends Visitor {
  public readonly modules = new Set<string>();

  constructor(public extension: string) {
    super();
  }

  visitModuleDeclaration(decl: swc.ModuleDeclaration) {
    if ('source' in decl) {
      if (decl.source?.type === 'StringLiteral') {
        if (isLocalFile.test(decl.source.value)) {
          setNodeExtension(decl.source, this.extension);
        } else {
          const moduleName = decl.source.value.split('/').slice(
            0,
            decl.source.value.startsWith('@') ? 2 : 1,
          ).join('/');
          this.modules.add(moduleName);
        }
      }
    }
    if ('expression' in decl) {
      if (decl.expression?.type === 'StringLiteral' && isLocalFile.test(decl.expression.value)) {
        setNodeExtension(decl.expression, this.extension);
      }
    }
    return super.visitModuleDeclaration(decl);
  }
  visitTsType(decl: swc.TsType) {
    return decl;
  }
}

export const patchCJS = (config: swc.Config, visitor: ModuleVisitor): Config => {
  return {
    ...config,
    module: {
      strict: true,
      ...config?.module,
      type: 'commonjs',
    },
    jsc: {
      ...config?.jsc,
      parser: {
        syntax: 'typescript',
        ...config?.jsc?.parser,
      }
    },
    plugin: (module: swc.Program) => {
      visitor.visitProgram(module);
      return module;
    },
  };
};
export const patchMJS = (config: swc.Config, visitor: ModuleVisitor): Config => {
  return {
    ...config,
    module: {
      ...config?.module,
      type: 'es6',
    },
    jsc: {
      ...config?.jsc,
      parser: {
        syntax: 'typescript',
        ...config?.jsc?.parser,
      }
    },
    plugin: (module: swc.Program) => {
      visitor.visitProgram(module);
      return module;
    },
  };
};

export interface Config extends swc.Options {

}

export const transformFile = async (sourceFile: string, destinationFile: string, config: Config) => {
  const destinationMapFile = `${destinationFile}.map`;
  const output = await swc.transformFile(sourceFile, {
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
    target: 'es2022',
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

export const transformCommand = async (source: string, build: string, options: TransformCommandOptions) => {
  const swcrcFilepath = isLocalFile.test(options.swcrc) ? Path.resolve(options.swcrc) : options.swcrc;
  const swcrcConfig: swc.Config = await fileNotExist(swcrcFilepath) ? defaultSwcrc : await readJSON(swcrcFilepath);
  const visitorCJS = new ModuleVisitor(options.commonjsExt);
  const swcrcCJS = patchCJS(swcrcConfig, visitorCJS);
  const visitorMJS = new ModuleVisitor(options.esmExt);
  const swcrcMJS = patchMJS(swcrcConfig, visitorMJS);

  const sourceDir = Path.resolve(source);
  const buildDir = Path.resolve(build);
  const sourceFiles = await glob(options.match, { ignore: options.ignore, cwd: sourceDir });

  for (const filename of sourceFiles) {
    const sourceFile = `${sourceDir}/${filename}`;
    if (!options.skipEsm) {
      const destinationFileMjs = `${buildDir}/${filename.replace(/\.ts$/, '')}${options.esmExt}`;
      await transformFile(sourceFile, destinationFileMjs, swcrcMJS).catch((e) => {
        console.error(`Error compiling ${filename} to ESM`, e)
      });
    }
    if (!options.skipCommonjs) {
      const destinationFileCjs = `${buildDir}/${filename.replace(/\.ts$/, '')}${options.commonjsExt}`;
      await transformFile(sourceFile, destinationFileCjs, swcrcCJS).catch((e) => {
        console.error(`Error compiling ${filename} to CommonJS`, e)
      });
    }
  }
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
      for (const moduleName of visitorMJS.modules) {
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
