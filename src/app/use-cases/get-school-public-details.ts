import { SchoolRepository } from '../../ports/repositories/school.repo';
import { type PostalAddressProps } from '../../domain/value-objects/postal-address';

export class GetSchoolPublicDetails {
    constructor(private readonly schools: SchoolRepository) {}

    async exec(input: { schoolId: string }): Promise<{
        id: string;
        name: string;
        email: string;
        phone: string;
        addresses: PostalAddressProps[];
        createdAt: Date;
    } | null> {
        const schoolId = input.schoolId.trim();
        if (!schoolId) return null;

        const school = await this.schools.findById(schoolId);
        if (!school) {
            return null;
        }

        return {
            id: school.id,
            name: school.name,
            email: school.email,
            phone: school.phone,
            addresses: school.addresses.map((address) => address.toPrimitives()),
            createdAt: school.createdAt
        };
    }
}

