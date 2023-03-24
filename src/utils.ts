import * as Path from 'path';
import * as Fs from 'fs/promises';
import * as swc from '@swc/core';

export const isLocalFile = /^\.{0,2}\//;

type ExportImportDeclaration = swc.ExportAllDeclaration | swc.ExportNamedDeclaration | swc.ImportDeclaration | swc.ExportDefaultExpression;

const not = (value : unknown) => !value;

export const fileExists = (filename: string) => {
  return Fs.access(filename, Fs.constants.R_OK).catch(Boolean).then(not);
}

export const isFileExportImport = (node: swc.ModuleItem | swc.Statement): node is ExportImportDeclaration => {
  switch(node.type) {
    case 'ExportAllDeclaration':
    case 'ExportNamedDeclaration':
    case 'ImportDeclaration':
      return node.source?.type === 'StringLiteral' && Path.extname(node.source.value) === '' && isLocalFile.test(node.source.value);
    case 'ExportDefaultExpression':
      return node.expression?.type === 'StringLiteral' && Path.extname(node.expression.value) === '' && isLocalFile.test(node.expression.value);
  }
  return false;
};

export const setNodeExtension = (node: swc.StringLiteral, extenstion: string) => {
  node.value = `${node.value}.${extenstion}`;
  node.raw = JSON.stringify(node.value);
};

export const forceExtension = (module: swc.Program, extenstion: string) => {
  for (const node of module.body) {
    if (isFileExportImport(node)) {
      if (node.type === 'ExportDefaultExpression') {
        if (node.expression.type === 'StringLiteral') {
          setNodeExtension(node.expression, extenstion);
        }
      } else if (node.source?.type === 'StringLiteral') {
        setNodeExtension(node.source, extenstion);
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

export const compile = async (sourceFile: string, destinationFile: string, config: Config) => {
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
}


