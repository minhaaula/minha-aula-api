export interface UploadFileInput {
    file: Buffer;
    fileName: string;
    contentType: string;
    folder?: string;
}

export interface UploadFileOutput {
    url: string;
    key: string;
}

export interface StorageProviderPort {
    uploadFile(input: UploadFileInput): Promise<UploadFileOutput>;
    deleteFile(key: string): Promise<void>;
    getFileUrl(key: string, expiresIn?: number): Promise<string>;
}

