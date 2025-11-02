// ===== COMMANDS/DONO/LICENSA.JS =====
// Comando para gerenciar licenças de grupos

const fs = require('fs');
const path = require('path');

class LicencaCommand {
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

    async execute(msg, args, groupJid, senderJid) {
        console.log('\n========== LICENCA COMMAND INICIADO ==========');
        console.log('- GroupJid:', groupJid);
        console.log('- SenderJid:', senderJid);
        console.log('- Args:', args);
        console.log('=============================================\n');

        const prefix = this.getPrefix();
        const isGroup = groupJid.endsWith('@g.us');

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

        // Verifica se é grupo
        if (!isGroup) {
            await this.sendMessage(groupJid, '❌ Este comando só funciona em grupos!');
            return;
        }

        const subcommand = args[0]?.toLowerCase();

        if (!subcommand) {
            await this.showHelp(groupJid, prefix);
            return;
        }

        const assinatura = this.dataManager.getGroupSubscription(groupJid);

        switch (subcommand) {
            case 'info':
            case 'status':
                await this.showInfo(groupJid, assinatura);
                break;

            case 'add':
            case 'adicionar':
                await this.addDays(groupJid, assinatura, args);
                break;

            case 'renovar':
            case 'renew':
                await this.renewSubscription(groupJid, assinatura, args);
                break;

            case 'desativar':
            case 'disable':
                await this.deactivate(groupJid);
                break;

            case 'ativar':
            case 'enable':
                await this.activate(groupJid, assinatura);
                break;

            default:
                await this.sendMessage(groupJid, `❌ Subcomando inválido.\nUse: ${prefix}licenca para ver os comandos.`);
        }
    }

    async showHelp(groupJid, prefix) {
        let helpMsg = `📋 *Comandos de Licença*\n\n`;
        helpMsg += `• ${prefix}licenca info\n`;
        helpMsg += `  Ver status da licença\n\n`;
        helpMsg += `• ${prefix}licenca add [dias]\n`;
        helpMsg += `  Adicionar dias (padrão: 30)\n\n`;
        helpMsg += `• ${prefix}licenca renovar [dias]\n`;
        helpMsg += `  Renovar licença\n\n`;
        helpMsg += `• ${prefix}licenca desativar\n`;
        helpMsg += `  Desativar grupo\n\n`;
        helpMsg += `• ${prefix}licenca ativar\n`;
        helpMsg += `  Reativar grupo\n\n`;
        helpMsg += `⚠️ *Apenas o dono pode usar estes comandos*`;

        await this.sendMessage(groupJid, helpMsg);
    }

    async showInfo(groupJid, assinatura) {
        if (!assinatura) {
            await this.sendMessage(groupJid, '❌ Este grupo não tem licença ativa.');
            return;
        }

        const agora = new Date();
        const expira = new Date(assinatura.endDate);
        const diasRestantes = Math.ceil((expira - agora) / (1000 * 60 * 60 * 24));
        
        let status = '✅ ATIVA';
        if (agora > expira) {
            status = '❌ EXPIRADA';
        } else if (diasRestantes <= 3) {
            status = '⚠️ EXPIRANDO';
        }

        let infoMsg = `📊 *Status da Licença*\n\n`;
        infoMsg += `Status: ${status}\n`;
        infoMsg += `Início: ${new Date(assinatura.startDate).toLocaleDateString('pt-BR')}\n`;
        infoMsg += `Expira: ${expira.toLocaleDateString('pt-BR')}\n`;
        infoMsg += `Dias restantes: ${diasRestantes > 0 ? diasRestantes : 0} dias\n`;
        infoMsg += `Ativa: ${assinatura.active ? 'Sim' : 'Não'}\n\n`;

        // Mostra histórico se existir
        if (assinatura.history && assinatura.history.length > 0) {
            infoMsg += `📜 *Histórico:*\n`;
            const lastThree = assinatura.history.slice(-3);
            for (const h of lastThree) {
                const data = new Date(h.date).toLocaleDateString('pt-BR');
                const acao = h.action === 'created' ? 'Criada' : 'Renovada';
                infoMsg += `• ${data} - ${acao} (+${h.days}d)\n`;
            }
        }

        await this.sendMessage(groupJid, infoMsg);
    }

    async addDays(groupJid, assinatura, args) {
        const dias = parseInt(args[1]) || 30;

        if (!assinatura) {
            const nova = this.dataManager.addGroupSubscription(groupJid, dias);
            await this.sendMessage(groupJid,
                `✅ *Licença criada!*\n\n` +
                `Dias: ${dias}\n` +
                `Expira em: ${new Date(nova.endDate).toLocaleDateString('pt-BR')}`
            );
        } else {
            this.dataManager.renewGroupSubscription(groupJid, dias);
            const atualizada = this.dataManager.getGroupSubscription(groupJid);
            await this.sendMessage(groupJid,
                `✅ *${dias} dias adicionados!*\n\n` +
                `Nova data de expiração: ${new Date(atualizada.endDate).toLocaleDateString('pt-BR')}`
            );
        }
    }

    async renewSubscription(groupJid, assinatura, args) {
        const dias = parseInt(args[1]) || 30;

        if (this.dataManager.renewGroupSubscription(groupJid, dias)) {
            const renovada = this.dataManager.getGroupSubscription(groupJid);
            await this.sendMessage(groupJid,
                `✅ *Licença renovada!*\n\n` +
                `Dias adicionados: ${dias}\n` +
                `Nova data: ${new Date(renovada.endDate).toLocaleDateString('pt-BR')}`
            );
        } else {
            await this.sendMessage(groupJid, '❌ Erro ao renovar. Use !licenca add primeiro.');
        }
    }

    async deactivate(groupJid) {
        this.dataManager.deactivateGroupSubscription(groupJid);
        await this.sendMessage(groupJid, '❌ *Licença desativada!*\n\nO bot não responderá mais neste grupo.');
    }

    async activate(groupJid, assinatura) {
        if (assinatura) {
            assinatura.active = true;
            this.dataManager.saveGroupSubscriptionsData();
            await this.sendMessage(groupJid, '✅ *Licença reativada!*');
        } else {
            await this.sendMessage(groupJid, '❌ Não há licença para reativar. Use !licenca add primeiro.');
        }
    }

    async sendMessage(jid, text, options = {}) {
        try {
            await this.sock.sendMessage(jid, { text, ...options });
        } catch (err) {
            console.error("❌ Erro ao enviar mensagem:", err);
        }
    }
}

module.exports = LicencaCommand;
