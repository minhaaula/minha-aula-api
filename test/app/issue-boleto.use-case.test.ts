import { describe, expect, it, vi } from 'vitest';
import { IssueBoleto } from '../../src/app/use-cases/payments/issue-boleto';
import { Money } from '../../src/domain/value-objects/money';
import { CreateBoletoChargeInput, PaymentProviderPort } from '../../src/ports/providers/payment-provider.port';

const boletoInput: CreateBoletoChargeInput = {
    amount: Money.of(10000, 'BRL'),
    customer: {
        name: 'Joao',
        email: 'joao@example.com',
        cpfCnpj: '12345678909',
        postalCode: '01234000',
        addressNumber: '123'
    },
    dueDate: new Date('2024-12-01'),
    description: 'Mensalidade',
    externalReference: 'ref-1'
};

describe('IssueBoleto use case', () => {
    it('delegates boleto creation to provider', async () => {
        const createBoletoCharge = vi.fn().mockResolvedValue({
            providerRef: 'pay_1',
            dueDate: boletoInput.dueDate
        });
        const provider: PaymentProviderPort = {
            authorize: vi.fn(),
            capture: vi.fn(),
            createBoletoCharge
        };

        const useCase = new IssueBoleto(provider);
        const result = await useCase.exec(boletoInput);

        expect(createBoletoCharge).toHaveBeenCalledWith(boletoInput);
        expect(result.providerRef).toBe('pay_1');
    });

    it('throws when provider does not support boleto', async () => {
        const provider: PaymentProviderPort = {
            authorize: vi.fn(),
            capture: vi.fn()
        };
        const useCase = new IssueBoleto(provider);

        await expect(useCase.exec(boletoInput)).rejects.toThrow('Boleto charge is not supported');
    });
});
