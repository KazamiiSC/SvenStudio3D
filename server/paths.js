/** Absolute project paths, independent of the process working directory. */
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const PROJECT_ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const projectPath=(...parts)=>path.join(PROJECT_ROOT,...parts);
