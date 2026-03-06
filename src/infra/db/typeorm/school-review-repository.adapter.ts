import { AppDataSource } from './datasource';
import { SchoolReviewRepository, SchoolReviewWithUserInfo } from '../../../ports/repositories/school-review.repo';
import { SchoolReview } from '../../../domain/entities/school-review';
import { SchoolReviewOrm } from './entities/school-review.orm';

export class SchoolReviewRepositoryAdapter implements SchoolReviewRepository {
    private readonly repo = AppDataSource.getRepository(SchoolReviewOrm);

    async findMany(params: {
        schoolId: string;
        limit?: number;
        offset?: number;
    }): Promise<SchoolReviewWithUserInfo[]> {
        const qb = this.repo
            .createQueryBuilder('review')
            .innerJoinAndSelect('review.user', 'user')
            .where('review.schoolId = :schoolId', { schoolId: params.schoolId })
            .orderBy('review.createdAt', 'DESC');

        const limit = params.limit ?? 50;
        qb.take(Math.max(1, Math.min(limit, 100)));

        if (typeof params.offset === 'number' && params.offset > 0) {
            qb.skip(params.offset);
        }

        const rows = await qb.getMany();
        return rows.map((row) => ({
            review: this.toDomain(row),
            studentName: row.user.fullName,
            studentPhotoUrl: row.user.photoUrl ?? null
        }));
    }

    async findByUserAndSchool(userId: string, schoolId: string): Promise<SchoolReview | null> {
        const row = await this.repo.findOne({
            where: { userId, schoolId }
        });
        return row ? this.toDomain(row) : null;
    }

    async getAverageRatingBySchoolIds(schoolIds: string[]): Promise<Array<{ schoolId: string; averageRating: number; count: number }>> {
        if (schoolIds.length === 0) return [];
        const rows = await this.repo
            .createQueryBuilder('review')
            .select('review.school_id', 'schoolId')
            .addSelect('AVG(review.rating)', 'averageRating')
            .addSelect('COUNT(review.id)', 'count')
            .where('review.school_id IN (:...schoolIds)', { schoolIds })
            .groupBy('review.school_id')
            .getRawMany<{ schoolId?: string; school_id?: string; averageRating: string; count: string }>();
        return rows.map((r) => {
            const id = r.schoolId ?? r.school_id ?? '';
            return {
                schoolId: id,
                averageRating: Math.round(Number(r.averageRating) * 10) / 10,
                count: Number(r.count)
            };
        });
    }

    async save(review: SchoolReview): Promise<void> {
        await this.repo.save(this.toOrm(review));
    }

    private toDomain(row: SchoolReviewOrm): SchoolReview {
        return SchoolReview.create({
            id: row.id,
            schoolId: row.schoolId,
            userId: row.userId,
            rating: row.rating,
            description: row.description,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
        });
    }

    private toOrm(review: SchoolReview): SchoolReviewOrm {
        const orm = new SchoolReviewOrm();
        orm.id = review.id;
        orm.schoolId = review.schoolId;
        orm.userId = review.userId;
        orm.rating = review.rating;
        orm.description = review.description;
        orm.createdAt = review.createdAt;
        orm.updatedAt = review.updatedAt;
        return orm;
    }
}

