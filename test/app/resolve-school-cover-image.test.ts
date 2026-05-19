import { describe, expect, it } from 'vitest';
import { SchoolImage } from '../../src/domain/entities/school-image';
import { SchoolImageCategory } from '../../src/domain/value-objects/school-image-category';
import { resolveSchoolCoverImage } from '../../src/app/utils/resolve-school-cover-image';

function makeImage(category: SchoolImageCategory, key: string) {
    return SchoolImage.create({
        id: `img-${key}`,
        schoolId: 'school-1',
        key,
        contentType: 'image/png',
        originalFileName: 'f.png',
        category
    });
}

describe('resolveSchoolCoverImage', () => {
    it('prefers COVER over BANNER', () => {
        const images = [
            makeImage(SchoolImageCategory.BANNER, 'banner'),
            makeImage(SchoolImageCategory.COVER, 'cover')
        ];
        expect(resolveSchoolCoverImage(images)?.key).toBe('cover');
    });

    it('uses BANNER when COVER is missing', () => {
        const images = [
            makeImage(SchoolImageCategory.LOGO, 'logo'),
            makeImage(SchoolImageCategory.BANNER, 'banner')
        ];
        expect(resolveSchoolCoverImage(images)?.key).toBe('banner');
    });

    it('returns undefined when only logo exists', () => {
        const images = [makeImage(SchoolImageCategory.LOGO, 'logo')];
        expect(resolveSchoolCoverImage(images)).toBeUndefined();
    });
});
