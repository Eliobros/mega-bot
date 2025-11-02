// ===== COMMANDS/DONO/LICENSAS.JS =====
// Comando para listar todas as licenças

const fs = require('fs');
const path = require('path');

class LicencasCommand {
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

    async execute(msg, args, groupJid, senderJid) {
        console.log('\n========== LICENSAS COMMAND INICIADO ==========');
        console.log('- GroupJid:', groupJid);
        console.log('- SenderJid:', senderJid);
        console.log('=============================================\n');

        // Extrai o número do remetente
        let senderNumber = null;
        if (Array.isArray(senderJid)) {
            senderJid = senderJid[0];
        }
        if (typeof senderJid === 'string') {
            senderNumber = senderJid
                .replace(/(@s\.whatsapp\.net|@lid|@c\.us)/g, '')
                .split('@')[0];
        }

        // Verifica se é o dono
        const isDono = this.dataManager.isDono(senderNumber);
        if (!isDono) {
            await this.sendMessage(groupJid, '❌ Apenas o dono pode usar este comando!');
            return;
        }

        const data = this.dataManager.getGroupSubscriptionsData();
        const agora = new Date();

        let texto = `📊 *LICENÇAS ATIVAS*\n\n`;
        let ativas = 0;
        let expiradas = 0;
        let expirando = 0;

        if (!data.assinaturas || data.assinaturas.length === 0) {
            await this.sendMessage(groupJid, '📋 Nenhuma licença cadastrada ainda.');
            return;
        }

        for (const ass of data.assinaturas) {
            const expira = new Date(ass.endDate);
            const diasRestantes = Math.ceil((expira - agora) / (1000 * 60 * 60 * 24));

            let status = '';
            if (!ass.active || agora > expira) {
                status = '❌ EXPIRADA';
                expiradas++;
            } else if (diasRestantes <= 3) {
                status = `⚠️ ${diasRestantes}d restantes`;
                expirando++;
            } else {
                status = `✅ ${diasRestantes}d restantes`;
                ativas++;
            }

            // Pega info do grupo
            let groupName = 'Grupo Desconhecido';
            try {
                const metadata = await this.sock.groupMetadata(ass.groupId);
                groupName = metadata.subject;
            } catch (e) {
                // Se não conseguir pegar o nome, usa o ID
                groupName = ass.groupId.split('@')[0];
            }

            texto += `${status}\n`;
            texto += `Grupo: ${groupName}\n`;
            texto += `Expira: ${expira.toLocaleDateString('pt-BR')}\n\n`;
        }

        texto += `━━━━━━━━━━━━━━━━\n`;
        texto += `Total: ${data.assinaturas.length}\n`;
        texto += `✅ Ativas: ${ativas}\n`;
        texto += `⚠️ Expirando: ${expirando}\n`;
        texto += `❌ Expiradas: ${expiradas}`;

        await this.sendMessage(groupJid, texto);
    }

    async sendMessage(jid, text, options = {}) {
        try {
            await this.sock.sendMessage(jid, { text, ...options });
        } catch (err) {
            console.error("❌ Erro ao enviar mensagem:", err);
        }
    }
}

module.exports = LicencasCommand;
