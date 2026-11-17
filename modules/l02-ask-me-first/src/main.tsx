import { mountModule } from '@lumda/engine';
import type { ModuleContent } from '@lumda/schema';
import content from '../content.json';
import { Summary, Unasked } from './steps';

mountModule(content as unknown as ModuleContent, {
  plugins: { unasked: Unasked, 'l02-summary': Summary },
});
