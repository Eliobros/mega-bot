/**
 * Comando: addvip
 * Categoria: dono
 * Descrição: Adiciona um usuário como VIP
 * Uso: !addvip @usuario [dias]
 */
class AddVipCommand {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;
        
        // Configurações do comando
        this.name = 'addvip';
        this.aliases = ['vip+', 'addvip', 'ativarvip'];
        this.description = 'Adiciona um usuário como VIP';
        this.usage = '!addvip @usuario [dias]';
        
        // Permissões
        this.onlyDono = true;
        this.onlyAdmin = false;
        this.onlyGroup = false;
    }

    async execute(msg, args, from, sender) {
        try {
            // Verificar se mencionou alguém
            const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            
            if (!mentionedJid) {
                return await this.sock.sendMessage(from, {
                    text: '❌ *Uso incorreto!*\n\n' +
                          `📝 Formato: ${this.usage}\n\n` +
                          '💡 Exemplo:\n' +
                          '• !addvip @usuario → 30 dias\n' +
                          '• !addvip @usuario 60 → 60 dias'
                });
            }

            // Pegar dias (padrão: 30)
            const days = parseInt(args[0]) || 30;

            if (days <= 0 || days > 365) {
                return await this.sock.sendMessage(from, {
                    text: '⚠️ Dias deve estar entre 1 e 365!'
                });
            }

            // Adicionar VIP
            const donoData = this.dataManager.getDonoData();
            const vipData = this.dataManager.addVip(
                mentionedJid, 
                days, 
                donoData.NickDono
            );

            const userNumber = mentionedJid.split('@')[0];
            const endDate = new Date(vipData.endDate).toLocaleDateString('pt-BR');

            await this.sock.sendMessage(from, {
                text: `✅ *VIP ATIVADO!*\n\n` +
                      `👤 Usuário: @${userNumber}\n` +
                      `⏰ Duração: ${days} dias\n` +
                      `📅 Válido até: ${endDate}\n\n` +
                      `⭐ Este usuário agora tem acesso aos comandos VIP!`,
                mentions: [mentionedJid]
            });

        } catch (error) {
            console.error('Erro no comando addvip:', error);
            await this.sock.sendMessage(from, {
                text: `❌ Erro: ${error.message}`
            });
        }
    }
}

module.exports = AddVipCommand;
