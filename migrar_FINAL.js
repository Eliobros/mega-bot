const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(__dirname, 'database', 'users.json');
const OUTPUT_PATH = path.join(__dirname, 'database', 'users_FINAL_CORRETO.json');

console.log('🔧 MIGRAÇÃO DEFINITIVA...\n');

const dados = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));

const GRUPO_PRINCIPAL = '120363401341705925@g.us';

// Criar estrutura limpa
const dadosFinais = {
  grupos: {
    [GRUPO_PRINCIPAL]: {
      usuarios: {},
      estatisticas: {
        total_usuarios: 0,
        total_compras_realizadas: 0,
        ultima_atualizacao: new Date().toISOString().split('T')[0],
        maior_comprador: null
      }
    }
  }
};

// MIGRAR do objeto "usuarios" (linha 1326)
if (dados.usuarios && typeof dados.usuarios === 'object') {
  console.log('📦 Migrando usuários...\n');
  
  let migrados = 0;
  Object.entries(dados.usuarios).forEach(([jid, userData]) => {
    dadosFinais.grupos[GRUPO_PRINCIPAL].usuarios[jid] = {
      nome: userData.nome || userData.pushName || jid.split('@')[0],
      numero: userData.numero || jid.replace('@lid', ''),
      total_compras: userData.total_compras || 0,
      total_gb_acumulado: userData.total_gb_acumulado || 0,
      primeira_compra: userData.primeira_compra || '',
      ultima_compra: userData.ultima_compra || '',
      compras_hoje: 0, // resetar
      historico_compras: userData.historico_compras || []
    };
    
    migrados++;
    if (userData.total_compras > 5) {
      console.log(`   ✅ ${userData.nome} - ${userData.total_gb_acumulado.toFixed(2)}GB (${userData.total_compras} compras)`);
    }
  });
  
  console.log(`\n   Total: ${migrados} usuários\n`);
}

// Copiar estatísticas se existirem
if (dados.estatisticas_grupo) {
  dadosFinais.grupos[GRUPO_PRINCIPAL].estatisticas = {
    total_usuarios: Object.keys(dadosFinais.grupos[GRUPO_PRINCIPAL].usuarios).length,
    total_compras_realizadas: dados.estatisticas_grupo.total_compras_realizadas || 0,
    ultima_atualizacao: dados.estatisticas_grupo.ultima_atualizacao || new Date().toISOString().split('T')[0],
    maior_comprador: dados.estatisticas_grupo.maior_comprador || null
  };
}

// Adicionar outros grupos se existirem
if (dados.grupos) {
  Object.entries(dados.grupos).forEach(([groupId, groupData]) => {
    if (groupId !== GRUPO_PRINCIPAL) {
      dadosFinais.grupos[groupId] = groupData;
    }
  });
}

// Salvar
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(dadosFinais, null, 2));

const grupo = dadosFinais.grupos[GRUPO_PRINCIPAL];
console.log('='.repeat(70));
console.log('✅ SUCESSO!\n');
console.log(`🏆 GRUPO: ${GRUPO_PRINCIPAL}`);
console.log(`   Usuários: ${Object.keys(grupo.usuarios).length}`);
console.log(`   Compras: ${grupo.estatisticas.total_compras_realizadas}`);
console.log(`   Maior: ${grupo.estatisticas.maior_comprador?.nome} - ${grupo.estatisticas.maior_comprador?.total_gb}GB`);
console.log(`\n💾 Arquivo: ${OUTPUT_PATH}`);
console.log('='.repeat(70));
console.log('\n🚀 EXECUTE AGORA:');
console.log('   cp database/users_FINAL_CORRETO.json database/users.json');
console.log('   pm2 restart mega-bot');
console.log('   # Teste fazendo uma compra no grupo!');
