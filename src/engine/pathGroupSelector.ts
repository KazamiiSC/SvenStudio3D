import type {Project} from './types';
import type {PathStructureRecord} from './pathStructures';

/**
 * Zustand / React's useSyncExternalStore requires selectors to return the
 * same snapshot reference while the store is unchanged.  An inline fallback
 * such as `project.pathGroups || []` creates a new array on every read and can
 * trigger an infinite update loop for projects without saved routes.
 *
 * Keep the absent-case array shared, but return the original array whenever
 * routes exist so normal updates remain reactive.
 */
const EMPTY_PATH_GROUPS: readonly PathStructureRecord[] = Object.freeze([]);

export function selectPathGroups(project: Pick<Project, 'pathGroups'>): readonly PathStructureRecord[] {
  return project.pathGroups ?? EMPTY_PATH_GROUPS;
}
