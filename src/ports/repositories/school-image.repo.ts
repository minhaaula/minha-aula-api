import { SchoolImage } from '../../domain/entities/school-image';
import { SchoolImageCategory } from '../../domain/value-objects/school-image-category';

export interface SchoolImageRepository {
    save(image: SchoolImage): Promise<void>;
    findBySchoolId(schoolId: string, category?: SchoolImageCategory): Promise<SchoolImage[]>;
    findById(id: string): Promise<SchoolImage | null>;
    delete(id: string): Promise<void>;
}

