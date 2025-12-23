import { AppDataSource } from './datasource';
import { SchoolImageRepository } from '../../../ports/repositories/school-image.repo';
import { SchoolImage } from '../../../domain/entities/school-image';
import { SchoolImageCategory } from '../../../domain/value-objects/school-image-category';
import { SchoolImageOrm } from './entities/school-image.orm';

export class SchoolImageRepositoryAdapter implements SchoolImageRepository {
    private readonly repo = AppDataSource.getRepository(SchoolImageOrm);

    async save(image: SchoolImage): Promise<void> {
        await this.repo.save(this.toOrm(image));
    }

    async findBySchoolId(schoolId: string, category?: SchoolImageCategory): Promise<SchoolImage[]> {
        const where: any = { schoolId };
        if (category) {
            where.category = category;
        }
        const rows = await this.repo.find({
            where,
            order: { createdAt: 'DESC' }
        });
        return rows.map(row => this.toDomain(row));
    }

    async findById(id: string): Promise<SchoolImage | null> {
        const row = await this.repo.findOne({ where: { id } });
        return row ? this.toDomain(row) : null;
    }

    async delete(id: string): Promise<void> {
        await this.repo.delete(id);
    }

    private toDomain(row: SchoolImageOrm): SchoolImage {
        return SchoolImage.create({
            id: row.id,
            schoolId: row.schoolId,
            key: row.key,
            contentType: row.contentType,
            originalFileName: row.originalFileName,
            category: row.category as SchoolImageCategory,
            createdAt: new Date(row.createdAt)
        });
    }

    private toOrm(image: SchoolImage): SchoolImageOrm {
        const row = new SchoolImageOrm();
        row.id = image.id;
        row.schoolId = image.schoolId;
        row.key = image.key;
        row.contentType = image.contentType;
        row.originalFileName = image.originalFileName;
        row.category = image.category;
        row.createdAt = image.createdAt;
        return row;
    }
}

