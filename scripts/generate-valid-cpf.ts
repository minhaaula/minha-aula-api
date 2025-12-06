/**
 * Gera um CPF válido
 * Algoritmo de validação de CPF brasileiro
 */
function generateValidCPF(): string {
    // Gera 9 dígitos aleatórios
    const digits: number[] = [];
    for (let i = 0; i < 9; i++) {
        digits.push(Math.floor(Math.random() * 10));
    }

    // Calcula o primeiro dígito verificador
    let sum = 0;
    for (let i = 0; i < 9; i++) {
        sum += digits[i] * (10 - i);
    }
    let remainder = sum % 11;
    const firstDigit = remainder < 2 ? 0 : 11 - remainder;
    digits.push(firstDigit);

    // Calcula o segundo dígito verificador
    sum = 0;
    for (let i = 0; i < 10; i++) {
        sum += digits[i] * (11 - i);
    }
    remainder = sum % 11;
    const secondDigit = remainder < 2 ? 0 : 11 - remainder;
    digits.push(secondDigit);

    return digits.join('');
}

// Gera CPFs válidos para a seed
const cpfs: string[] = [];
for (let i = 0; i < 25; i++) {
    cpfs.push(generateValidCPF());
}

console.log('CPFs válidos gerados:');
cpfs.forEach((cpf, index) => {
    console.log(`  ${index + 1}. ${cpf}`);
});

console.log('\nFormato para usar na seed:');
console.log(JSON.stringify(cpfs, null, 2));

