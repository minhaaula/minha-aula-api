import type { SchoolImage } from '../../domain/entities/school-image';
import { SchoolImageCategory } from '../../domain/value-objects/school-image-category';

/**
 * Imagem de capa da escola: COVER (capa) ou BANNER (banner/capa no painel da escola).
 */
export function resolveSchoolCoverImage(images: SchoolImage[]): SchoolImage | undefined {
    return (
        images.find((img) => img.category === SchoolImageCategory.COVER) ??
        images.find((img) => img.category === SchoolImageCategory.BANNER)
    );
}
