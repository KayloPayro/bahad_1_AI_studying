import { mountModule } from '@lumda/engine';
import type { ModuleContent } from '@lumda/schema';
import content from '../content.json';

mountModule(content as unknown as ModuleContent);
