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
    save(review: SchoolReview): Promise<void>;
}

