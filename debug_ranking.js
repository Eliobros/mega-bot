const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(__dirname, 'database', 'users.json');
const dados = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));

console.log('🔍 VERIFICANDO ESTRUTURA E RANKINGS...\n');

if (dados.grupos) {
  Object.keys(dados.grupos).forEach(groupJid => {
    const grupo = dados.grupos[groupJid];
    console.log(`📱 Grupo: ${groupJid}`);
    console.log(`👥 Total usuários: ${Object.keys(grupo.usuarios).length}`);
    console.log(`📊 Total compras: ${grupo.estatisticas?.total_compras_realizadas || 0}\n`);
    
    // Calcular ranking
    const ranking = Object.entries(grupo.usuarios)
      .map(([jid, u]) => ({ 
        jid, 
        nome: u.nome, 
        numero: u.numero,
        gb: u.total_gb_acumulado,
        compras: u.total_compras 
      }))
      .sort((a, b) => b.gb - a.gb);
    
    console.log('🏆 RANKING COMPLETO:\n');
    ranking.forEach((u, i) => {
      const destaque = i === 0 ? '👑' : `${i+1}.`;
      console.log(`${destaque} ${u.nome.padEnd(25)} - ${u.gb.toFixed(2)}GB (${u.compras} compras)`);
      console.log(`   └─ JID: ${u.jid}`);
      console.log(`   └─ Número: ${u.numero}\n`);
    });
    
    console.log('='.repeat(70) + '\n');
  });
} else {
  console.log('❌ Formato antigo detectado! Precisa migrar.');
}
