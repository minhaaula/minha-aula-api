export const Uuid = () => (globalThis.crypto?.randomUUID?.() ?? require('node:crypto').randomUUID());
