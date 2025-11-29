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

