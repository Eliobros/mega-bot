const fs = require('fs');
const path = require('path');

class JoinCommand {
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

        console.log('\n============ VERIFICAÇÃO DONO (JOIN) ============');
        console.log('📱 Sender:', senderNumber);
        console.log('👑 Dono:', donoNumber);
        console.log('✅ É Dono?:', isDono ? '✅ SIM' : '❌ NÃO');
        console.log('================================================\n');

        return isDono;
    }

    async execute(msg, args, groupJid, senderJid) {
        console.log('\n========== JOIN COMMAND INICIADO ==========');
        console.log('🔍 Args:', args);
        console.log('📱 Sender:', senderJid);
        console.log('==========================================\n');

        const prefix = this.getPrefix();

        // ⚠️ APENAS DONO PODE USAR
        if (!this.isDono(senderJid)) {
            console.log('⛔ ACESSO NEGADO: Não é o dono');
            await this.sendMessage(groupJid, '❌ Apenas o dono pode usar este comando!');
            return;
        }

        // Verificar se o link foi fornecido
        if (args.length === 0) {
            await this.showHelp(groupJid);
            return;
        }

        const inviteLink = args[0];

        // Validar formato do link
        if (!inviteLink.includes('chat.whatsapp.com/')) {
            await this.sendMessage(groupJid, '❌ Link inválido!\n\n💡 Envie um link válido do WhatsApp:\n`https://chat.whatsapp.com/xxxxx`');
            return;
        }

        try {
            // Extrair código do convite
            const inviteCode = inviteLink.split('chat.whatsapp.com/')[1];

            console.log('🔗 Link fornecido:', inviteLink);
            console.log('🎫 Código do convite:', inviteCode);

            // Enviar mensagem de processamento
            await this.sendMessage(groupJid, '⏳ Entrando no grupo...');

            // Aceitar convite
            const result = await this.sock.groupAcceptInvite(inviteCode);

            console.log('✅ Entrou no grupo:', result);

            // Pegar informações do novo grupo
            try {
                const groupMetadata = await this.sock.groupMetadata(result);
                
                let successMsg = `✅ *Entrei no grupo com sucesso!*\n\n`;
                successMsg += `📝 *Nome:* ${groupMetadata.subject}\n`;
                successMsg += `🆔 *ID:* \`${result}\`\n`;
                successMsg += `👥 *Membros:* ${groupMetadata.participants.length}\n`;
                successMsg += `📅 *Criado:* ${new Date(groupMetadata.creation * 1000).toLocaleDateString('pt-BR')}`;

                await this.sendMessage(groupJid, successMsg);

                // Enviar mensagem de boas-vindas no novo grupo
                await this.sendGreeting(result, groupMetadata.subject);

            } catch (e) {
                console.log('⚠️ Erro ao buscar metadata:', e.message);
                await this.sendMessage(groupJid, `✅ Entrei no grupo!\n🆔 ID: \`${result}\``);
            }

        } catch (error) {
            console.error('\n❌ ========== ERRO AO ENTRAR NO GRUPO ==========');
            console.error('Erro completo:', error);
            console.error('Status Code:', error.output?.statusCode);
            console.error('Mensagem:', error.message);
            console.error('===============================================\n');

            let errorMsg = '❌ *Erro ao entrar no grupo!*\n\n';

            if (error.output?.statusCode === 401) {
                errorMsg += '🔐 *Motivo:* Link expirado ou inválido';
            } else if (error.output?.statusCode === 403) {
                errorMsg += '⛔ *Motivo:* Acesso negado (grupo privado/banido)';
            } else if (error.output?.statusCode === 404) {
                errorMsg += '❓ *Motivo:* Grupo não encontrado';
            } else if (error.message?.includes('already')) {
                errorMsg += '✅ *Já estou neste grupo!*';
            } else {
                errorMsg += `🔧 *Motivo:* ${error.message || 'Desconhecido'}`;
            }

            await this.sendMessage(groupJid, errorMsg);
        }
    }

    // Enviar mensagem de boas-vindas no novo grupo
    async sendGreeting(groupJid, groupName) {
        try {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Aguarda 2s

            let greeting = `👋 *Olá, pessoal!*\n\n`;
            greeting += `Sou a Tina, assistente virtual! 🤖\n\n`;
            greeting += `🎯 *Fui adicionada ao grupo:*\n`;
            greeting += `📝 ${groupName}\n\n`;
            greeting += `💬 *Como usar:*\n`;
            greeting += `Digite o comando de ajuda para ver todas as minhas funções!\n\n`;
            greeting += `✨ Prazer em estar aqui!`;

            await this.sendMessage(groupJid, greeting);
            console.log('✅ Mensagem de boas-vindas enviada');
        } catch (e) {
            console.log('⚠️ Erro ao enviar boas-vindas:', e.message);
        }
    }

    async showHelp(groupJid) {
        const prefix = this.getPrefix();

        let helpMsg = `🔗 *Comando Join*\n\n`;
        helpMsg += `📝 *Como usar:*\n`;
        helpMsg += `\`${prefix}join <link_do_grupo>\`\n\n`;
        helpMsg += `💡 *Exemplo:*\n`;
        helpMsg += `\`${prefix}join https://chat.whatsapp.com/xxxxx\`\n\n`;
        helpMsg += `⚠️ *Requisitos:*\n`;
        helpMsg += `• ⚡ Apenas o dono pode usar\n`;
        helpMsg += `• 🔗 Link deve ser válido e ativo\n`;
        helpMsg += `• 👥 Grupo não pode estar cheio\n\n`;
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

module.exports = JoinCommand;
