export enum SchoolImageCategory {
    GALLERY = 'GALLERY',
    LOGO = 'LOGO',
    BANNER = 'BANNER',
    COVER = 'COVER',
    OTHER = 'OTHER'
}

export function isValidSchoolImageCategory(value: string): value is SchoolImageCategory {
    return Object.values(SchoolImageCategory).includes(value as SchoolImageCategory);
}

export function normalizeSchoolImageCategory(value?: string | null): SchoolImageCategory {
    if (!value) return SchoolImageCategory.GALLERY; // Default
    
    const upperValue = value.toUpperCase().trim();
    if (isValidSchoolImageCategory(upperValue)) {
        return upperValue as SchoolImageCategory;
    }
    
    return SchoolImageCategory.OTHER;
}

