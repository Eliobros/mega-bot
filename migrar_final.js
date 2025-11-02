const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'database', 'users.json');
const BACKUP = path.join(__dirname, 'database', 'users_antes_migrar_final.json');

console.log('🔄 Migrando dados antigos para estrutura por grupo...\n');

// Ler
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

// Backup
fs.writeFileSync(BACKUP, JSON.stringify(data, null, 2));
console.log('✅ Backup:', BACKUP);

// Grupo principal (onde estão seus dados)
const MAIN_GROUP = '120363401341705925@g.us';

// Pegar usuários antigos da raiz
const usuariosAntigos = data.usuarios || {};
const estatisticasAntigas = data.estatisticas_grupo || {};

console.log(`\n📊 Dados antigos encontrados:`);
console.log(`   - Usuários na raiz: ${Object.keys(usuariosAntigos).length}`);
console.log(`   - Total compras antigas: ${estatisticasAntigas.total_compras_realizadas || 0}`);

// Inicializar estrutura grupos se não existir
if (!data.grupos) {
    data.grupos = {};
}

if (!data.grupos[MAIN_GROUP]) {
    data.grupos[MAIN_GROUP] = {
        usuarios: {},
        estatisticas: {
            total_usuarios: 0,
            total_compras_realizadas: 0,
            ultima_atualizacao: new Date().toISOString().split('T')[0],
            maior_comprador: null
        }
    };
}

// MESCLAR usuários antigos com novos
const grupoAtual = data.grupos[MAIN_GROUP];

// Para cada usuário antigo
for (const [jid, dadosAntigos] of Object.entries(usuariosAntigos)) {
    if (grupoAtual.usuarios[jid]) {
        // Usuário já existe no grupo novo - MESCLAR dados
        const usuarioNovo = grupoAtual.usuarios[jid];
        
        // Somar compras
        usuarioNovo.total_compras += dadosAntigos.total_compras;
        usuarioNovo.total_gb_acumulado += dadosAntigos.total_gb_acumulado;
        
        // Manter a primeira compra mais antiga
        if (dadosAntigos.primeira_compra && 
            (!usuarioNovo.primeira_compra || dadosAntigos.primeira_compra < usuarioNovo.primeira_compra)) {
            usuarioNovo.primeira_compra = dadosAntigos.primeira_compra;
        }
        
        // Mesclar histórico
        if (dadosAntigos.historico_compras) {
            usuarioNovo.historico_compras = [
                ...dadosAntigos.historico_compras,
                ...usuarioNovo.historico_compras
            ];
        }
        
        console.log(`   ✓ Mesclado: ${dadosAntigos.nome || jid}`);
    } else {
        // Usuário só existe nos dados antigos - ADICIONAR
        grupoAtual.usuarios[jid] = dadosAntigos;
        console.log(`   + Adicionado: ${dadosAntigos.nome || jid}`);
    }
}

// Atualizar estatísticas
grupoAtual.estatisticas.total_usuarios = Object.keys(grupoAtual.usuarios).length;

// Recalcular total de compras
let totalCompras = 0;
let maiorComprador = null;
let maiorGB = 0;

for (const [jid, usuario] of Object.entries(grupoAtual.usuarios)) {
    totalCompras += usuario.total_compras;
    if (usuario.total_gb_acumulado > maiorGB) {
        maiorGB = usuario.total_gb_acumulado;
        maiorComprador = {
            numero: usuario.numero,
            nome: usuario.nome,
            total_gb: usuario.total_gb_acumulado
        };
    }
}

grupoAtual.estatisticas.total_compras_realizadas = totalCompras;
grupoAtual.estatisticas.maior_comprador = maiorComprador;

// LIMPAR dados antigos da raiz
delete data.usuarios;
delete data.estatisticas_grupo;
delete data.users; // Remover lixo também

console.log(`\n✅ Migração concluída!`);
console.log(`   - Total usuários no grupo: ${grupoAtual.estatisticas.total_usuarios}`);
console.log(`   - Total compras: ${grupoAtual.estatisticas.total_compras_realizadas}`);
console.log(`   - Maior comprador: ${maiorComprador?.nome} (${maiorComprador?.total_gb.toFixed(2)}GB)`);

// Salvar
fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
console.log(`\n💾 Arquivo salvo: ${FILE}`);
console.log(`📦 Backup em: ${BACKUP}\n`);
