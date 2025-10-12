import type { z } from 'zod';
import { addressSchema, courseCategorySchema } from '../../validators/school-schemas';

type AddressInput = z.infer<typeof addressSchema>;
type CategoryInput = z.infer<typeof courseCategorySchema>;

export function mapAddresses(addresses?: AddressInput[]) {
    return addresses?.map((address) => ({
        street: address.street,
        number: address.number,
        complement: address.complement ?? null,
        district: address.district ?? null,
        city: address.city,
        state: address.state,
        zipCode: address.zipCode
    }));
}

export function mapCourseCategories(categories?: CategoryInput[]) {
    return categories?.map((category) => ({
        categoryId: category.categoryId,
        subcategoryIds: category.subcategoryIds ?? []
    }));
}
