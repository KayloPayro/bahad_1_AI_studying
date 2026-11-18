import { mountModule } from '@lumda/engine';
import type { ModuleContent } from '@lumda/schema';
import content from '../content.json';
import { Review, Shift } from './steps';

mountModule(content as unknown as ModuleContent, { plugins: { 'l12-shift': Shift, 'l12-review': Review } });
