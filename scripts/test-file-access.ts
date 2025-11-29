#!/usr/bin/env tsx
/**
 * Teste de acesso aos arquivos no Railway Storage
 * Verifica se as URLs geradas são acessíveis
 */

import 'dotenv/config';
import { S3StorageProvider } from '../src/infra/providers/s3/storage-provider';

async function testFileAccess() {
    console.log('🔍 Teste de Acesso aos Arquivos - Railway Storage\n');

    const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID;
    const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY;
    const region = process.env.STORAGE_REGION || 'us-east-1';
    const bucket = process.env.STORAGE_BUCKET;
    const endpoint = process.env.STORAGE_ENDPOINT;

    if (!accessKeyId || !secretAccessKey || !bucket || !endpoint) {
        console.error('❌ Variáveis de ambiente não configuradas');
        process.exit(1);
    }

    try {
        const storage = new S3StorageProvider({
            accessKeyId,
            secretAccessKey,
            region: region === 'auto' ? 'us-east-1' : region,
            bucket,
            endpoint,
            forcePathStyle: true
        });

        // Upload de um arquivo de teste
        console.log('📤 Fazendo upload de arquivo de teste...');
        const testContent = Buffer.from('Conteúdo de teste - ' + new Date().toISOString());
        const uploadResult = await storage.uploadFile({
            file: testContent,
            fileName: `access-test-${Date.now()}.txt`,
            contentType: 'text/plain',
            folder: 'test'
        });
        console.log('✅ Upload realizado');
        console.log(`   Key: ${uploadResult.key}`);
        console.log(`   URL direta: ${uploadResult.url}\n`);

        // Obter signed URL
        console.log('🔗 Gerando signed URL...');
        const signedUrl = await storage.getFileUrl(uploadResult.key, 3600);
        console.log('✅ Signed URL gerada');
        console.log(`   URL: ${signedUrl.substring(0, 100)}...\n`);

        // Testar acesso à URL direta (pode falhar)
        console.log('🌐 Teste 1: Acessando URL direta...');
        try {
            const directResponse = await fetch(uploadResult.url);
            if (directResponse.ok) {
                const content = await directResponse.text();
                console.log('✅ URL direta funciona!');
                console.log(`   Conteúdo: ${content.substring(0, 50)}...\n`);
            } else {
                console.log(`❌ URL direta não funciona (Status: ${directResponse.status})`);
                console.log('   Isso é esperado - Railway Storage requer signed URLs\n');
            }
        } catch (error: any) {
            console.log(`❌ Erro ao acessar URL direta: ${error.message}`);
            console.log('   Isso é esperado - Railway Storage requer signed URLs\n');
        }

        // Testar acesso à signed URL
        console.log('🌐 Teste 2: Acessando signed URL...');
        try {
            const signedResponse = await fetch(signedUrl);
            if (signedResponse.ok) {
                const content = await signedResponse.text();
                console.log('✅ Signed URL funciona!');
                console.log(`   Conteúdo: ${content.substring(0, 50)}...\n`);
                console.log('🎉 Arquivo acessível via signed URL!\n');
            } else {
                console.log(`❌ Signed URL não funciona (Status: ${signedResponse.status})`);
                console.log(`   Resposta: ${await signedResponse.text()}\n`);
            }
        } catch (error: any) {
            console.log(`❌ Erro ao acessar signed URL: ${error.message}\n`);
        }

        // Limpar
        console.log('🗑️  Deletando arquivo de teste...');
        await storage.deleteFile(uploadResult.key);
        console.log('✅ Arquivo deletado\n');

        console.log('📝 Conclusão:');
        console.log('   - Use sempre signed URLs para acessar arquivos no Railway Storage');
        console.log('   - URLs diretas não funcionam (bucket privado)');
        console.log('   - Signed URLs expiram após o tempo configurado (padrão: 1 hora)');

    } catch (error: any) {
        console.error('❌ Erro:', error.message);
        process.exit(1);
    }
}

testFileAccess();

