import { AppDataSource } from './datasource';
import { DiscountCouponRepository } from '../../../ports/repositories/discount-coupon.repo';
import { DiscountCoupon } from '../../../domain/entities/discount-coupon';
import { DiscountCouponOrm } from './entities/discount-coupon.orm';
import { IsNull } from 'typeorm';

export class DiscountCouponRepositoryAdapter implements DiscountCouponRepository {
    private readonly repo = AppDataSource.getRepository(DiscountCouponOrm);

    async save(coupon: DiscountCoupon): Promise<void> {
        await this.repo.save(this.toOrm(coupon));
    }

    async findByCode(code: string): Promise<DiscountCoupon | null> {
        const normalizedCode = code.trim().toUpperCase();
        const row = await this.repo.findOne({
            where: { code: normalizedCode, deletedAt: IsNull() }
        });
        return row ? this.toDomain(row) : null;
    }

    async findById(id: string): Promise<DiscountCoupon | null> {
        const row = await this.repo.findOne({
            where: { id, deletedAt: IsNull() }
        });
        return row ? this.toDomain(row) : null;
    }

    async findAll(): Promise<DiscountCoupon[]> {
        const rows = await this.repo.find({
            where: { deletedAt: IsNull() },
            order: { createdAt: 'DESC' }
        });
        return rows.map(row => this.toDomain(row));
    }

    async delete(id: string): Promise<void> {
        const coupon = await this.findById(id);
        if (coupon) {
            coupon.markAsDeleted();
            await this.save(coupon);
        }
    }

    private toDomain(row: DiscountCouponOrm): DiscountCoupon {
        return DiscountCoupon.create({
            id: row.id,
            code: row.code,
            percentage: Number(row.percentage),
            validUntil: new Date(row.validUntil),
            durationMonths: row.durationMonths,
            isActive: row.isActive === 1,
            createdAt: new Date(row.createdAt),
            deletedAt: row.deletedAt ? new Date(row.deletedAt) : null
        });
    }

    private toOrm(coupon: DiscountCoupon): DiscountCouponOrm {
        const row = new DiscountCouponOrm();
        row.id = coupon.id;
        row.code = coupon.code;
        row.percentage = coupon.percentage;
        row.validUntil = coupon.validUntil;
        row.durationMonths = coupon.durationMonths;
        row.isActive = coupon.isActive ? 1 : 0;
        row.createdAt = coupon.createdAt;
        row.deletedAt = coupon.deletedAt;
        return row;
    }
}

