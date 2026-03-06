import { SchoolReview } from '../../domain/entities/school-review';

export interface SchoolReviewWithUserInfo {
    review: SchoolReview;
    studentName: string;
    studentPhotoUrl: string | null;
}

export interface SchoolReviewRepository {
    findMany(params: {
        schoolId: string;
        limit?: number;
        offset?: number;
    }): Promise<SchoolReviewWithUserInfo[]>;
    findByUserAndSchool?(userId: string, schoolId: string): Promise<SchoolReview | null>;
    save(review: SchoolReview): Promise<void>;
    /** Média de avaliação (1 a 5) por escola; retorna apenas escolas que têm pelo menos uma avaliação. */
    getAverageRatingBySchoolIds?(schoolIds: string[]): Promise<Array<{ schoolId: string; averageRating: number; count: number }>>;
}

