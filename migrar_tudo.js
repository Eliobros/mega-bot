const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(__dirname, 'database', 'users.json');
const OUTPUT_PATH = path.join(__dirname, 'database', 'users_final.json');
const BACKUP_PATH = path.join(__dirname, 'database', 'users_backup_completo.json');

console.log('🔧 MIGRANDO TODOS OS FORMATOS...\n');

// Backup
const dadosOriginais = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
fs.writeFileSync(BACKUP_PATH, JSON.stringify(dadosOriginais, null, 2));
console.log('✅ Backup criado\n');

const GRUPO_PRINCIPAL = '120363401341705925@g.us';

// Estrutura final
const dadosFinais = {
  grupos: {}
};

// Inicializar grupo principal
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

// 1. MIGRAR ARRAY "users" (formato antigo)
if (dadosOriginais.users && Array.isArray(dadosOriginais.users)) {
  console.log(`📦 Migrando ${dadosOriginais.users.length} registros do array "users"...`);
  
  dadosOriginais.users.forEach((user, idx) => {
    try {
      if (!user.number?.key?.participant) return;
      
      const jid = user.number.key.participant;
      const nome = user.number.pushName || user.pushName || jid.split('@')[0];
      
      if (!dadosFinais.grupos[GRUPO_PRINCIPAL].usuarios[jid]) {
        dadosFinais.grupos[GRUPO_PRINCIPAL].usuarios[jid] = {
          nome: nome,
          numero: jid.replace('@lid', ''),
          total_compras: 0,
          total_gb_acumulado: 0,
          primeira_compra: '',
          ultima_compra: '',
          compras_hoje: 0,
          historico_compras: []
        };
      }
      
      const usuario = dadosFinais.grupos[GRUPO_PRINCIPAL].usuarios[jid];
      
      // Adicionar compras
      if (user.compras && Array.isArray(user.compras)) {
        user.compras.forEach(compra => {
          if (!compra.quantidadeMB || isNaN(compra.quantidadeMB)) return;
          
          const data = new Date(compra.data).toISOString().split('T')[0];
          const hora = new Date(compra.data).toLocaleTimeString('pt-BR');
          const gb = compra.quantidadeMB / 1024;
          
          usuario.historico_compras.push({
            data: data,
            hora: hora,
            pacote: compra.pacote,
            quantidade: `${compra.quantidadeMB}MB`,
            preco: compra.pacote,
            gb: gb,
            tipo: 'diario'
          });
          
          usuario.total_compras++;
          usuario.total_gb_acumulado += gb;
          usuario.ultima_compra = data;
          
          if (!usuario.primeira_compra) usuario.primeira_compra = data;
        });
      }
      
      if (user.totalAcumuladoMB && !isNaN(user.totalAcumuladoMB)) {
        usuario.total_gb_acumulado += user.totalAcumuladoMB / 1024;
      }
      
      totalMigrados++;
    } catch (err) {
      console.error(`❌ Erro no registro ${idx}:`, err.message);
    }
  });
}

// 2. MIGRAR USUÁRIOS SOLTOS (formato médio - onde está o Wesley!)
console.log('\n📦 Procurando usuários no formato médio...');
Object.keys(dadosOriginais).forEach(key => {
  if (key.includes('@lid') && typeof dadosOriginais[key] === 'object') {
    const userData = dadosOriginais[key];
    const jid = key;
    
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
    console.log(`   ✅ ${userData.nome} - ${userData.total_gb_acumulado}GB`);
  }
});

// 3. MANTER GRUPOS EXISTENTES (formato novo)
if (dadosOriginais.grupos) {
  console.log('\n📦 Mantendo grupos existentes...');
  Object.keys(dadosOriginais.grupos).forEach(groupId => {
    if (groupId !== GRUPO_PRINCIPAL) {
      dadosFinais.grupos[groupId] = dadosOriginais.grupos[groupId];
    }
  });
}

// 4. ATUALIZAR ESTATÍSTICAS
const grupo = dadosFinais.grupos[GRUPO_PRINCIPAL];
grupo.estatisticas.total_usuarios = Object.keys(grupo.usuarios).length;

let totalCompras = 0;
let maiorComprador = null;
let maiorGB = 0;

Object.entries(grupo.usuarios).forEach(([jid, u]) => {
  totalCompras += u.total_compras;
  if (u.total_gb_acumulado > maiorGB) {
    maiorGB = u.total_gb_acumulado;
    maiorComprador = {
      numero: u.numero,
      nome: u.nome,
      total_gb: u.total_gb_acumulado
    };
  }
});

grupo.estatisticas.total_compras_realizadas = totalCompras;
grupo.estatisticas.maior_comprador = maiorComprador;

// 5. SALVAR
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(dadosFinais, null, 2));

console.log('\n' + '='.repeat(70));
console.log('✅ MIGRAÇÃO CONCLUÍDA!\n');
console.log(`📊 Total de usuários migrados: ${totalMigrados}`);
console.log(`\n🏆 GRUPO PRINCIPAL: ${GRUPO_PRINCIPAL}`);
console.log(`   Usuários: ${grupo.estatisticas.total_usuarios}`);
console.log(`   Compras: ${grupo.estatisticas.total_compras_realizadas}`);
console.log(`   Maior: ${maiorComprador?.nome} (${maiorComprador?.total_gb}GB)`);
console.log(`\n💾 Arquivo salvo em: ${OUTPUT_PATH}`);
console.log(`📦 Backup em: ${BACKUP_PATH}`);
console.log('\n⚠️  REVISE e depois execute:');
console.log('   cp database/users_final.json database/users.json');
console.log('   pm2 restart mega-bot');
