export type ResolvePaginationInput = {
    limit?: number;
    offset?: number;
    /** Página 1-based; quando informada, tem prioridade sobre `offset`. */
    page?: number;
    defaultLimit?: number;
    maxLimit?: number;
};

export type ResolvedPagination = {
    limit: number;
    offset: number;
};

export function resolvePagination(input: ResolvePaginationInput): ResolvedPagination {
    const defaultLimit = input.defaultLimit ?? 50;
    const maxLimit = input.maxLimit ?? 100;
    const limit = Math.min(Math.max(input.limit ?? defaultLimit, 1), maxLimit);

    if (input.page != null && input.page >= 1) {
        return { limit, offset: (input.page - 1) * limit };
    }

    return { limit, offset: Math.max(0, input.offset ?? 0) };
}
