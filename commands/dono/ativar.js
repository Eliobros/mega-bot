// ===== COMMANDS/DONO/ATIVAR.JS =====
// Comando para ativar WhatsApp com Alauda API

const fs = require('fs');
const path = require('path');
const whatsappValidator = require('../../handlers/WhatsAppValidator');

class AtivarCommand {
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

    async execute(msg, args, groupJid, senderJid) {
        console.log('\n========== ATIVAR COMMAND INICIADO ==========');
        console.log('🔍 DEBUG ATIVAR COMMAND:');
        console.log('- GroupJid:', groupJid);
        console.log('- SenderJid:', senderJid);
        console.log('- Args:', JSON.stringify(args));
        console.log('=============================================\n');

        const prefix = this.getPrefix();
        const isGroup = groupJid.endsWith('@g.us');

        // ⚠️ COMANDO SÓ FUNCIONA EM GRUPOS
        if (!isGroup) {
            await this.sendMessage(groupJid,
                `❌ *Comando apenas para grupos*\n\n` +
                `Este comando só pode ser usado em grupos.\n` +
                `Cada grupo precisa ser ativado individualmente.`
            );
            return;
        }

        // ✅ EXTRAÇÃO DO NÚMERO DO REMETENTE (para log)
        let senderNumber = null;

        if (msg.key.participantAlt) {
            senderNumber = msg.key.participantAlt
                .replace(/(@s\.whatsapp\.net|@lid|@c\.us)/g, '')
                .split('@')[0];
        } else if (msg.key.participant) {
            senderNumber = msg.key.participant
                .replace(/(@s\.whatsapp\.net|@lid|@c\.us)/g, '')
                .split('@')[0];
        } else if (senderJid) {
            if (Array.isArray(senderJid)) {
                senderJid = senderJid[0];
            }
            if (typeof senderJid === 'string') {
                senderNumber = senderJid
                    .replace(/(@s\.whatsapp\.net|@lid|@c\.us)/g, '')
                    .split('@')[0];
            }
        }

        console.log('📱 Número do solicitante:', senderNumber);
        console.log('🆔 Group ID:', groupJid);

        // Verifica se a chave foi fornecida
        if (args.length === 0) {
            await this.sendMessage(groupJid,
                `❌ *Uso incorreto*\n\n` +
                `📝 *Como usar:*\n` +
                `${prefix}ativar <sua_chave>\n\n` +
                `📌 *Exemplo:*\n` +
                `${prefix}ativar alauda_live_abc123xyz\n\n` +
                `💡 *Obtenha sua chave em:*\n` +
                `https://alauda-api.com`
            );
            return;
        }

        const apiKey = args[0];

        // Valida formato da chave
        if (!apiKey.startsWith('alauda_live_') && !apiKey.startsWith('alauda_test_')) {
            await this.sendMessage(groupJid,
                `❌ *Chave inválida*\n\n` +
                `A chave deve começar com:\n` +
                `• alauda_live_... (produção)\n` +
                `• alauda_test_... (teste)`
            );
            return;
        }

        // Envia mensagem de processamento
        await this.sendMessage(groupJid,
            `⏳ *Ativando grupo...*\n\n` +
            `Aguarde enquanto validamos sua chave...`
        );

        // Pega informações do grupo
        let groupName = 'Grupo Desconhecido';
        let botNumber = null;

        try {
            const groupMetadata = await this.sock.groupMetadata(groupJid);
            groupName = groupMetadata.subject;
            console.log('📋 Nome do grupo:', groupName);

            // Tenta pegar o número do bot
            const botJid = this.sock.user?.id?.split(':')[0];
            if (botJid) {
                botNumber = botJid.replace(/(@s\.whatsapp\.net|@c\.us)/g, '');
                console.log('🤖 Número do bot:', botNumber);
            }
        } catch (error) {
            console.error('⚠️ Erro ao obter metadados do grupo:', error);
        }

        console.log('🔐 Ativando grupo na Alauda API...');
        console.log('- Group ID:', groupJid);
        console.log('- Group Name:', groupName);
        console.log('- API Key:', apiKey);
        console.log('- Solicitante:', senderNumber);

        // Tenta ativar o GRUPO (não o número)
        const result = await whatsappValidator.activate(
            groupJid,      // ← Agora usa o ID do grupo
            apiKey,
            groupName,
            botNumber
        );

        if (result.success) {
            console.log('✅ Ativação bem-sucedida!');
            console.log('- Créditos disponíveis:', result.credits);

            let successMsg = `✅ *GRUPO ATIVADO COM SUCESSO!*\n\n`;
            successMsg += `🏪 *Grupo:* ${groupName}\n`;
            successMsg += `🆔 *ID:* ${groupJid.split('@')[0]}\n`;
            successMsg += `💰 *Créditos disponíveis:* ${result.credits}\n`;
            successMsg += `💵 *Custo por operação:* 50 créditos\n\n`;
            successMsg += `🤖 *O bot agora está ativo neste grupo!*\n\n`;
            successMsg += `🛡️ *Proteção ativa:*\n`;
            successMsg += `• Anti-Status Mention\n`;
            successMsg += `• Detecção automática\n`;
            successMsg += `• Remoção imediata de infratores\n\n`;
            successMsg += `⚠️ *Importante:*\n`;
            successMsg += `• Cada remoção consome 50 créditos\n`;
            successMsg += `• Mantenha sua conta com saldo\n`;
            successMsg += `• A proteção vale apenas para ESTE grupo\n\n`;
            successMsg += `💡 Para ativar em outro grupo, use o comando novamente lá.`;

            await this.sendMessage(groupJid, successMsg);

            // Log para o dono
            try {
                const donoData = this.dataManager.getDonoData();
                const donoJid = donoData.NumeroDono + '@s.whatsapp.net';

                let logMsg = `🔔 *NOVA ATIVAÇÃO DE GRUPO*\n\n`;
                logMsg += `🏪 *Grupo:* ${groupName}\n`;
                logMsg += `🆔 *Group ID:* ${groupJid}\n`;
                logMsg += `👤 *Ativado por:* +${senderNumber || 'Desconhecido'}\n`;
                logMsg += `🔑 *API Key:* ${apiKey}\n`;
                logMsg += `💰 *Créditos:* ${result.credits}\n`;
                logMsg += `📅 *Data:* ${new Date().toLocaleString('pt-BR')}`;

                await this.sendMessage(donoJid, logMsg);
                console.log('📤 Log enviado para o dono');
            } catch (error) {
                console.error('⚠️ Erro ao enviar log para dono:', error);
            }

        } else {
            console.log('❌ Erro na ativação:', result.message);

            let errorMsg = `❌ *ERRO AO ATIVAR GRUPO*\n\n`;
            errorMsg += `${result.message}\n\n`;
            errorMsg += `💡 *Verifique se:*\n`;
            errorMsg += `• A chave está correta\n`;
            errorMsg += `• A chave está ativa\n`;
            errorMsg += `• Você tem créditos suficientes (mínimo 50)\n`;
            errorMsg += `• A chave não está expirada ou suspensa\n\n`;
            errorMsg += `🔗 *Precisa de ajuda?*\n`;
            errorMsg += `Acesse: https://alauda-api.com/suporte`;

            await this.sendMessage(groupJid, errorMsg);
        }

        console.log('🎉 Comando !ativar finalizado\n');
    }

    async showHelp(groupJid) {
        const prefix = this.getPrefix();

        let helpMsg = `🔐 *Comando Ativar*\n\n`;
        helpMsg += `📝 *Como usar:*\n`;
        helpMsg += `${prefix}ativar <sua_chave>\n\n`;
        helpMsg += `📌 *Exemplo:*\n`;
        helpMsg += `${prefix}ativar alauda_live_abc123\n\n`;
        helpMsg += `💡 *O que faz:*\n`;
        helpMsg += `Ativa a proteção anti-status mention\n`;
        helpMsg += `neste grupo específico.\n\n`;
        helpMsg += `🛡️ *Proteção:*\n`;
        helpMsg += `• Detecta quem marca o grupo no status\n`;
        helpMsg += `• Remove automaticamente o infrator\n`;
        helpMsg += `• Consome 50 créditos por remoção\n\n`;
        helpMsg += `⚠️ *Importante:*\n`;
        helpMsg += `• Cada grupo precisa ser ativado individualmente\n`;
        helpMsg += `• Comando só funciona em grupos\n`;
        helpMsg += `• Mantenha créditos na conta\n\n`;
        helpMsg += `🔗 *Obter chave:*\n`;
        helpMsg += `https://alauda-api.com`;

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

module.exports = AtivarCommand;
