/**
 * Comando: removevip
 * Categoria: dono
 * Descrição: Remove um usuário VIP
 * Uso: !removevip @usuario
 */
class RemoveVipCommand {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;
        
        this.name = 'removevip';
        this.aliases = ['vip-', 'delvip', 'removervip'];
        this.description = 'Remove um usuário VIP';
        this.usage = '!removevip @usuario';
        
        this.onlyDono = true;
        this.onlyAdmin = false;
        this.onlyGroup = false;
    }

    async execute(msg, args, from, sender) {
        try {
            const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            
            if (!mentionedJid) {
                return await this.sock.sendMessage(from, {
                    text: '❌ *Uso incorreto!*\n\n' +
                          `📝 Formato: ${this.usage}\n\n` +
                          '💡 Exemplo: !removevip @usuario'
                });
            }

            // Verificar se é VIP
            const vipData = this.dataManager.getVipData(mentionedJid);
            
            if (!vipData) {
                return await this.sock.sendMessage(from, {
                    text: '⚠️ Este usuário não é VIP!'
                });
            }

            // Remover VIP
            this.dataManager.removeVip(mentionedJid);

            const userNumber = mentionedJid.split('@')[0];

            await this.sock.sendMessage(from, {
                text: `✅ *VIP REMOVIDO!*\n\n` +
                      `👤 Usuário: @${userNumber}\n\n` +
                      `❌ Este usuário não tem mais acesso aos comandos VIP.`,
                mentions: [mentionedJid]
            });

        } catch (error) {
            console.error('Erro no comando removevip:', error);
            await this.sock.sendMessage(from, {
                text: `❌ Erro: ${error.message}`
            });
        }
    }
}

module.exports = RemoveVipCommand;
