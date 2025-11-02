const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(__dirname, 'database', 'users.json');

console.log('🔍 VERIFICANDO DADOS ATUAIS...\n');

// Ler dados
const dados = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));

console.log(`📋 Total de registros: ${dados.users.length}\n`);

// Estrutura para organizar por grupo e usuário
const grupos = {};

dados.users.forEach((user) => {
  try {
    const groupJid = user.number.key.remoteJid;
    const participantJid = user.number.key.participant;
    const pushName = user.number.pushName || participantJid.split('@')[0];
    
    // Inicializar grupo
    if (!grupos[groupJid]) {
      grupos[groupJid] = {
        usuarios: {},
        totalCompras: 0
      };
    }
    
    // Inicializar usuário
    if (!grupos[groupJid].usuarios[participantJid]) {
      grupos[groupJid].usuarios[participantJid] = {
        nome: pushName,
        numero: participantJid.replace('@lid', ''),
        totalCompras: 0,
        totalGB: 0
      };
    }
    
    const usuario = grupos[groupJid].usuarios[participantJid];
    
    // Contar compras
    if (user.compras && Array.isArray(user.compras)) {
      usuario.totalCompras += user.compras.length;
      grupos[groupJid].totalCompras += user.compras.length;
      
      // Somar MB
      user.compras.forEach(compra => {
        usuario.totalGB += (compra.quantidadeMB || 0) / 1024;
      });
    }
    
    // Adicionar totalAcumuladoMB se existir
    if (user.totalAcumuladoMB) {
      usuario.totalGB += user.totalAcumuladoMB / 1024;
    }
    
  } catch (err) {
    console.error('❌ Erro ao processar registro:', err.message);
  }
});

// Exibir relatório por grupo
console.log('📊 RELATÓRIO POR GRUPO:\n');
console.log('='.repeat(60));

Object.keys(grupos).forEach((groupJid) => {
  const grupo = grupos[groupJid];
  const usuarios = Object.entries(grupo.usuarios)
    .map(([jid, u]) => ({ ...u, jid }))
    .sort((a, b) => b.totalGB - a.totalGB);
  
  console.log(`\n🏢 Grupo: ${groupJid}`);
  console.log(`👥 Total de compradores: ${usuarios.length}`);
  console.log(`🛒 Total de compras: ${grupo.totalCompras}`);
  
  if (usuarios.length > 0) {
    const maiorComprador = usuarios[0];
    console.log(`👑 Maior comprador: ${maiorComprador.nome}`);
    console.log(`   └─ ${maiorComprador.totalGB.toFixed(2)}GB acumulado (${maiorComprador.totalCompras} compras)`);
    
    console.log(`\n🏆 TOP 10 COMPRADORES:`);
    usuarios.slice(0, 10).forEach((u, i) => {
      console.log(`   ${i+1}. ${u.nome.padEnd(20)} - ${u.totalGB.toFixed(2)}GB (${u.totalCompras} compras)`);
    });
  }
  
  console.log('\n' + '-'.repeat(60));
});

// Totais gerais
const totalGeral = Object.values(grupos).reduce((sum, g) => sum + g.totalCompras, 0);
const usuariosGeral = Object.values(grupos).reduce((sum, g) => sum + Object.keys(g.usuarios).length, 0);

console.log('\n📈 TOTAIS GERAIS:');
console.log(`   Total de grupos: ${Object.keys(grupos).length}`);
console.log(`   Total de compradores únicos: ${usuariosGeral}`);
console.log(`   Total de compras: ${totalGeral}`);
console.log('\n✅ Verificação concluída!\n');
