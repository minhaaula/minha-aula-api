/**
 * Variáveis do template Twilio Content `solicitacao_matricula` (WhatsApp).
 * No Console Twilio, os placeholders podem ser nomeados ({{nome}}, …) ou {{1}}…{{4}} —
 * use o estilo que corresponder ao Content aprovado.
 */

export interface SolicitacaoMatriculaWhatsAppTemplateData {
    /** Nome de quem recebe a mensagem (ex.: responsável ou gestor) */
    nome: string;
    escola: string;
    curso: string;
    /** Nome do aluno da solicitação */
    aluno: string;
}

export type SolicitacaoMatriculaTwilioVarStyle = 'named' | 'numbered';

/**
 * Mapeia dados para `contentVariables` do Twilio Messages API (JSON com chaves string).
 */
export function getSolicitacaoMatriculaTwilioContentVariables(
    data: SolicitacaoMatriculaWhatsAppTemplateData,
    style: SolicitacaoMatriculaTwilioVarStyle = 'named'
): Record<string, string> {
    const nome = (data.nome ?? '').trim();
    const escola = (data.escola ?? '').trim();
    const curso = (data.curso ?? '').trim();
    const aluno = (data.aluno ?? '').trim();
    if (style === 'numbered') {
        return {
            '1': nome,
            '2': escola,
            '3': curso,
            '4': aluno,
        };
    }
    return {
        nome,
        escola,
        curso,
        aluno,
    };
}
