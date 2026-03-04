/**
 * Comando: listvips
 * Categoria: dono
 * Descrição: Lista todos os usuários VIP
 * Uso: !listvips
 */
class ListVipsCommand {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;
        
        this.name = 'listvips';
        this.aliases = ['vips', 'viplist', 'listarvips'];
        this.description = 'Lista todos os usuários VIP';
        this.usage = '!listvips';
        
        this.onlyDono = true;
        this.onlyAdmin = false;
        this.onlyGroup = false;
    }

    async execute(msg, args, from, sender) {
        try {
            const allVips = this.dataManager.getAllVips(false); // Pegar todos, ativos e inativos

            if (allVips.length === 0) {
                return await this.sock.sendMessage(from, {
                    text: '📋 *LISTA DE VIPs*\n\n' +
                          '❌ Nenhum VIP cadastrado.'
                });
            }

            // Separar ativos e inativos
            const now = new Date();
            const actives = [];
            const inactives = [];

            for (const vip of allVips) {
                const endDate = new Date(vip.endDate);
                const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
                
                const userNumber = vip.userNumber || vip.userJid.split('@')[0];
                const endDateStr = endDate.toLocaleDateString('pt-BR');

                if (vip.active && now <= endDate) {
                    actives.push({
                        number: userNumber,
                        days: daysRemaining,
                        endDate: endDateStr
                    });
                } else {
                    inactives.push({
                        number: userNumber,
                        endDate: endDateStr
                    });
                }
            }

            // Montar mensagem
            let message = '⭐ *LISTA DE VIPs* ⭐\n\n';

            // VIPs Ativos
            if (actives.length > 0) {
                message += '✅ *ATIVOS* (' + actives.length + '):\n\n';
                
                actives.forEach((vip, index) => {
                    message += `${index + 1}. *${vip.number}*\n`;
                    message += `   ⏰ ${vip.days} dias restantes\n`;
                    message += `   📅 Até: ${vip.endDate}\n\n`;
                });
            }

            // VIPs Inativos
            if (inactives.length > 0) {
                message += '❌ *EXPIRADOS* (' + inactives.length + '):\n\n';
                
                inactives.forEach((vip, index) => {
                    message += `${index + 1}. *${vip.number}*\n`;
                    message += `   📅 Expirou em: ${vip.endDate}\n\n`;
                });
            }

            message += `━━━━━━━━━━━━━━━\n`;
            message += `📊 Total: ${allVips.length} VIPs`;

            await this.sock.sendMessage(from, { text: message });

        } catch (error) {
            console.error('Erro no comando listvips:', error);
            await this.sock.sendMessage(from, {
                text: `❌ Erro: ${error.message}`
            });
        }
    }
}

module.exports = ListVipsCommand;
