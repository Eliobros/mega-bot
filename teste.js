const fs = require('fs');
const path = require('path');

const USERS_FILE = path.join(__dirname, 'database', 'users.json');
const GROUP_ID = '120363401341705925@g.us'; // Grupo correto

const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));

// Backup
fs.writeFileSync(USERS_FILE + '.backup2', JSON.stringify(data, null, 2));

// Pegar usuários da estrutura antiga
const usuariosAntigos = {};
for (const [key, value] of Object.entries(data)) {
    if (key !== 'grupos' && key !== 'comprovantes_utilizados') {
        usuariosAntigos[key] = value;
    }
}

// Criar/atualizar grupo correto
if (!data.grupos) data.grupos = {};
if (!data.grupos[GROUP_ID]) {
    data.grupos[GROUP_ID] = {
        usuarios: {},
        estatisticas: {
            total_usuarios: 0,
            total_compras_realizadas: 0,
            ultima_atualizacao: new Date().toISOString().split('T')[0],
            maior_comprador: null
        }
    };
}

// Copiar todos os usuários antigos pro grupo correto
data.grupos[GROUP_ID].usuarios = { ...usuariosAntigos };
data.grupos[GROUP_ID].estatisticas.total_usuarios = Object.keys(usuariosAntigos).length;

// Calcular total de compras
let totalCompras = 0;
for (const usuario of Object.values(usuariosAntigos)) {
    totalCompras += usuario.total_compras || 0;
}
data.grupos[GROUP_ID].estatisticas.total_compras_realizadas = totalCompras;

// Salvar
fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));

console.log(`✅ Migrado ${Object.keys(usuariosAntigos).length} usuários para o grupo ${GROUP_ID}`);
console.log(`📊 Total de compras: ${totalCompras}`);
