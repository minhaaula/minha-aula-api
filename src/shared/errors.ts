/**
 * Sistema centralizado de erros com códigos e mensagens padronizadas
 */

export enum ErrorCode {
    // Validação (1000-1999)
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    INVALID_CPF = 'INVALID_CPF',
    INVALID_EMAIL = 'INVALID_EMAIL',
    INVALID_DATE = 'INVALID_DATE',
    INVALID_BIRTH_DATE = 'INVALID_BIRTH_DATE',
    INVALID_PHONE = 'INVALID_PHONE',
    INVALID_IDENTIFIERS = 'INVALID_IDENTIFIERS',
    REQUIRED_FIELD = 'REQUIRED_FIELD',
    INVALID_AMOUNT = 'INVALID_AMOUNT',
    INVALID_DISCOUNT = 'INVALID_DISCOUNT',
    INVALID_DATE_RANGE = 'INVALID_DATE_RANGE',
    
    // Não encontrado (2000-2999)
    NOT_FOUND = 'NOT_FOUND',
    USER_NOT_FOUND = 'USER_NOT_FOUND',
    SCHOOL_NOT_FOUND = 'SCHOOL_NOT_FOUND',
    COURSE_NOT_FOUND = 'COURSE_NOT_FOUND',
    COURSE_CLASS_NOT_FOUND = 'COURSE_CLASS_NOT_FOUND',
    STUDENT_NOT_FOUND = 'STUDENT_NOT_FOUND',
    DEPENDENT_NOT_FOUND = 'DEPENDENT_NOT_FOUND',
    ENROLLMENT_REQUEST_NOT_FOUND = 'ENROLLMENT_REQUEST_NOT_FOUND',
    CHARGE_NOT_FOUND = 'CHARGE_NOT_FOUND',
    ENROLLMENT_NOT_FOUND = 'ENROLLMENT_NOT_FOUND',
    
    // Conflito (3000-3999)
    ALREADY_EXISTS = 'ALREADY_EXISTS',
    EMAIL_ALREADY_REGISTERED = 'EMAIL_ALREADY_REGISTERED',
    CPF_ALREADY_REGISTERED = 'CPF_ALREADY_REGISTERED',
    DEPENDENT_ALREADY_EXISTS = 'DEPENDENT_ALREADY_EXISTS',
    ENROLLMENT_REQUEST_ALREADY_EXISTS = 'ENROLLMENT_REQUEST_ALREADY_EXISTS',
    ALREADY_ENROLLED = 'ALREADY_ENROLLED',
    ENROLLMENT_REQUEST_ALREADY_DECIDED = 'ENROLLMENT_REQUEST_ALREADY_DECIDED',
    REVIEW_ALREADY_EXISTS = 'REVIEW_ALREADY_EXISTS',
    
    // Autorização (4000-4999)
    UNAUTHORIZED = 'UNAUTHORIZED',
    FORBIDDEN = 'FORBIDDEN',
    SCHOOL_CONTEXT_NOT_FOUND = 'SCHOOL_CONTEXT_NOT_FOUND',
    NOT_ALLOWED = 'NOT_ALLOWED',
    INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
    STUDENT_ACCESS_NOT_ENABLED = 'STUDENT_ACCESS_NOT_ENABLED',
    ACCOUNT_DEACTIVATED = 'ACCOUNT_DEACTIVATED',
    ACCOUNT_ALREADY_DEACTIVATED = 'ACCOUNT_ALREADY_DEACTIVATED',
    SCHOOL_ALREADY_DELETED = 'SCHOOL_ALREADY_DELETED',
    CANNOT_DELETE_ADMIN_USER = 'CANNOT_DELETE_ADMIN_USER',
    CANNOT_DELETE_USER_WITH_ACTIVE_SCHOOL = 'CANNOT_DELETE_USER_WITH_ACTIVE_SCHOOL',
    
    // Configuração (5000-5999)
    CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
    PAYMENT_PROVIDER_NOT_CONFIGURED = 'PAYMENT_PROVIDER_NOT_CONFIGURED',
    PROVIDER_NOT_SUPPORTED = 'PROVIDER_NOT_SUPPORTED',
    MISSING_REQUIRED_CONFIG = 'MISSING_REQUIRED_CONFIG',
    
    // Negócio (6000-6999)
    BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
    CANNOT_DELETE_COURSE_WITH_ACTIVE_CLASSES = 'CANNOT_DELETE_COURSE_WITH_ACTIVE_CLASSES',
    CHARGE_TYPE_NOT_ALLOWED = 'CHARGE_TYPE_NOT_ALLOWED',
    CHARGE_NOT_ELIGIBLE = 'CHARGE_NOT_ELIGIBLE',
    CHARGE_ALREADY_PAID = 'CHARGE_ALREADY_PAID',
    CLASS_SESSION_OVERLAP = 'CLASS_SESSION_OVERLAP',
    INCOMPLETE_DATA = 'INCOMPLETE_DATA',
    NOT_ENROLLED_IN_SCHOOL = 'NOT_ENROLLED_IN_SCHOOL',
    SCHOOL_STUDENT_LEVEL_IN_USE = 'SCHOOL_STUDENT_LEVEL_IN_USE',
    SCHOOL_STUDENT_LEVEL_NOT_FOUND = 'SCHOOL_STUDENT_LEVEL_NOT_FOUND',
    ENROLLMENT_NOT_ACTIVE_FOR_PROMOTION = 'ENROLLMENT_NOT_ACTIVE_FOR_PROMOTION',
    /** Cadastro exige token emitido após verificação do WhatsApp (Twilio Verify). */
    SIGNUP_PHONE_NOT_VERIFIED = 'SIGNUP_PHONE_NOT_VERIFIED',
    /** Cadastro de escola exige token emitido após verificação do WhatsApp (Twilio Verify). */
    SCHOOL_SIGNUP_PHONE_NOT_VERIFIED = 'SCHOOL_SIGNUP_PHONE_NOT_VERIFIED',
    /** Envio do código ainda não concluído pelo worker (Twilio Verify na fila). */
    OTP_SEND_PENDING = 'OTP_SEND_PENDING',
    /** Alteração de perfil do aluno exige token emitido após verificação do WhatsApp. */
    STUDENT_PROFILE_NOT_VERIFIED = 'STUDENT_PROFILE_NOT_VERIFIED',
    /** Usuário com persona SCHOOL não pode alterar identidade via rotas do aluno. @deprecated use SCHOOL_PERSONA_STUDENT_PROFILE_UPDATE_FORBIDDEN */
    SCHOOL_OWNER_STUDENT_PROFILE_FIELD_LOCKED = 'SCHOOL_OWNER_STUDENT_PROFILE_FIELD_LOCKED',
    /** Persona SCHOOL não pode alterar cadastro via rotas do app aluno (KYC Asaas). */
    SCHOOL_PERSONA_STUDENT_PROFILE_UPDATE_FORBIDDEN = 'SCHOOL_PERSONA_STUDENT_PROFILE_UPDATE_FORBIDDEN',
    
    // Sistema (7000-7999)
    INTERNAL_ERROR = 'INTERNAL_ERROR',
    OPTIMISTIC_LOCK_ERROR = 'OPTIMISTIC_LOCK_ERROR',
    DATABASE_ERROR = 'DATABASE_ERROR',
    EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
}

export const ErrorMessages: Record<ErrorCode, string> = {
    // Validação
    [ErrorCode.VALIDATION_ERROR]: 'Erro de validação',
    [ErrorCode.INVALID_CPF]: 'CPF inválido',
    [ErrorCode.INVALID_EMAIL]: 'Email inválido',
    [ErrorCode.INVALID_DATE]: 'Data inválida',
    [ErrorCode.INVALID_BIRTH_DATE]: 'Data de nascimento inválida',
    [ErrorCode.INVALID_PHONE]: 'Telefone inválido',
    [ErrorCode.INVALID_IDENTIFIERS]: 'Identificadores inválidos',
    [ErrorCode.REQUIRED_FIELD]: 'Campo obrigatório não informado',
    [ErrorCode.INVALID_AMOUNT]: 'Valor inválido',
    [ErrorCode.INVALID_DISCOUNT]: 'Desconto inválido',
    [ErrorCode.INVALID_DATE_RANGE]: 'Intervalo de datas inválido',
    
    // Não encontrado
    [ErrorCode.NOT_FOUND]: 'Recurso não encontrado',
    [ErrorCode.USER_NOT_FOUND]: 'Usuário não encontrado',
    [ErrorCode.SCHOOL_NOT_FOUND]: 'Escola não encontrada',
    [ErrorCode.COURSE_NOT_FOUND]: 'Curso não encontrado',
    [ErrorCode.COURSE_CLASS_NOT_FOUND]: 'Turma não encontrada',
    [ErrorCode.STUDENT_NOT_FOUND]: 'Aluno não encontrado',
    [ErrorCode.DEPENDENT_NOT_FOUND]: 'Dependente não encontrado',
    [ErrorCode.ENROLLMENT_REQUEST_NOT_FOUND]: 'Solicitação de matrícula não encontrada',
    [ErrorCode.CHARGE_NOT_FOUND]: 'Cobrança não encontrada',
    [ErrorCode.ENROLLMENT_NOT_FOUND]: 'Matrícula não encontrada',
    
    // Conflito
    [ErrorCode.ALREADY_EXISTS]: 'Recurso já existe',
    [ErrorCode.EMAIL_ALREADY_REGISTERED]: 'Email já cadastrado',
    [ErrorCode.CPF_ALREADY_REGISTERED]: 'CPF já cadastrado',
    [ErrorCode.DEPENDENT_ALREADY_EXISTS]: 'Dependente com este nome já existe para o usuário',
    [ErrorCode.ENROLLMENT_REQUEST_ALREADY_EXISTS]: 'Solicitação de matrícula já existe para este alvo',
    [ErrorCode.ALREADY_ENROLLED]: 'Já matriculado nesta turma',
    [ErrorCode.ENROLLMENT_REQUEST_ALREADY_DECIDED]: 'Solicitação de matrícula já foi decidida',
    [ErrorCode.REVIEW_ALREADY_EXISTS]: 'Você já avaliou esta escola',
    
    // Autorização
    [ErrorCode.UNAUTHORIZED]: 'Não autorizado',
    [ErrorCode.FORBIDDEN]: 'Acesso negado',
    [ErrorCode.SCHOOL_CONTEXT_NOT_FOUND]: 'Contexto de escola não encontrado para o usuário',
    [ErrorCode.NOT_ALLOWED]: 'Operação não permitida',
    [ErrorCode.INVALID_CREDENTIALS]: 'Credenciais inválidas',
    [ErrorCode.STUDENT_ACCESS_NOT_ENABLED]: 'Acesso como aluno não está habilitado para esta conta',
    [ErrorCode.ACCOUNT_DEACTIVATED]: 'Conta desativada',
    [ErrorCode.ACCOUNT_ALREADY_DEACTIVATED]: 'Conta já está desativada',
    [ErrorCode.SCHOOL_ALREADY_DELETED]: 'Escola já foi excluída',
    [ErrorCode.CANNOT_DELETE_ADMIN_USER]: 'Não é permitido excluir usuário administrador',
    [ErrorCode.CANNOT_DELETE_USER_WITH_ACTIVE_SCHOOL]: 'Usuário possui escola ativa vinculada. Exclua a escola antes.',
    
    // Configuração
    [ErrorCode.CONFIGURATION_ERROR]: 'Erro de configuração',
    [ErrorCode.PAYMENT_PROVIDER_NOT_CONFIGURED]: 'Provedor de pagamento não configurado',
    [ErrorCode.PROVIDER_NOT_SUPPORTED]: 'Provedor não suporta esta operação',
    [ErrorCode.MISSING_REQUIRED_CONFIG]: 'Configuração obrigatória ausente',
    
    // Negócio
    [ErrorCode.BUSINESS_RULE_VIOLATION]: 'Violação de regra de negócio',
    [ErrorCode.CANNOT_DELETE_COURSE_WITH_ACTIVE_CLASSES]: 'Não é possível excluir curso com turmas ativas',
    [ErrorCode.CHARGE_TYPE_NOT_ALLOWED]: 'Tipo de cobrança não permite esta operação',
    [ErrorCode.CHARGE_NOT_ELIGIBLE]: 'Cobrança não está elegível para esta operação',
    [ErrorCode.CHARGE_ALREADY_PAID]: 'Não é possível excluir cobrança já paga',
    [ErrorCode.CLASS_SESSION_OVERLAP]: 'Sessão de aula sobrepõe com uma existente',
    [ErrorCode.INCOMPLETE_DATA]: 'Dados incompletos',
    [ErrorCode.NOT_ENROLLED_IN_SCHOOL]: 'Você ou algum dependente precisa estar matriculado na escola para avaliá-la',
    [ErrorCode.SCHOOL_STUDENT_LEVEL_IN_USE]: 'Nível possui alunos ou histórico associado e não pode ser removido',
    [ErrorCode.SCHOOL_STUDENT_LEVEL_NOT_FOUND]: 'Nível da escola não encontrado',
    [ErrorCode.ENROLLMENT_NOT_ACTIVE_FOR_PROMOTION]: 'Somente matrículas ativas podem receber promoção de nível',
    [ErrorCode.SIGNUP_PHONE_NOT_VERIFIED]: 'Confirme o código enviado ao WhatsApp antes de concluir o cadastro',
    [ErrorCode.SCHOOL_SIGNUP_PHONE_NOT_VERIFIED]: 'Confirme o código enviado ao WhatsApp antes de concluir o cadastro da escola',
    [ErrorCode.OTP_SEND_PENDING]: 'Aguarde alguns instantes. O código está sendo enviado ao WhatsApp.',
    [ErrorCode.STUDENT_PROFILE_NOT_VERIFIED]:
        'Confirme o código enviado ao WhatsApp antes de salvar as alterações do perfil',
    [ErrorCode.SCHOOL_OWNER_STUDENT_PROFILE_FIELD_LOCKED]:
        'Usuários com perfil de escola não podem alterar nome, CPF, data de nascimento nem sexo pelas rotas do aluno',
    [ErrorCode.SCHOOL_PERSONA_STUDENT_PROFILE_UPDATE_FORBIDDEN]:
        'Usuários que também são donos de escola devem realizar alteração de dados pelo Painel da Escola.',
    
    // Sistema
    [ErrorCode.INTERNAL_ERROR]: 'Erro interno do servidor',
    [ErrorCode.OPTIMISTIC_LOCK_ERROR]: 'Erro de concorrência otimista',
    [ErrorCode.DATABASE_ERROR]: 'Erro no banco de dados',
    [ErrorCode.EXTERNAL_SERVICE_ERROR]: 'Erro no serviço externo',
};

export class AppError extends Error {
    constructor(
        public readonly code: ErrorCode,
        public readonly message: string,
        public readonly details?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'AppError';
        Object.setPrototypeOf(this, AppError.prototype);
    }

    static fromCode(code: ErrorCode, details?: Record<string, unknown>): AppError {
        const message = ErrorMessages[code] || ErrorMessages[ErrorCode.INTERNAL_ERROR];
        return new AppError(code, message, details);
    }

    static validation(message: string, details?: Record<string, unknown>): AppError {
        return new AppError(ErrorCode.VALIDATION_ERROR, message, details);
    }

    static notFound(resource: string, details?: Record<string, unknown>): AppError {
        return new AppError(ErrorCode.NOT_FOUND, `${resource} não encontrado(a)`, details);
    }

    static unauthorized(message?: string): AppError {
        return new AppError(
            ErrorCode.UNAUTHORIZED,
            message || ErrorMessages[ErrorCode.UNAUTHORIZED]
        );
    }

    static forbidden(message?: string): AppError {
        return new AppError(
            ErrorCode.FORBIDDEN,
            message || ErrorMessages[ErrorCode.FORBIDDEN]
        );
    }

    toJSON() {
        return {
            code: this.code,
            message: this.message,
            ...(this.details && { details: this.details })
        };
    }
}

