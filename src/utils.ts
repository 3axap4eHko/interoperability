import * as Path from 'path';
import * as Fs from 'fs/promises';
import * as swc from '@swc/core';
import glob from 'fast-glob';

export const isLocalFile = /^(\.|\/)/;

type ExportImportDeclaration = swc.ExportAllDeclaration | swc.ExportNamedDeclaration | swc.ImportDeclaration | swc.ExportDefaultExpression;

export const fileNotExist = async (filename: string) => {
  return Fs.access(filename, Fs.constants.R_OK).catch(Boolean);
}

export const readJSON = async (filename: string) => {
  return JSON.parse(await Fs.readFile(filename, 'utf-8'));
}

export const writeJSON = async (filename: string, data: unknown, indent = 2) => {
  return await Fs.writeFile(filename, JSON.stringify(data, null, indent));
}

export const hasFilePath = (node: swc.ModuleItem | swc.Statement): node is ExportImportDeclaration => {
  switch (node.type) {
    case 'ExportAllDeclaration':
    case 'ExportNamedDeclaration':
    case 'ImportDeclaration':
      return node.source?.type === 'StringLiteral' && Path.extname(node.source.value) === '' && isLocalFile.test(node.source.value);
    case 'ExportDefaultExpression':
      return node.expression?.type === 'StringLiteral' && Path.extname(node.expression.value) === '' && isLocalFile.test(node.expression.value);
  }
  return false;
};

export const setNodeExtension = (node: swc.StringLiteral, extension: string) => {
  node.value = `${node.value}.${extension}`;
  node.raw = JSON.stringify(node.value);
};

export const forceExtension = (module: swc.Program, extension: string) => {
  for (const node of module.body) {
    if (hasFilePath(node)) {
      if (node.type === 'ExportDefaultExpression') {
        if (node.expression.type === 'StringLiteral') {
          setNodeExtension(node.expression, extension);
        }
      } else if (node.source?.type === 'StringLiteral') {
        setNodeExtension(node.source, extension);
      }
    }
  }
  return module;
}

export const patchCJS = (config: swc.Config): Config => {
  return {
    ...config,
    module: {
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
      forceExtension(module, 'cjs');
      return module;
    },
  };
};
export const patchMJS = (config: swc.Config): Config => {
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
      forceExtension(module, 'js');
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
  const swcrcConfig = await fileNotExist(swcrcFilepath) ? defaultSwcrc : await readJSON(swcrcFilepath);
  const swcrcCJS = patchCJS(swcrcConfig);
  const swcrcMJS = patchMJS(swcrcConfig);

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
    if (await fileNotExist(packageJSONPath)) {
      throw new Error(`File package.json not found at ${packageJSONPath}`);
    }

    const { name, version, description, main, ...rest } = await readJSON(packageJSONPath);
    if (await fileNotExist(main)) {
      throw new Error(`File ${main} not found`);
    }

    const patchedPackageJSON = await patchPackageJSON({ name, version, description, main }, buildDir, sourceDir, sourceFiles, options);
    await writeJSON(packageJSONPath, { ...patchedPackageJSON, ...rest });
  }
};
