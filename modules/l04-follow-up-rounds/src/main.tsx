import { mountModule } from '@lumda/engine';
import type { ModuleContent } from '@lumda/schema';
import content from '../content.json';
import { Progress } from './steps';

mountModule(content as unknown as ModuleContent, { plugins: { 'l04-progress': Progress } });
