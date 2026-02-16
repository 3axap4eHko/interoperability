import { parentPort } from 'node:worker_threads';
import { transformFile } from './utils.js';

parentPort!.on('message', async (task) => {
  const modules = new Set<string>();
  try {
    await transformFile(task.sourceFile, task.destinationFile, task.config, task.extension, modules);
    parentPort!.postMessage({ modules: [...modules] });
  } catch (e) {
    parentPort!.postMessage({
      error: e instanceof Error ? e.message : String(e),
      filename: task.filename,
      format: task.format,
    });
  }
});

