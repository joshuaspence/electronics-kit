import type { Level } from '../core/levels';
import { chapter1 } from './chapter1';
import { chapter2 } from './chapter2';

export const levels: readonly Level[] = [...chapter1, ...chapter2];
