const fs = require('fs');
const path = require('path');

class SetPrefixCommand {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;
        this.donoFile = path.join(__dirname, '../../database/dono.json');
    }

    getConfig() {
        try {
            return JSON.parse(fs.readFileSync(this.donoFile));
        } catch (error) {
            console.error("Erro ao ler dono.json:", error);
            return { Prefixo: '!', NumeroDono: '' };
        }
    }

    saveConfig(config) {
        try {
            fs.writeFileSync(this.donoFile, JSON.stringify(config, null, 2));
            return true;
        } catch (error) {
            console.error("Erro ao salvar dono.json:", error);
            return false;
        }
    }

    getCurrentPrefix() {
        const config = this.getConfig();
        return config.Prefixo || '!';
    }

    isValidPrefix(prefix) {
        // Validar se o prefixo é aceitável
        const validPrefixes = ['!', '/', '.', '#', '*', '>', '<', '?', '+', '-', '=', '@', '$', '%', '&', '~'];

        // Verificar se é um dos prefixos válidos ou se é um caractere único
        if (validPrefixes.includes(prefix)) {
            return true;
        }

        // Permitir apenas 1 caractere e não permitir letras/números/espaços
        if (prefix.length === 1 && !/[a-zA-Z0-9\s]/.test(prefix)) {
            return true;
        }

        return false;
    }

    async execute(msg, args, groupJid, senderJid) {
        const config = this.getConfig();
        const donoJid = config.NumeroDono + '@s.whatsapp.net';
        const currentPrefix = this.getCurrentPrefix();

        // LOGS DE DEBUG PARA IDENTIFICAR O PROBLEMA
        console.log('🔍 DEBUG SETPREFIX:');
        console.log('   - Dono no config:', config.NumeroDono);
        console.log('   - DonoJid construído:', donoJid);
        console.log('   - SenderJid recebido:', senderJid);
        console.log('   - São iguais (método antigo)?', senderJid === donoJid);

        // NOVA VERIFICAÇÃO - Comparar só os números
        const donoNumber = config.NumeroDono;
        const senderNumber = senderJid.replace(/@.*/, ''); // Remove @lid ou @s.whatsapp.net

        console.log('🔍 Comparando apenas números:');
        console.log('   - Dono número:', donoNumber);
        console.log('   - Sender número:', senderNumber);
        console.log('   - São iguais (método novo)?', senderNumber === donoNumber);

        // Verificar se é o dono usando a nova lógica
        if (senderNumber !== donoNumber) {
            await this.sendMessage(groupJid, '❌ *Acesso Negado!*\n\n🔒 Apenas o dono do bot pode alterar o prefixo.');
            return;
        }

        // Se não passou argumentos, mostrar prefixo atual
        if (!args[0]) {
            let helpMsg = `🔧 *Configuração de Prefixo*\n\n`;
            helpMsg += `📌 *Prefixo atual:* \`${currentPrefix}\`\n\n`;
            helpMsg += `📝 *Como usar:*\n`;
            helpMsg += `• \`${currentPrefix}setprefix !\` - Definir ! como prefixo\n`;
            helpMsg += `• \`${currentPrefix}setprefix /\` - Definir / como prefixo\n`;
            helpMsg += `• \`${currentPrefix}setprefix .\` - Definir . como prefixo\n\n`;
            helpMsg += `✅ *Prefixos válidos:*\n`;
            helpMsg += `\`! / . # * > < ? + - = @ $ % & ~\`\n\n`;
            helpMsg += `⚠️ *Nota:* Após alterar, use o novo prefixo nos comandos!`;

            await this.sendMessage(groupJid, helpMsg);
            return;
        }

        const newPrefix = args[0];

        // Verificar se o prefixo é válido
        if (!this.isValidPrefix(newPrefix)) {
            let errorMsg = `❌ *Prefixo inválido!*\n\n`;
            errorMsg += `🚫 *Prefixo rejeitado:* \`${newPrefix}\`\n\n`;
            errorMsg += `✅ *Prefixos aceitos:*\n`;
            errorMsg += `\`! / . # * > < ? + - = @ $ % & ~\`\n\n`;
            errorMsg += `📋 *Regras:*\n`;
            errorMsg += `• Apenas 1 caractere\n`;
            errorMsg += `• Não pode ser letra ou número\n`;
            errorMsg += `• Não pode conter espaços`;

            await this.sendMessage(groupJid, errorMsg);
            return;
        }

        // Verificar se o prefixo já é o atual
        if (newPrefix === currentPrefix) {
            await this.sendMessage(groupJid, `ℹ️ *Nenhuma alteração necessária*\n\n📌 O prefixo \`${newPrefix}\` já está sendo usado atualmente.`);
            return;
        }

        // Salvar novo prefixo
        config.Prefixo = newPrefix;
        const saved = this.saveConfig(config);

        if (saved) {
            let successMsg = `✅ *Prefixo alterado com sucesso!*\n\n`;
            successMsg += `🔄 *Mudança:*\n`;
            successMsg += `   Anterior: \`${currentPrefix}\`\n`;
            successMsg += `   Novo: \`${newPrefix}\`\n\n`;
            successMsg += `📅 *Data:* ${new Date().toLocaleString('pt-BR')}\n\n`;
            successMsg += `💡 *Exemplo de uso:*\n`;
            successMsg += `• \`${newPrefix}help\` - Ver ajuda\n`;
            successMsg += `• \`${newPrefix}antilink status\` - Ver antilink\n`;
            successMsg += `• \`${newPrefix}setprefix ${currentPrefix}\` - Voltar ao anterior\n\n`;
            successMsg += `⚠️ *IMPORTANTE:* Use o novo prefixo \`${newPrefix}\` em todos os comandos!`;

            await this.sendMessage(groupJid, successMsg);

            // Log para o dono (se não for no privado)
            if (groupJid.endsWith('@g.us')) {
                try {
                    const groupMetadata = await this.sock.groupMetadata(groupJid);
                    let logMsg = `🔧 *LOG: Prefixo Alterado*\n\n`;
                    logMsg += `👤 *Alterado por:* Dono\n`;
                    logMsg += `📍 *Local:* ${groupMetadata.subject}\n`;
                    logMsg += `🔄 *Mudança:* \`${currentPrefix}\` → \`${newPrefix}\`\n`;
                    logMsg += `📅 *Data:* ${new Date().toLocaleString('pt-BR')}\n`;
                    logMsg += `🆔 *Grupo:* ${groupJid}`;

                    // Usar o número do dono corrigido para enviar o log
                    const donoJidLog = donoNumber + '@s.whatsapp.net';
                    await this.sendMessage(donoJidLog, logMsg);
                } catch (error) {
                    console.error("Erro ao enviar log:", error);
                }
            }

            console.log(`✅ Prefixo alterado: "${currentPrefix}" → "${newPrefix}" por ${senderJid}`);

        } else {
            await this.sendMessage(groupJid, `❌ *Erro interno!*\n\n🔧 Não foi possível salvar o novo prefixo. Tente novamente.`);
        }
    }

    // Método estático para obter o prefixo atual (usado por outros comandos)
    static getCurrentPrefix() {
        try {
            const donoFile = path.join(__dirname, '../../database/dono.json');
            const config = JSON.parse(fs.readFileSync(donoFile));
            return config.Prefixo || '!';
        } catch (error) {
            return '!'; // Prefixo padrão
        }
    }

    // Método para verificar se uma mensagem usa o prefixo correto
    static hasCorrectPrefix(messageText) {
        const prefix = SetPrefixCommand.getCurrentPrefix();
        return messageText.startsWith(prefix);
    }

    // Método para extrair comando sem o prefixo
    static extractCommand(messageText) {
        const prefix = SetPrefixCommand.getCurrentPrefix();
        if (messageText.startsWith(prefix)) {
            return messageText.slice(prefix.length).trim();
        }
        return messageText;
    }

    async sendMessage(jid, text, options = {}) {
        try {
            await this.sock.sendMessage(jid, { text, ...options });
        } catch (err) {
            console.error("❌ Erro ao enviar mensagem:", err);
        }
    }
}

module.exports = SetPrefixCommand;
