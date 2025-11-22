export interface SendEmailInput {
    to: string;
    subject: string;
    html: string;
    text?: string;
}

export interface EmailProviderPort {
    sendEmail(input: SendEmailInput): Promise<void>;
}

