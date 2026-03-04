/**
 * Comando: renewvip
 * Categoria: dono
 * Descrição: Renova o VIP de um usuário
 * Uso: !renewvip @usuario [dias]
 */
class RenewVipCommand {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;
        
        this.name = 'renewvip';
        this.aliases = ['renovarvip', 'viprenew', 'extendvip'];
        this.description = 'Renova o VIP de um usuário';
        this.usage = '!renewvip @usuario [dias]';
        
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
                          '💡 Exemplo:\n' +
                          '• !renewvip @usuario → +30 dias\n' +
                          '• !renewvip @usuario 60 → +60 dias'
                });
            }

            const days = parseInt(args[0]) || 30;

            if (days <= 0 || days > 365) {
                return await this.sock.sendMessage(from, {
                    text: '⚠️ Dias deve estar entre 1 e 365!'
                });
            }

            // Renovar VIP
            this.dataManager.renewVip(mentionedJid, days);

            const vipData = this.dataManager.getVipData(mentionedJid);
            const userNumber = mentionedJid.split('@')[0];
            const newEndDate = new Date(vipData.endDate).toLocaleDateString('pt-BR');
            const daysRemaining = this.dataManager.getVipDaysRemaining(mentionedJid);

            await this.sock.sendMessage(from, {
                text: `✅ *VIP RENOVADO!*\n\n` +
                      `👤 Usuário: @${userNumber}\n` +
                      `➕ Dias adicionados: ${days}\n` +
                      `⏰ Total de dias: ${daysRemaining}\n` +
                      `📅 Nova validade: ${newEndDate}`,
                mentions: [mentionedJid]
            });

        } catch (error) {
            console.error('Erro no comando renewvip:', error);
            await this.sock.sendMessage(from, {
                text: `❌ Erro: ${error.message}`
            });
        }
    }
}

module.exports = RenewVipCommand;
