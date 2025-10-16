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
            const data = JSON.parse(fs.readFileSync(this.donoFile));
            
            // ⚠️ VALIDAÇÃO: Garantir que NumeroDono existe e não é o número chinês
            if (!data.NumeroDono || data.NumeroDono.startsWith('86')) {
                console.error('⚠️ ATENÇÃO: NumeroDono inválido no dono.json!');
                console.error('   Valor atual:', data.NumeroDono);
                console.error('   Por favor, corrija para seu número real (ex: 258862840075)');
            }
            
            return data;
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
        const validPrefixes = ['!', '/', '.', '#', '*', '>', '<', '?', '+', '-', '=', '@', '$', '%', '&', '~'];

        if (validPrefixes.includes(prefix)) {
            return true;
        }

        if (prefix.length === 1 && !/[a-zA-Z0-9\s]/.test(prefix)) {
            return true;
        }

        return false;
    }

    async execute(msg, args, groupJid, senderJid) {
        const config = this.getConfig();
        const currentPrefix = this.getCurrentPrefix();

        // ✅ VALIDAÇÃO MELHORADA - Extrair apenas os números
        const donoNumber = config.NumeroDono;
        const senderNumber = senderJid.split('@')[0]; // Remove tudo depois do @
        
        // LOGS DE DEBUG
        console.log('🔍 DEBUG SETPREFIX:');
        console.log('   - Dono no config:', donoNumber);
        console.log('   - Sender extraído:', senderNumber);
        console.log('   - SenderJid completo:', senderJid);
        console.log('   - São iguais?', senderNumber === donoNumber);

        // Verificar se é o dono
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

                    // ✅ USAR NÚMERO CORRETO para enviar log
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
            return '!';
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
