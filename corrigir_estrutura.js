const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(__dirname, 'database', 'users.json');
const OUTPUT_PATH = path.join(__dirname, 'database', 'users_corrigido.json');

console.log('🔧 CORRIGINDO ESTRUTURA...\n');

const dados = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));

// Pegar dados antigos (soltos)
const usuariosAntigos = {};
const estatisticasAntigas = dados.estatisticas_grupo || {};

// Extrair usuários que estão soltos (fora de grupos)
Object.keys(dados).forEach(key => {
  if (key.includes('@lid') && typeof dados[key] === 'object') {
    usuariosAntigos[key] = dados[key];
  }
});

console.log(`✅ Encontrados ${Object.keys(usuariosAntigos).length} usuários no formato antigo`);

// Criar estrutura correta
const dadosCorrigidos = {
  grupos: dados.grupos || {}
};

// ID do grupo principal (aquele do print que você mandou)
const GRUPO_PRINCIPAL = '120363401341705925@g.us';

// Criar/atualizar grupo principal com dados antigos
if (!dadosCorrigidos.grupos[GRUPO_PRINCIPAL]) {
  dadosCorrigidos.grupos[GRUPO_PRINCIPAL] = {
    usuarios: {},
    estatisticas: {
      total_usuarios: 0,
      total_compras_realizadas: 0,
      ultima_atualizacao: new Date().toISOString().split('T')[0],
      maior_comprador: null
    }
  };
}

// Mesclar usuários antigos no grupo principal
Object.keys(usuariosAntigos).forEach(jid => {
  dadosCorrigidos.grupos[GRUPO_PRINCIPAL].usuarios[jid] = usuariosAntigos[jid];
});

// Atualizar estatísticas
const grupo = dadosCorrigidos.grupos[GRUPO_PRINCIPAL];
grupo.estatisticas.total_usuarios = Object.keys(grupo.usuarios).length;
grupo.estatisticas.total_compras_realizadas = estatisticasAntigas.total_compras_realizadas || 0;
grupo.estatisticas.maior_comprador = estatisticasAntigas.maior_comprador || null;

// Salvar
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(dadosCorrigidos, null, 2));

console.log('\n✅ ARQUIVO CORRIGIDO!\n');
console.log(`📊 Grupo ${GRUPO_PRINCIPAL}:`);
console.log(`   Total usuários: ${grupo.estatisticas.total_usuarios}`);
console.log(`   Total compras: ${grupo.estatisticas.total_compras_realizadas}`);
console.log(`   Maior comprador: ${grupo.estatisticas.maior_comprador?.nome} (${grupo.estatisticas.maior_comprador?.total_gb}GB)`);
console.log(`\n💾 Salvo em: ${OUTPUT_PATH}`);
console.log('\n⚠️  Revise e depois: cp database/users_corrigido.json database/users.json');
