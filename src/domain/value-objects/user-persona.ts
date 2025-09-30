export const USER_PERSONAS = ['ADMIN', 'SCHOOL', 'STUDENT', 'OPERATION'] as const;

export type UserPersona = typeof USER_PERSONAS[number];

export enum UserPersonaEnum {
    ADMIN = 'ADMIN',
    SCHOOL = 'SCHOOL',
    STUDENT = 'STUDENT',
    OPERATION = 'OPERATION'
}

export function isUserPersona(value: string): value is UserPersona {
    return USER_PERSONAS.includes(value as UserPersona);
}

export function assertUserPersona(value: string): asserts value is UserPersona {
    if (!isUserPersona(value)) {
        throw new Error(`Invalid user persona: ${value}`);
    }
}
