export function getSaqueRealizadoEscolaTwilioContentVariables(input: {
    nome: string;
    escola: string;
}): Record<string, string> {
    return {
        nome: String(input.nome ?? '').trim(),
        escola: String(input.escola ?? '').trim()
    };
}

