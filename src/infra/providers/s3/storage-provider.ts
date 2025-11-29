// Storage provider usando AWS SDK v3 (compatível com Railway Storage)
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageProviderPort, UploadFileInput, UploadFileOutput } from '../../../ports/providers/storage-provider.port';

export interface S3StorageConfig {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    bucket: string;
    endpoint?: string;
    forcePathStyle?: boolean;
}

export class S3StorageProvider implements StorageProviderPort {
    private readonly s3Client: S3Client;
    private readonly bucket: string;
    private readonly endpoint?: string;

    constructor(config: S3StorageConfig) {
        this.bucket = config.bucket;
        this.endpoint = config.endpoint;

        const clientConfig: any = {
            // Railway Storage requer uma região válida, não "auto"
            region: config.region === 'auto' ? 'us-east-1' : (config.region || 'us-east-1'),
            credentials: {
                accessKeyId: config.accessKeyId,
                secretAccessKey: config.secretAccessKey
            }
        };

        // Para Railway Storage ou outros serviços S3-compatible
        if (config.endpoint) {
            clientConfig.endpoint = config.endpoint;
            clientConfig.forcePathStyle = config.forcePathStyle ?? true;
        }

        this.s3Client = new S3Client(clientConfig);
    }

    async uploadFile(input: UploadFileInput): Promise<UploadFileOutput> {
        const folder = input.folder ? `${input.folder}/` : '';
        const key = `${folder}${input.fileName}`;

        const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: input.file,
            ContentType: input.contentType
        });

        await this.s3Client.send(command);

        // Retornar URL pública ou signed URL
        const url = await this.getFileUrl(key);

        return {
            url,
            key
        };
    }

    async deleteFile(key: string): Promise<void> {
        const command = new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: key
        });

        await this.s3Client.send(command);
    }

    async getFileUrl(key: string, expiresIn: number = 3600): Promise<string> {
        // Sempre usar signed URLs para garantir acesso aos arquivos
        // Railway Storage não permite acesso público direto por padrão
        const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: key
        });

        // URL válida por padrão 1 hora (pode ser configurado)
        return await getSignedUrl(this.s3Client, command, { expiresIn });
    }
}

