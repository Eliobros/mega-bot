const fs = require('fs');
const path = require('path');

class SairCommand {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;
        this.donoFile = path.join(__dirname, '../../database/dono.json');
    }

    getConfig() {
        try {
            return JSON.parse(fs.readFileSync(this.donoFile));
        } catch (error) {
            return { groups: {}, Prefixo: '!', NumeroDono: '' };
        }
    }

    getPrefix() {
        const config = this.getConfig();
        return config.Prefixo || '!';
    }

    getDonoInfo() {
        const donoData = this.dataManager.getDonoData();
        return {
            jid: donoData.NumeroDono + '@s.whatsapp.net',
            number: donoData.NumeroDono
        };
    }

    normalizarNumero(jid) {
        return jid.replace(/\D/g, '');
    }

    // Verificar se é o dono
    isDono(senderJid) {
        const dono = this.getDonoInfo();
        const senderNumber = this.normalizarNumero(senderJid.split('@')[0]);
        const donoNumber = this.normalizarNumero(dono.number);

        const isDono = senderNumber === donoNumber ||
                       senderNumber.includes(donoNumber) ||
                       donoNumber.includes(senderNumber);

        console.log('\n============ VERIFICAÇÃO DONO (SAIR) ============');
        console.log('📱 Sender:', senderNumber);
        console.log('👑 Dono:', donoNumber);
        console.log('✅ É Dono?:', isDono ? '✅ SIM' : '❌ NÃO');
        console.log('=================================================\n');

        return isDono;
    }

    async execute(msg, args, groupJid, senderJid) {
        console.log('\n========== SAIR COMMAND INICIADO ==========');
        console.log('🔍 Args:', args);
        console.log('📱 Sender:', senderJid);
        console.log('🏪 Grupo:', groupJid);
        console.log('==========================================\n');

        const prefix = this.getPrefix();

        // Verificar se é grupo
        if (!groupJid.endsWith('@g.us')) {
            await this.sendMessage(groupJid, '❌ Este comando só funciona em grupos!');
            return;
        }

        // ⚠️ APENAS DONO PODE USAR
        if (!this.isDono(senderJid)) {
            console.log('⛔ ACESSO NEGADO: Não é o dono');
            await this.sendMessage(groupJid, '❌ Apenas o dono pode usar este comando!');
            return;
        }

        try {
            // Pegar informações do grupo
            const groupMetadata = await this.sock.groupMetadata(groupJid);
            const groupName = groupMetadata.subject;
            const memberCount = groupMetadata.participants.length;

            console.log('📋 Informações do grupo:');
            console.log('- Nome:', groupName);
            console.log('- Membros:', memberCount);
            console.log('- ID:', groupJid);

            // Verificar se há confirmação
            const needsConfirm = args[0] !== 'confirm' && args[0] !== 'confirmar';

            if (needsConfirm) {
                let confirmMsg = `⚠️ *CONFIRMAR SAÍDA*\n\n`;
                confirmMsg += `📝 *Grupo:* ${groupName}\n`;
                confirmMsg += `👥 *Membros:* ${memberCount}\n`;
                confirmMsg += `🆔 *ID:* \`${groupJid}\`\n\n`;
                confirmMsg += `❓ *Tem certeza que quer sair?*\n\n`;
                confirmMsg += `✅ Para confirmar, use:\n`;
                confirmMsg += `\`${prefix}sair confirm\`\n\n`;
                confirmMsg += `❌ Para cancelar, ignore esta mensagem.`;

                await this.sendMessage(groupJid, confirmMsg);
                return;
            }

            // Mensagem de despedida
            let goodbyeMsg = `👋 *Até logo!*\n\n`;
            goodbyeMsg += `Saindo do grupo por solicitação do dono.\n\n`;
            goodbyeMsg += `📝 *Grupo:* ${groupName}\n`;
            goodbyeMsg += `⏰ *Saída em:* 5 segundos...\n\n`;
            goodbyeMsg += `✨ Foi um prazer estar aqui!`;

            await this.sendMessage(groupJid, goodbyeMsg);

            console.log('📤 Mensagem de despedida enviada');
            console.log('⏳ Aguardando 5 segundos...');

            // Aguardar 5 segundos
            await new Promise(resolve => setTimeout(resolve, 5000));

            // Sair do grupo
            await this.sock.groupLeave(groupJid);

            console.log('✅ Saiu do grupo com sucesso!');
            console.log('🏪 Grupo:', groupName);
            console.log('🆔 ID:', groupJid);

            // Notificar o dono (em privado)
            const dono = this.getDonoInfo();
            let notifyMsg = `✅ *Saí do grupo com sucesso!*\n\n`;
            notifyMsg += `📝 *Nome:* ${groupName}\n`;
            notifyMsg += `🆔 *ID:* \`${groupJid}\`\n`;
            notifyMsg += `👥 *Tinha:* ${memberCount} membros\n`;
            notifyMsg += `📅 *Data/Hora:* ${new Date().toLocaleString('pt-BR')}`;

            await this.sendMessage(dono.jid, notifyMsg);
            console.log('📬 Notificação enviada ao dono');

        } catch (error) {
            console.error('\n❌ ========== ERRO AO SAIR DO GRUPO ==========');
            console.error('Erro completo:', error);
            console.error('Status Code:', error.output?.statusCode);
            console.error('Mensagem:', error.message);
            console.error('=============================================\n');

            let errorMsg = '❌ *Erro ao sair do grupo!*\n\n';

            if (error.output?.statusCode === 403) {
                errorMsg += '⛔ *Motivo:* Sem permissão para sair';
            } else if (error.output?.statusCode === 404) {
                errorMsg += '❓ *Motivo:* Grupo não encontrado';
            } else {
                errorMsg += `🔧 *Motivo:* ${error.message || 'Desconhecido'}`;
            }

            await this.sendMessage(groupJid, errorMsg);
        }
    }

    async showHelp(groupJid) {
        const prefix = this.getPrefix();

        let helpMsg = `🚪 *Comando Sair*\n\n`;
        helpMsg += `📝 *Como usar:*\n`;
        helpMsg += `\`${prefix}sair\` - Solicitar saída\n`;
        helpMsg += `\`${prefix}sair confirm\` - Confirmar e sair\n\n`;
        helpMsg += `⚠️ *Requisitos:*\n`;
        helpMsg += `• ⚡ Apenas o dono pode usar\n`;
        helpMsg += `• 👥 Só funciona em grupos\n`;
        helpMsg += `• ✅ Requer confirmação\n\n`;
        helpMsg += `💡 *Exemplo de uso:*\n`;
        helpMsg += `1️⃣ Digite \`${prefix}sair\`\n`;
        helpMsg += `2️⃣ Confirme com \`${prefix}sair confirm\`\n`;
        helpMsg += `3️⃣ Bot sai do grupo em 5 segundos\n\n`;
        helpMsg += `🔐 *Segurança:*\n`;
        helpMsg += `Este comando é restrito ao dono por segurança!`;

        await this.sendMessage(groupJid, helpMsg);
    }

    async sendMessage(jid, text, options = {}) {
        try {
            await this.sock.sendMessage(jid, { text, ...options });
        } catch (err) {
            console.error("❌ Erro ao enviar mensagem:", err);
        }
    }
}

module.exports = SairCommand;
