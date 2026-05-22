import { z } from 'zod';
import { GENDERS } from '../../../domain/value-objects/gender';

/** Optional gender; accepts `null` to clear on update. */
export const optionalGenderSchema = z.enum(GENDERS).optional().nullable();
