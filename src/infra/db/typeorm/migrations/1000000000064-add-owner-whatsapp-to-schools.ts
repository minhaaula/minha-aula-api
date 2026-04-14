import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddOwnerWhatsappToSchools1000000000064 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(
            'schools',
            new TableColumn({
                name: 'owner_whatsapp',
                type: 'varchar',
                length: '32',
                isNullable: true
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('schools', 'owner_whatsapp');
    }
}
