const fs = require("fs");
const path = require("path");

class PrefixoCommand {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;
        this.donoFile = path.join(__dirname, '../../database/dono.json');
    }

    getConfig() {
        try {
            return JSON.parse(fs.readFileSync(this.donoFile));
        } catch (error) {
            return { Prefixo: '!', NumeroDono: '' };
        }
    }

    getPrefix() {
        const config = this.getConfig();
        return config.Prefixo || '!';
    }

    getSaudacao() {
        const hora = new Date().getHours();
        
        if (hora >= 6 && hora < 12) {
            return "Bom dia ☀️";
        } else if (hora >= 12 && hora < 18) {
            return "Boa tarde 🌤️";
        } else if (hora >= 18 && hora < 24) {
            return "Boa noite 🌙";
        } else {
            return "Boa madrugada 🌃";
        }
    }

    async execute(msg, args, from, senderJid) {
        console.log('\n========== PREFIXO COMMAND ==========');
        console.log('📱 From:', from);
        console.log('👤 Sender:', senderJid);
        console.log('=====================================\n');

        const prefix = this.getPrefix();
        const saudacao = this.getSaudacao();
        const pushname = msg.pushName || 'Usuário';

        try {
            const prefixMsg = `╔═══════════════════════╗
║     🤖 *TINA BOT*     ║
╚═══════════════════════╝

👋 Olá, *${pushname}*!
${saudacao}

━━━━━━━━━━━━━━━━━━━━━

⚙️ *PREFIXO ATUAL:*

      ╔═══════╗
      ║  *${prefix}*  ║
      ╚═══════╝

━━━━━━━━━━━━━━━━━━━━━

💡 *COMO USAR:*

   \`${prefix}menu\` → Ver comandos
   \`${prefix}help\` → Ajuda  
   \`${prefix}ping\` → Testar bot

━━━━━━━━━━━━━━━━━━━━━

_Tina Bot v2.0 - Eliobros Tech 🇲🇿_`;

            await this.sock.sendMessage(from, {
                text: prefixMsg,
                mentions: [senderJid]
            }, {
                quoted: msg
            });

            console.log(`✅ Prefixo enviado para ${pushname}`);

        } catch (error) {
            console.error('❌ Erro ao enviar prefixo:', error);
            await this.sock.sendMessage(from, {
                text: '❌ Erro ao exibir prefixo! Tente novamente.'
            });
        }
    }

    // Método para compatibilidade
    async sendMessage(jid, text, options = {}) {
        try {
            await this.sock.sendMessage(jid, { text, ...options });
        } catch (err) {
            console.error("❌ Erro ao enviar mensagem:", err);
        }
    }
}

module.exports = PrefixoCommand;
