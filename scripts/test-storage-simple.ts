#!/usr/bin/env tsx
/**
 * Teste simples do Railway Storage para diagnosticar problemas
 */

import 'dotenv/config';
import { S3Client, PutObjectCommand, ListBucketsCommand } from '@aws-sdk/client-s3';

async function testSimple() {
    console.log('🔍 Teste Simples - Railway Storage\n');

    const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID;
    const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY;
    const bucket = process.env.STORAGE_BUCKET;
    const endpoint = process.env.STORAGE_ENDPOINT;

    console.log('📋 Configuração:');
    console.log(`   Access Key ID: ${accessKeyId ? accessKeyId.substring(0, 20) + '...' : '❌ Não definido'}`);
    console.log(`   Secret Key: ${secretAccessKey ? '✅ Definido (' + secretAccessKey.length + ' caracteres)' : '❌ Não definido'}`);
    console.log(`   Bucket: ${bucket || '❌ Não definido'}`);
    console.log(`   Endpoint: ${endpoint || '❌ Não definido'}\n`);

    if (!accessKeyId || !secretAccessKey || !bucket || !endpoint) {
        console.error('❌ Variáveis de ambiente não configuradas');
        process.exit(1);
    }

    // Teste 1: Criar cliente com configuração mínima
    console.log('🔧 Teste 1: Criar cliente S3...');
    try {
        const s3Client = new S3Client({
            region: 'us-east-1',
            endpoint: endpoint,
            forcePathStyle: true,
            credentials: {
                accessKeyId: accessKeyId,
                secretAccessKey: secretAccessKey
            }
        });
        console.log('✅ Cliente criado\n');

        // Teste 2: Tentar listar buckets (teste básico de autenticação)
        console.log('🔍 Teste 2: Verificar autenticação (ListBuckets)...');
        try {
            const listCommand = new ListBucketsCommand({});
            const result = await s3Client.send(listCommand);
            console.log('✅ Autenticação OK!');
            console.log(`   Buckets encontrados: ${result.Buckets?.length || 0}\n`);
        } catch (error: any) {
            console.error('❌ Erro na autenticação:');
            console.error(`   Código: ${error.Code || error.name}`);
            console.error(`   Mensagem: ${error.message}`);
            if (error.Code === 'SignatureDoesNotMatch') {
                console.error('\n⚠️  PROBLEMA: Secret Access Key está incorreta!');
                console.error('   Verifique a chave no painel do Railway Storage');
            }
            process.exit(1);
        }

        // Teste 3: Upload simples
        console.log('📤 Teste 3: Upload de arquivo...');
        try {
            const testContent = Buffer.from('Teste simples - ' + new Date().toISOString());
            const putCommand = new PutObjectCommand({
                Bucket: bucket,
                Key: `test-simple-${Date.now()}.txt`,
                Body: testContent,
                ContentType: 'text/plain'
            });
            
            await s3Client.send(putCommand);
            console.log('✅ Upload realizado com sucesso!\n');
            console.log('🎉 Todos os testes passaram!');
        } catch (error: any) {
            console.error('❌ Erro no upload:');
            console.error(`   Código: ${error.Code || error.name}`);
            console.error(`   Mensagem: ${error.message}`);
            if (error.Code === 'SignatureDoesNotMatch') {
                console.error('\n⚠️  PROBLEMA: Secret Access Key está incorreta!');
            } else if (error.Code === 'NoSuchBucket') {
                console.error('\n⚠️  PROBLEMA: Bucket não encontrado!');
                console.error(`   Verifique se o bucket "${bucket}" existe no Railway`);
            }
            process.exit(1);
        }

    } catch (error: any) {
        console.error('❌ Erro ao criar cliente:');
        console.error(`   Mensagem: ${error.message}`);
        process.exit(1);
    }
}

testSimple();

