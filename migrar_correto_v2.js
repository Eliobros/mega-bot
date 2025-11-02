const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(__dirname, 'database', 'users.json');
const OUTPUT_PATH = path.join(__dirname, 'database', 'users_final.json');
const BACKUP_PATH = path.join(__dirname, 'database', 'users_backup_completo.json');

console.log('🔧 MIGRANDO CORRETAMENTE...\n');

const dadosOriginais = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
fs.writeFileSync(BACKUP_PATH, JSON.stringify(dadosOriginais, null, 2));
console.log('✅ Backup criado\n');

const GRUPO_PRINCIPAL = '120363401341705925@g.us';

const dadosFinais = {
  grupos: {}
};

dadosFinais.grupos[GRUPO_PRINCIPAL] = {
  usuarios: {},
  estatisticas: {
    total_usuarios: 0,
    total_compras_realizadas: 0,
    ultima_atualizacao: new Date().toISOString().split('T')[0],
    maior_comprador: null
  }
};

let totalMigrados = 0;

// MIGRAR DE "usuarios" (AQUI ESTÁ O WESLEY!)
if (dadosOriginais.usuarios) {
  console.log('📦 Migrando usuários do objeto "usuarios"...\n');
  
  Object.entries(dadosOriginais.usuarios).forEach(([jid, userData]) => {
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
    
    totalMigrados++;
    console.log(`   ✅ ${userData.nome} - ${userData.total_gb_acumulado.toFixed(2)}GB (${userData.total_compras} compras)`);
  });
}

// Manter grupos existentes
if (dadosOriginais.grupos) {
  console.log('\n📦 Mantendo grupos existentes...');
  Object.keys(dadosOriginais.grupos).forEach(groupId => {
    if (groupId !== GRUPO_PRINCIPAL) {
      dadosFinais.grupos[groupId] = dadosOriginais.grupos[groupId];
    }
  });
}

// Copiar estatísticas antigas se existirem
if (dadosOriginais.estatisticas_grupo) {
  dadosFinais.grupos[GRUPO_PRINCIPAL].estatisticas = {
    total_usuarios: dadosOriginais.estatisticas_grupo.total_usuarios || Object.keys(dadosFinais.grupos[GRUPO_PRINCIPAL].usuarios).length,
    total_compras_realizadas: dadosOriginais.estatisticas_grupo.total_compras_realizadas || 0,
    ultima_atualizacao: dadosOriginais.estatisticas_grupo.ultima_atualizacao || new Date().toISOString().split('T')[0],
    maior_comprador: dadosOriginais.estatisticas_grupo.maior_comprador || null
  };
}

const grupo = dadosFinais.grupos[GRUPO_PRINCIPAL];

console.log('\n' + '='.repeat(70));
console.log('✅ MIGRAÇÃO CONCLUÍDA!\n');
console.log(`📊 Total migrados: ${totalMigrados}`);
console.log(`\n🏆 GRUPO: ${GRUPO_PRINCIPAL}`);
console.log(`   Usuários: ${grupo.estatisticas.total_usuarios}`);
console.log(`   Compras: ${grupo.estatisticas.total_compras_realizadas}`);
console.log(`   Maior: ${grupo.estatisticas.maior_comprador?.nome} (${grupo.estatisticas.maior_comprador?.total_gb}GB)`);
console.log(`\n💾 Salvo em: ${OUTPUT_PATH}`);
console.log('='.repeat(70));
console.log('\n✅ TUDO CERTO! Execute agora:');
console.log('   cp database/users_final.json database/users.json');
console.log('   node debug_ranking.js');
console.log('   pm2 restart mega-bot');
