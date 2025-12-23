import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey } from 'typeorm';

export class CreateSchoolImages1000000000045 implements MigrationInterface {
    name = 'CreateSchoolImages1000000000045';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: 'school_images',
                columns: [
                    {
                        name: 'id',
                        type: 'char',
                        length: '36',
                        isPrimary: true
                    },
                    {
                        name: 'school_id',
                        type: 'char',
                        length: '36',
                        isNullable: false
                    },
                    {
                        name: 'key',
                        type: 'varchar',
                        length: '500',
                        isNullable: false
                    },
                    {
                        name: 'content_type',
                        type: 'varchar',
                        length: '100',
                        isNullable: false
                    },
                    {
                        name: 'original_file_name',
                        type: 'varchar',
                        length: '255',
                        isNullable: false
                    },
                    {
                        name: 'category',
                        type: 'varchar',
                        length: '50',
                        default: "'GALLERY'"
                    },
                    {
                        name: 'created_at',
                        type: 'datetime',
                        default: 'CURRENT_TIMESTAMP'
                    }
                ]
            }),
            true
        );

        await queryRunner.createForeignKey(
            'school_images',
            new TableForeignKey({
                columnNames: ['school_id'],
                referencedColumnNames: ['id'],
                referencedTableName: 'schools',
                onDelete: 'CASCADE'
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('school_images');
        if (table) {
            const foreignKey = table.foreignKeys.find(fk => fk.columnNames.indexOf('school_id') !== -1);
            if (foreignKey) {
                await queryRunner.dropForeignKey('school_images', foreignKey);
            }
        }
        await queryRunner.dropTable('school_images');
    }
}

