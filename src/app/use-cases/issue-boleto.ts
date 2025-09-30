import { PaymentProviderPort, CreateBoletoChargeInput } from '../../ports/providers/payment-provider.port';

export type IssueBoletoResult = {
    providerRef: string;
    boletoUrl?: string;
    digitableLine?: string;
    barcode?: string;
    dueDate: Date;
};

export class IssueBoleto {
    constructor(private readonly provider: PaymentProviderPort) {}

    async exec(input: CreateBoletoChargeInput): Promise<IssueBoletoResult> {
        if (!this.provider.createBoletoCharge) {
            throw new Error('Boleto charge is not supported by the configured payment provider');
        }

        return this.provider.createBoletoCharge(input);
    }
}
