/**
 * Port para envio de emails de notificação (boas-vindas, matrícula, etc.).
 * Use cases podem depender desta interface para enviar emails sem acoplar à infra.
 */

export interface WelcomeSchoolEmailData {
    to: string;
    schoolName: string;
    schoolEmail: string;
    ownerName?: string;
    loginUrl?: string;
}

export interface WelcomeStudentEmailData {
    to: string;
    userName: string;
    userEmail?: string;
    loginUrl?: string;
}

export interface EnrollmentConfirmationEmailData {
    to: string;
    studentName: string;
    courseName: string;
    schoolName: string;
    className?: string;
    loginUrl?: string;
}

export interface NotificationEmailPort {
    sendWelcomeSchoolEmail(data: WelcomeSchoolEmailData): Promise<void>;
    sendWelcomeStudentEmail(data: WelcomeStudentEmailData): Promise<void>;
    sendEnrollmentConfirmationEmail(data: EnrollmentConfirmationEmailData): Promise<void>;
}
