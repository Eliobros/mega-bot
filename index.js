const Bot = require('./src/Bot');

const MEU_NUMERO = '258862840075'; 

const bot = new Bot(MEU_NUMERO);

// Gerenciar encerramento gracioso
process.on('SIGINT', () => {
    console.log('\n👋 Encerrando bot...');
    process.exit(0);
});

// Iniciar o bot
console.log('🚀 Iniciando WhatsApp Bot...');
bot.start().catch(console.error);
