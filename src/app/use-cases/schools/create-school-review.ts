import { SchoolRepository } from '../../../ports/repositories/school.repo';
import { EnrollmentRepository } from '../../../ports/repositories/enrollment.repo';
import { SchoolReviewRepository } from '../../../ports/repositories/school-review.repo';
import { SchoolReview } from '../../../domain/entities/school-review';
import { Uuid } from '../../../shared/uuid';
import { AppError, ErrorCode } from '../../../shared/errors';

export interface CreateSchoolReviewInput {
    schoolId: string;
    userId: string;
    rating: number;
    description?: string | null;
}

export interface CreateSchoolReviewOutput {
    id: string;
    schoolId: string;
    userId: string;
    rating: number;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export class CreateSchoolReview {
    constructor(
        private readonly schools: SchoolRepository,
        private readonly enrollments: EnrollmentRepository,
        private readonly reviews: SchoolReviewRepository
    ) {}

    async exec(input: CreateSchoolReviewInput): Promise<CreateSchoolReviewOutput> {
        const schoolId = input.schoolId.trim();
        const userId = input.userId.trim();

        // Validar escola
        const school = await this.schools.findById(schoolId);
        if (!school) {
            throw AppError.fromCode(ErrorCode.SCHOOL_NOT_FOUND, { schoolId });
        }

        // Validar se o usuário ou algum dependente está matriculado na escola
        if (!this.enrollments.hasActiveEnrollmentInSchool) {
            throw AppError.fromCode(ErrorCode.INTERNAL_ERROR, {
                message: 'Método hasActiveEnrollmentInSchool não está disponível'
            });
        }

        const hasEnrollment = await this.enrollments.hasActiveEnrollmentInSchool(schoolId, userId);
        if (!hasEnrollment) {
            throw AppError.fromCode(ErrorCode.NOT_ENROLLED_IN_SCHOOL, {
                schoolId,
                userId
            });
        }

        // Verificar se o usuário já avaliou esta escola
        if (this.reviews.findByUserAndSchool) {
            const existingReview = await this.reviews.findByUserAndSchool(userId, schoolId);
            if (existingReview) {
                throw AppError.fromCode(ErrorCode.REVIEW_ALREADY_EXISTS, {
                    schoolId,
                    userId
                });
            }
        }

        // Validar rating
        if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
            throw AppError.validation('A nota deve ser um número inteiro entre 1 e 5', {
                rating: input.rating
            });
        }

        // Normalizar descrição
        const description = input.description?.trim() || null;

        // Criar avaliação
        const review = SchoolReview.create({
            id: Uuid(),
            schoolId: school.id,
            userId,
            rating: input.rating,
            description
        });

        await this.reviews.save(review);

        return {
            id: review.id,
            schoolId: review.schoolId,
            userId: review.userId,
            rating: review.rating,
            description: review.description,
            createdAt: review.createdAt,
            updatedAt: review.updatedAt
        };
    }
}
