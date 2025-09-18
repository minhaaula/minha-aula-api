import crypto from 'node:crypto';

export const CryptoService = {
    mask(value: string, visible = 4) {
        if (!value) return value;
        return value.slice(0, visible) + '*'.repeat(Math.max(0, value.length - visible));
    },
};
