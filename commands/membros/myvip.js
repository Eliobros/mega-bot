/**
 * Comando: myvip
 * Categoria: membros
 * Descrição: Verifica seu status VIP
 * Uso: !myvip
 */
class MyVipCommand {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;
        
        this.name = 'myvip';
        this.aliases = ['meuvip', 'vipstatus', 'checkvip'];
        this.description = 'Verifica seu status VIP';
        this.usage = '!myvip';
        
        this.onlyDono = false;
        this.onlyAdmin = false;
        this.onlyGroup = false;
    }

    async execute(msg, args, from, sender) {
        try {
            const isVip = this.dataManager.isVip(sender);

            if (!isVip) {
                return await this.sock.sendMessage(from, {
                    text: '⭐ *STATUS VIP*\n\n' +
                          '❌ Você não é VIP.\n\n' +
                          '💡 Entre em contato com o dono para se tornar VIP e ter acesso a comandos exclusivos!'
                });
            }

            const vipData = this.dataManager.getVipData(sender);
            const daysRemaining = this.dataManager.getVipDaysRemaining(sender);
            const endDate = new Date(vipData.endDate).toLocaleDateString('pt-BR');
            const startDate = new Date(vipData.startDate).toLocaleDateString('pt-BR');

            let message = '⭐ *SEU STATUS VIP* ⭐\n\n';
            message += '✅ *Você é VIP!*\n\n';
            message += `📅 Início: ${startDate}\n`;
            message += `📅 Válido até: ${endDate}\n`;
            message += `⏰ Dias restantes: ${daysRemaining}\n\n`;

            // Barra de progresso
            const totalDays = Math.ceil((new Date(vipData.endDate) - new Date(vipData.startDate)) / (1000 * 60 * 60 * 24));
            const percentRemaining = Math.floor((daysRemaining / totalDays) * 100);
            const barLength = 10;
            const filledBars = Math.floor((percentRemaining / 100) * barLength);
            const emptyBars = barLength - filledBars;
            
            const progressBar = '█'.repeat(filledBars) + '░'.repeat(emptyBars);
            message += `📊 Tempo: [${progressBar}] ${percentRemaining}%\n\n`;

            if (daysRemaining <= 7) {
                message += '⚠️ *Seu VIP está expirando em breve!*\n';
                message += 'Entre em contato com o dono para renovar.\n\n';
            }

            message += '🎁 *Benefícios VIP:*\n';
            message += '• Acesso a comandos exclusivos\n';
            message += '• Prioridade no atendimento\n';
            message += '• Recursos especiais';

            await this.sock.sendMessage(from, { text: message });

        } catch (error) {
            console.error('Erro no comando myvip:', error);
            await this.sock.sendMessage(from, {
                text: `❌ Erro: ${error.message}`
            });
        }
    }
}

module.exports = MyVipCommand;
