const Bot = require('./src/Bot');

// Inicializar o bot
const bot = new Bot();

// Gerenciar encerramento gracioso
process.on('SIGINT', () => {
    console.log('\n👋 Encerrando bot...');
    process.exit(0);
});

// Iniciar o bot
console.log('🚀 Iniciando WhatsApp Bot...');
bot.start().catch(console.error);
