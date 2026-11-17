import type { ModuleContent } from '@lumda/schema';

/** Every module's content.json, read at build time. The home page and staff page list them from here. */
const files = import.meta.glob('../../../modules/*/content.json', { eager: true, import: 'default' }) as Record<
  string,
  ModuleContent
>;

export const MODULES: ModuleContent[] = Object.values(files).sort((a, b) => a.id.localeCompare(b.id));
