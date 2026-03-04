class SerVipCommand {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;
        this.name = 'servip';
        this.description = 'Transformar o dono em VIP';
        this.aliases = ['setvip', 'tornarvip'];
    }

    async execute(msg, args, from, sender) {
        try {
            // Este comando é APENAS para o dono se tornar VIP
            const targetJid = sender; // Sempre o próprio dono
            
            // Pegar dias (padrão 30)
            const dias = parseInt(args[0]) || 30;

            if (dias <= 0 || dias > 365) {
                await this.sock.sendMessage(from, {
                    text: '❌ Número de dias inválido!\n\n' +
                          '⚠️ Use entre 1 e 365 dias.'
                });
                return;
            }

            // Verificar se já é VIP
            const isVip = this.dataManager.isVip(targetJid);
            
            if (isVip) {
                // Se já for VIP, renovar
                const renovado = this.dataManager.renewVip(targetJid, dias);
                
                if (renovado) {
                    const vipData = this.dataManager.getVipData(targetJid);
                    const endDate = new Date(vipData.endDate).toLocaleDateString('pt-BR');
                    
                    await this.sock.sendMessage(from, {
                        text: `✅ *SEU VIP FOI RENOVADO!*\n\n` +
                              `👤 Usuário: @${targetJid.split('@')[0]}\n` +
                              `➕ Dias adicionados: ${dias}\n` +
                              `📅 Nova data de expiração: ${endDate}\n\n` +
                              `⭐ VIP atualizado com sucesso!`,
                        mentions: [targetJid]
                    });
                }
            } else {
                // Criar novo VIP
                const vipData = this.dataManager.addVip(targetJid, dias);
                const endDate = new Date(vipData.endDate).toLocaleDateString('pt-BR');
                
                await this.sock.sendMessage(from, {
                    text: `✅ *VOCÊ AGORA É VIP!*\n\n` +
                          `👤 Usuário: @${targetJid.split('@')[0]}\n` +
                          `⏰ Duração: ${dias} dias\n` +
                          `📅 Válido até: ${endDate}\n\n` +
                          `⭐ Você agora tem acesso a todos os comandos VIP!\n\n` +
                          `💎 *Benefícios VIP:*\n` +
                          `• Comandos exclusivos\n` +
                          `• Download de músicas\n` +
                          `• Download de vídeos\n` +
                          `• Prioridade no atendimento\n\n` +
                          `📝 Use !vipinfo para ver seus dados\n` +
                          `🎮 Use !menu para ver os comandos VIP`,
                    mentions: [targetJid]
                });
            }

            console.log(`✅ VIP ${isVip ? 'renovado' : 'ativado'} para o DONO: ${targetJid} por ${dias} dias`);

        } catch (error) {
            console.error('❌ Erro no comando servip:', error);
            await this.sock.sendMessage(from, {
                text: '❌ Erro ao processar comando VIP!'
            });
        }
    }
}

module.exports = SerVipCommand;
