import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { SchoolOrm } from './school.orm';

/**
 * Catálogo de níveis por escola (ordenado). Opcional por escola — se não existir uso, não há registro aqui.
 * O vínculo com o desempenho do aluno é sempre via matrícula + histórico de promoções.
 */
@Entity('school_student_levels')
@Index('uq_school_student_levels_school_sort', ['schoolId', 'sortOrder'], { unique: true })
@Index('uq_school_student_levels_school_code', ['schoolId', 'templateCode'], { unique: true })
export class SchoolStudentLevelOrm {
    @PrimaryColumn('char', { length: 36 }) id!: string;

    @Column('char', { length: 36, name: 'school_id' }) schoolId!: string;

    /** Rótulo exibível (ex.: "Faixa Azul"). */
    @Column('varchar', { length: 191 }) label!: string;

    /**
     * Identificador estável opcional por escola para integrações / múltiplos fluxos futuros (ex.: "kyu_5").
     * Quando definido, é único por escola (`uq_school_student_levels_school_code`).
     */
    @Column('varchar', { length: 64, name: 'template_code', nullable: true }) templateCode!: string | null;

    /** Ordem de progressão menor = nível inicial ou inferior, conforme regra da escola. */
    @Column('int', { name: 'sort_order' }) sortOrder!: number;

    @ManyToOne(() => SchoolOrm, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'school_id' })
    school!: SchoolOrm;

    @CreateDateColumn({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }) createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }) updatedAt!: Date;
}
