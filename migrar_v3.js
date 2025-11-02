const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(__dirname, 'database', 'users.json');
const OUTPUT_PATH = path.join(__dirname, 'database', 'users_CORRETO.json');

console.log('🔧 MIGRANDO CORRETAMENTE (V3)...\n');

const dados = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));

const GRUPO_PRINCIPAL = '120363401341705925@g.us';

const dadosFinais = {
  grupos: {}
};

// Inicializar TODOS os grupos (vazios primeiro)
if (dados.grupos) {
  Object.keys(dados.grupos).forEach(groupId => {
    dadosFinais.grupos[groupId] = {
      usuarios: {},
      estatisticas: {
        total_usuarios: 0,
        total_compras_realizadas: 0,
        ultima_atualizacao: new Date().toISOString().split('T')[0],
        maior_comprador: null
      }
    };
  });
}

// Garantir que o grupo principal existe
if (!dadosFinais.grupos[GRUPO_PRINCIPAL]) {
  dadosFinais.grupos[GRUPO_PRINCIPAL] = {
    usuarios: {},
    estatisticas: {
      total_usuarios: 0,
      total_compras_realizadas: 0,
      ultima_atualizacao: new Date().toISOString().split('T')[0],
      maior_comprador: null
    }
  };
}

// MIGRAR USUÁRIOS DO OBJETO "usuarios" PARA O GRUPO PRINCIPAL
if (dados.usuarios) {
  console.log('📦 Migrando usuários para o grupo principal...\n');
  
  Object.entries(dados.usuarios).forEach(([jid, userData]) => {
    dadosFinais.grupos[GRUPO_PRINCIPAL].usuarios[jid] = {
      nome: userData.nome || userData.pushName || jid.split('@')[0],
      numero: userData.numero || jid.replace('@lid', ''),
      total_compras: userData.total_compras || 0,
      total_gb_acumulado: userData.total_gb_acumulado || 0,
      primeira_compra: userData.primeira_compra || '',
      ultima_compra: userData.ultima_compra || '',
      compras_hoje: userData.compras_hoje || 0,
      historico_compras: userData.historico_compras || []
    };
    
    if (userData.total_compras > 0) {
      console.log(`   ✅ ${userData.nome} - ${userData.total_gb_acumulado.toFixed(2)}GB`);
    }
  });
}

// Atualizar estatísticas do grupo principal
if (dados.estatisticas_grupo) {
  dadosFinais.grupos[GRUPO_PRINCIPAL].estatisticas = {
    total_usuarios: dados.estatisticas_grupo.total_usuarios || Object.keys(dadosFinais.grupos[GRUPO_PRINCIPAL].usuarios).length,
    total_compras_realizadas: dados.estatisticas_grupo.total_compras_realizadas || 0,
    ultima_atualizacao: dados.estatisticas_grupo.ultima_atualizacao || new Date().toISOString().split('T')[0],
    maior_comprador: dados.estatisticas_grupo.maior_comprador || null
  };
}

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(dadosFinais, null, 2));

const grupo = dadosFinais.grupos[GRUPO_PRINCIPAL];
console.log('\n' + '='.repeat(70));
console.log('✅ MIGRAÇÃO CONCLUÍDA!\n');
console.log(`🏆 GRUPO: ${GRUPO_PRINCIPAL}`);
console.log(`   Usuários: ${Object.keys(grupo.usuarios).length}`);
console.log(`   Compras: ${grupo.estatisticas.total_compras_realizadas}`);
console.log(`   Maior: ${grupo.estatisticas.maior_comprador?.nome} (${grupo.estatisticas.maior_comprador?.total_gb}GB)`);
console.log(`\n💾 Salvo em: ${OUTPUT_PATH}`);
console.log('='.repeat(70));
console.log('\n✅ Execute:');
console.log('   cp database/users_CORRETO.json database/users.json');
console.log('   node debug_ranking.js');
console.log('   pm2 restart mega-bot');
