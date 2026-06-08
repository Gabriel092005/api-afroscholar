// emergency-fix.js
const fs = require('fs');
const path = require('path');

console.log('🚨 APLICANDO CORREÇÃO DE EMERGÊNCIA...');

const serverPath = path.join(__dirname, 'build', 'server.js');
let content = fs.readFileSync(serverPath, 'utf8');

// Método 1: Remove a linha EXATA do erro (linha 6210)
const lines = content.split('\n');
if (lines[6209]) { // 6210 - 1 porque arrays são 0-indexed
    console.log(`📌 Removendo linha problemática 6210: ${lines[6209].substring(0, 100)}...`);
    lines[6209] = '// LINHA REMOVIDA: ' + lines[6209].replace(/fileURLToPath\([^)]+\)/, '""');
}

// Método 2: Encontra TODOS os fileURLToPath com import_meta
let found = false;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('fileURLToPath') && lines[i].includes('import_meta')) {
        console.log(`🔧 Corrigindo linha ${i + 1}`);
        lines[i] = lines[i].replace(
            /fileURLToPath\(([^)]+)\)/,
            '"" // fileURLToPath removido'
        );
        found = true;
    }
}

if (!found) {
    console.log('⚠️  Nenhum fileURLToPath encontrado. Removendo qualquer __banner_node_url...');
    content = content.replace(/__banner_node_url\.fileURLToPath\([^)]+\)/g, '""');
    content = content.replace(/var import_meta = \{\};/g, '// import_meta removido');
} else {
    content = lines.join('\n');
}

fs.writeFileSync(serverPath, content);
console.log('✅ Correção aplicada! Execute: npm start');