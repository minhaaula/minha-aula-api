#!/usr/bin/env tsx
/**
 * Script para testar o Storage Provider (Railway Storage)
 * 
 * Uso:
 *   tsx scripts/test-storage.ts
 * 
 * Requisitos:
 *   - Variáveis de ambiente configuradas no .env:
 *     STORAGE_ACCESS_KEY_ID
 *     STORAGE_SECRET_ACCESS_KEY
 *     STORAGE_REGION
 *     STORAGE_BUCKET
 *     STORAGE_ENDPOINT
 */

import 'dotenv/config';
import { S3StorageProvider } from '../src/infra/providers/s3/storage-provider';

async function testStorage() {
    console.log('🧪 Testando Storage Provider (Railway Storage)\n');

    // Verificar variáveis de ambiente
    const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID;
    const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY;
    // Railway Storage geralmente funciona melhor com uma região específica
    const region = process.env.STORAGE_REGION || 'us-east-1';
    const bucket = process.env.STORAGE_BUCKET;
    const endpoint = process.env.STORAGE_ENDPOINT;

    console.log('📋 Configuração:');
    console.log(`   Access Key ID: ${accessKeyId ? '✅ Definido' : '❌ Não definido'}`);
    console.log(`   Secret Access Key: ${secretAccessKey ? '✅ Definido' : '❌ Não definido'}`);
    console.log(`   Region: ${region}`);
    console.log(`   Bucket: ${bucket || '❌ Não definido'}`);
    console.log(`   Endpoint: ${endpoint || '❌ Não definido'}\n`);

    if (!accessKeyId || !secretAccessKey || !bucket || !endpoint) {
        console.error('❌ Erro: Variáveis de ambiente não configuradas corretamente.');
        console.error('\nConfigure no .env:');
        console.error('STORAGE_ACCESS_KEY_ID=...');
        console.error('STORAGE_SECRET_ACCESS_KEY=...');
        console.error('STORAGE_REGION=auto');
        console.error('STORAGE_BUCKET=...');
        console.error('STORAGE_ENDPOINT=...');
        process.exit(1);
    }

    try {
        // Criar instância do provider
        console.log('🔧 Criando Storage Provider...');
        const storage = new S3StorageProvider({
            accessKeyId,
            secretAccessKey,
            region: region || 'us-east-1', // Railway pode precisar de uma região específica
            bucket,
            endpoint,
            forcePathStyle: true
        });
        console.log('✅ Storage Provider criado com sucesso\n');

        // Teste 1: Upload de arquivo
        console.log('📤 Teste 1: Upload de arquivo...');
        const testContent = Buffer.from('Teste de upload - ' + new Date().toISOString());
        const fileName = `test-${Date.now()}.txt`;
        
        const uploadResult = await storage.uploadFile({
            file: testContent,
            fileName,
            contentType: 'text/plain',
            folder: 'test'
        });
        
        console.log('✅ Upload realizado com sucesso!');
        console.log(`   Key: ${uploadResult.key}`);
        console.log(`   URL: ${uploadResult.url}\n`);

        // Teste 2: Obter URL do arquivo
        console.log('🔗 Teste 2: Obter URL do arquivo...');
        const fileUrl = await storage.getFileUrl(uploadResult.key);
        console.log('✅ URL obtida com sucesso!');
        console.log(`   URL: ${fileUrl}\n`);

        // Teste 3: Upload de imagem (simulado)
        console.log('🖼️  Teste 3: Upload de imagem (simulado)...');
        const imageContent = Buffer.from('fake-image-content');
        const imageFileName = `test-image-${Date.now()}.jpg`;
        
        const imageUploadResult = await storage.uploadFile({
            file: imageContent,
            fileName: imageFileName,
            contentType: 'image/jpeg',
            folder: 'photos/users'
        });
        
        console.log('✅ Upload de imagem realizado com sucesso!');
        console.log(`   Key: ${imageUploadResult.key}`);
        console.log(`   URL: ${imageUploadResult.url}\n`);

        // Teste 4: Deletar arquivo de teste
        console.log('🗑️  Teste 4: Deletar arquivo de teste...');
        await storage.deleteFile(uploadResult.key);
        console.log('✅ Arquivo deletado com sucesso!\n');

        // Resumo
        console.log('📊 Resumo dos testes:');
        console.log('✅ Todos os testes passaram!');
        console.log('\n📝 Arquivos criados:');
        console.log(`   - ${imageUploadResult.key} (mantido para verificação)`);
        console.log(`   - ${uploadResult.key} (deletado)`);
        console.log('\n🎉 Storage Provider está funcionando corretamente!');

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Erro ao testar Storage Provider:');
        if (error instanceof Error) {
            console.error(`   Mensagem: ${error.message}`);
            console.error(`   Stack: ${error.stack}`);
        } else {
            console.error('   Erro desconhecido:', error);
        }
        process.exit(1);
    }
}

testStorage();

