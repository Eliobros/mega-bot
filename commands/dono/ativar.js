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
        console.log('- msg.key:', JSON.stringify(msg.key, null, 2));
        console.log('=============================================\n');

        const prefix = this.getPrefix();
        const isGroup = groupJid.endsWith('@g.us');

        // ✅ EXTRAÇÃO CORRETA DO NÚMERO COM BAILEYS NOVO
        let senderNumber = null;

        // 1. Tenta pegar do participantAlt (número real)
        if (msg.key.participantAlt) {
            senderNumber = msg.key.participantAlt
                .replace(/(@s\.whatsapp\.net|@lid|@c\.us)/g, '')
                .split('@')[0];
            console.log('✅ Número extraído de participantAlt:', senderNumber);
        }
        // 2. Fallback: tenta do participant (pode ser LID)
        else if (msg.key.participant) {
            const participant = msg.key.participant;
            senderNumber = participant
                .replace(/(@s\.whatsapp\.net|@lid|@c\.us)/g, '')
                .split('@')[0];
            console.log('⚠️ Número extraído de participant:', senderNumber);
        }
        // 3. Fallback: tenta do senderJid passado
        else if (senderJid) {
            if (Array.isArray(senderJid)) {
                senderJid = senderJid[0];
            }
            if (typeof senderJid === 'string') {
                senderNumber = senderJid
                    .replace(/(@s\.whatsapp\.net|@lid|@c\.us)/g, '')
                    .split('@')[0];
                console.log('⚠️ Número extraído de senderJid:', senderNumber);
            }
        }

        if (!senderNumber) {
            console.error('❌ Não foi possível extrair o número do remetente');
            await this.sendMessage(groupJid, '⚠️ Erro ao processar o número do remetente.');
            return;
        }

        console.log('📱 Número final para ativação:', senderNumber);

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
            `⏳ *Ativando...*\n\n` +
            `Aguarde enquanto validamos sua chave...`
        );

        // Pega informações do grupo (se for grupo)
        let groupName = null;

        if (isGroup) {
            try {
                const groupMetadata = await this.sock.groupMetadata(groupJid);
                groupName = groupMetadata.subject;
            } catch (error) {
                console.error('⚠️ Erro ao obter metadados do grupo:', error);
            }
        }

        console.log('🔐 Ativando número na Alauda API...');
        console.log('- Número:', senderNumber);
        console.log('- API Key:', apiKey);
        console.log('- Grupo:', groupName || 'Privado');

        // Tenta ativar
        const result = await whatsappValidator.activate(
            senderNumber,
            apiKey,
            isGroup ? groupJid : null,
            groupName
        );

        if (result.success) {
            console.log('✅ Ativação bem-sucedida!');
            console.log('- Créditos disponíveis:', result.credits);

            let successMsg = `✅ *BOT ATIVADO COM SUCESSO!*\n\n`;
            successMsg += `📱 *Número:* +${senderNumber}\n`;
            successMsg += `💰 *Créditos disponíveis:* ${result.credits}\n`;
            successMsg += `💵 *Custo por operação:* 50 créditos\n\n`;

            if (isGroup) {
                successMsg += `🛡️ *Grupo protegido:* ${groupName}\n\n`;
            }

            successMsg += `🤖 *O bot agora está ativo!*\n\n`;
            successMsg += `ℹ️ *Funcionalidades:*\n`;
            successMsg += `• Detecção de menções no status\n`;
            successMsg += `• Sistema de avisos automático\n`;
            successMsg += `• Remoção após 2 avisos\n\n`;
            successMsg += `⚠️ *Importante:*\n`;
            successMsg += `Cada operação consome 50 créditos.\n`;
            successMsg += `Mantenha sua conta sempre com saldo!`;

            await this.sendMessage(groupJid, successMsg);

            // Log para o dono
            try {
                const donoData = this.dataManager.getDonoData();
                const donoJid = donoData.NumeroDono + '@s.whatsapp.net';

                let logMsg = `🔔 *NOVA ATIVAÇÃO*\n\n`;
                logMsg += `📱 *Número:* +${senderNumber}\n`;
                logMsg += `🆔 *API Key:* ${apiKey}\n`;
                logMsg += `💰 *Créditos:* ${result.credits}\n`;
                logMsg += `🏪 *Grupo:* ${groupName || 'Chat Privado'}\n`;
                logMsg += `📅 *Data:* ${new Date().toLocaleString('pt-BR')}`;

                await this.sendMessage(donoJid, logMsg);
                console.log('📤 Log enviado para o dono');
            } catch (error) {
                console.error('⚠️ Erro ao enviar log para dono:', error);
            }

        } else {
            console.log('❌ Erro na ativação:', result.message);

            let errorMsg = `❌ *ERRO AO ATIVAR*\n\n`;
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
        helpMsg += `Ativa o bot no grupo/chat usando\n`;
        helpMsg += `uma chave da Alauda API.\n\n`;
        helpMsg += `⚙️ *Funcionalidades após ativar:*\n`;
        helpMsg += `• Detecta menções no status\n`;
        helpMsg += `• Sistema de avisos\n`;
        helpMsg += `• Remoção automática\n\n`;
        helpMsg += `💰 *Custo:*\n`;
        helpMsg += `50 créditos por operação\n\n`;
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
