import { describe, expect, it } from 'vitest';
import {
    daysUntilTuitionDue,
    resolveNextTuitionDueDate,
    shouldGenerateTuitionChargeInWindow
} from '../../src/app/use-cases/payments/resolve-next-tuition-due-date';

describe('resolveNextTuitionDueDate', () => {
    it('hoje 22/05 e vencimento dia 25 → próximo vencimento 25/05', () => {
        const ref = new Date(2026, 4, 22); // 22/05/2026 local
        const next = resolveNextTuitionDueDate(ref, 25);
        expect(next.dueYear).toBe(2026);
        expect(next.dueMonth).toBe(5);
        expect(next.adjustedDueDay).toBe(25);
        expect(daysUntilTuitionDue(ref, next.dueDate)).toBe(3);
    });

    it('hoje 26/05 e vencimento dia 25 → próximo vencimento 25/06', () => {
        const ref = new Date(2026, 4, 26);
        const next = resolveNextTuitionDueDate(ref, 25);
        expect(next.dueMonth).toBe(6);
        expect(next.adjustedDueDay).toBe(25);
    });

    it('janela de 10 dias: 22/05 para vencer 25/05 deve gerar', () => {
        const ref = new Date(2026, 4, 22);
        expect(shouldGenerateTuitionChargeInWindow(ref, 25, 10)).toBe(true);
    });

    it('fora da janela: 10/05 para vencer 25/05 não gera (15 dias)', () => {
        const ref = new Date(2026, 4, 10);
        expect(shouldGenerateTuitionChargeInWindow(ref, 25, 10)).toBe(false);
    });

    it('dia 31 em fevereiro ajusta para 28/02', () => {
        const ref = new Date(2026, 1, 10); // fev/2026
        const next = resolveNextTuitionDueDate(ref, 31);
        expect(next.dueMonth).toBe(2);
        expect(next.adjustedDueDay).toBe(28);
    });
});
