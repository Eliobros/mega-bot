/**
 * Comando: vipinfo
 * Categoria: vips
 * Descrição: Informações exclusivas para VIPs
 * Uso: !vipinfo
 */
class VipInfoCommand {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;
        
        this.name = 'vipinfo';
        this.aliases = ['infovip', 'viphelp'];
        this.description = 'Informações e comandos exclusivos VIP';
        this.usage = '!vipinfo';
        
        // Não precisa especificar permissões aqui
        // O CommandLoader já verifica automaticamente pela pasta "vips/"
        this.onlyDono = false;
        this.onlyAdmin = false;
        this.onlyGroup = false;
    }

    async execute(msg, args, from, sender) {
        try {
            const vipData = this.dataManager.getVipData(sender);
            const daysRemaining = this.dataManager.getVipDaysRemaining(sender);

            let message = '⭐ *PAINEL VIP* ⭐\n\n';
            message += '🎉 Bem-vindo à área VIP!\n\n';
            message += `⏰ Dias restantes: ${daysRemaining}\n`;
            message += `📅 Até: ${new Date(vipData.endDate).toLocaleDateString('pt-BR')}\n\n`;
            
            message += '━━━━━━━━━━━━━━━\n';
            message += '🎁 *COMANDOS VIP DISPONÍVEIS:*\n\n';
            
            message += '• *!vipinfo* - Este menu\n';
            message += '• *!myvip* - Seu status VIP\n';
            message += '• *!vipexclusivo* - Exemplo de comando VIP\n';
            message += '• (Mais comandos em breve...)\n\n';
            
            message += '━━━━━━━━━━━━━━━\n';
            message += '💡 *BENEFÍCIOS:*\n';
            message += '✅ Comandos exclusivos\n';
            message += '✅ Prioridade no suporte\n';
            message += '✅ Novos recursos primeiro\n\n';
            
            message += '📞 Dúvidas? Contate o dono!';

            await this.sock.sendMessage(from, { text: message });

        } catch (error) {
            console.error('Erro no comando vipinfo:', error);
            await this.sock.sendMessage(from, {
                text: `❌ Erro: ${error.message}`
            });
        }
    }
}

module.exports = VipInfoCommand;
