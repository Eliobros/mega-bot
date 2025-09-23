const fs = require('fs');
const path = require('path');

class MeInfoCommand {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;
        this.donoFile = path.join(__dirname, '../../database/dono.json');
    }

    getConfig() {
        try {
            return JSON.parse(fs.readFileSync(this.donoFile));
        } catch (error) {
            return { Prefixo: '/', NumeroDono: '' };
        }
    }

    // Verificar se usuário é admin ou dono
    async isUserAdmin(groupJid, senderJid) {
        try {
            const config = this.getConfig();
            const donoNumber = config.NumeroDono;
            const senderNumber = senderJid.replace(/@.*/, '');
            
            // Se for o dono
            if (senderNumber === donoNumber) {
                return true;
            }
            
            // Verificar se é admin do grupo
            const groupMetadata = await this.sock.groupMetadata(groupJid);
            const participant = groupMetadata.participants.find(p => p.id === senderJid);
            return participant?.admin === 'admin' || participant?.admin === 'superadmin';
        } catch (error) {
            return false;
        }
    }

    async execute(msg, args, from, sender, isInfoCommand = false) {
        const config = this.getConfig();
        const prefixo = config.Prefixo || '/';

        if (!from.endsWith('@g.us')) {
            await this.sendMessage(from, '❌ Este comando só funciona em grupos!');
            return;
        }

        try {
            let targetJid = sender; // Por padrão, mostrar dados do próprio usuário
            let isCheckingOtherUser = false;

            // Se for comando !info, verificar se mencionou alguém ou respondeu mensagem
            if (isInfoCommand) {
                const isAdmin = await this.isUserAdmin(from, sender);
                
                if (!isAdmin) {
                    await this.sendMessage(from, '❌ *Acesso Negado!*\n\nApenas administradores e o dono podem usar o comando info para consultar outros usuários.');
                    return;
                }

                // Verificar se mencionou alguém
                const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
                
                if (mentionedJids.length > 0) {
                    targetJid = mentionedJids[0];
                    isCheckingOtherUser = true;
                } else if (quotedParticipant) {
                    targetJid = quotedParticipant;
                    isCheckingOtherUser = true;
                } else if (args.length === 0) {
                    await this.sendMessage(from, `❌ *Como usar o comando info:*\n\n• \`${prefixo}info @usuario\` - Mencionar usuário\n• Responder mensagem + \`${prefixo}info\` - Info de quem enviou\n\n💡 Para ver seus próprios dados use: \`${prefixo}me\``);
                    return;
                }
            }

            // Obter dados dos usuários
            const usersData = this.dataManager.getUsersData();
            
            if (!usersData.usuarios || Object.keys(usersData.usuarios).length === 0) {
                await this.sendMessage(from, '📊 *Sistema de Compras*\n\n❌ Ainda não há dados de compradores neste grupo.\n\n💡 Faça sua primeira compra para aparecer nas estatísticas!');
                return;
            }

            // Buscar dados do usuário
            const userData = usersData.usuarios[targetJid];
            
            if (!userData) {
                const targetNumber = targetJid.replace(/@.*/, '');
                const targetName = isCheckingOtherUser ? `usuário ${targetNumber}` : 'você';
                
                await this.sendMessage(from, `📊 *Dados do Usuário*\n\n❌ ${targetName} ainda não fez nenhuma compra.\n\n💡 Use o comando \`${prefixo}comprar\` para começar a acumular estatísticas!`);
                return;
            }

            // Calcular compras de hoje
            const hoje = new Date().toISOString().split('T')[0];
            const comprasHoje = userData.historico_compras?.filter(compra => 
                compra.data === hoje
            ).length || 0;

            // Calcular ranking
            const ranking = this.calcularRanking(targetJid, usersData);
            
            // Montar mensagem personalizada
            const mensagem = this.montarMensagemUsuario(userData, comprasHoje, ranking, isCheckingOtherUser);
            
            await this.sendMessage(from, mensagem, isCheckingOtherUser ? { mentions: [targetJid] } : {});

            console.log(`📊 Dados consultados: ${userData.nome} (${userData.numero}) - Posição: ${ranking.posicao}`);

        } catch (error) {
            console.error('Erro ao obter dados do usuário:', error);
            await this.sendMessage(from, '❌ Erro ao consultar dados! Tente novamente mais tarde.');
        }
    }

    calcularRanking(targetJid, usersData) {
        const usuarios = Object.entries(usersData.usuarios)
            .map(([jid, userData]) => ({ jid, ...userData }))
            .sort((a, b) => b.total_gb_acumulado - a.total_gb_acumulado);

        const posicao = usuarios.findIndex(u => u.jid === targetJid) + 1;
        const totalUsuarios = usuarios.length;
        const userData = usersData.usuarios[targetJid];

        return {
            posicao,
            totalUsuarios,
            gbAcumulado: userData.total_gb_acumulado,
            totalCompras: userData.total_compras
        };
    }

    montarMensagemUsuario(userData, comprasHoje, ranking, isOtherUser) {
        let mensagem = '';
        const nomeUsuario = userData.nome || userData.numero;
        
        if (isOtherUser) {
            mensagem += `📊 *DADOS DO USUÁRIO*\n\n`;
            mensagem += `👤 **Consultando:** ${nomeUsuario}\n\n`;
        } else {
            mensagem += `👋 Olá **${nomeUsuario}**, abaixo estão os seus dados:\n\n`;
        }

        mensagem += `━━━━━━━━━━━━━━━━\n`;
        mensagem += `📋 **ESTATÍSTICAS**\n\n`;
        mensagem += `👤 **Usuário:** ${nomeUsuario}\n`;
        mensagem += `🛒 **Compras hoje:** ${comprasHoje}\n`;
        mensagem += `📦 **Total de compras:** ${userData.total_compras || 0}\n`;
        mensagem += `🌐 **Internet acumulada:** ${(userData.total_gb_acumulado || 0).toFixed(2)}GB\n`;
        mensagem += `🏆 **Posição no ranking:** ${ranking.posicao}º lugar\n\n`;

        // Mensagem motivacional baseada na posição
        if (ranking.posicao === 1) {
            mensagem += `👑 **PARABÉNS!** Você é o LÍDER do grupo!\n`;
            mensagem += `🏆 Continue mantendo a liderança e inspire outros compradores!`;
        } else if (ranking.posicao <= 3) {
            mensagem += `🥉 **Parabéns, você está no TOP 3!** Continue assim!\n`;
            mensagem += `🚀 Quem sabe você não chega ao primeiro lugar?`;
        } else if (ranking.posicao <= 5) {
            mensagem += `🏅 **Você está no TOP 5!** Muito bem!\n`;
            mensagem += `💪 Continue comprando para subir no ranking!`;
        } else if (ranking.posicao <= 10) {
            mensagem += `📈 **Você está no TOP 10!**\n`;
            mensagem += `🎯 Com mais algumas compras você chega no TOP 5!`;
        } else {
            mensagem += `🌟 **Continue comprando para subir no ranking!**\n`;
            mensagem += `💎 Cada compra te aproxima dos primeiros lugares!`;
        }

        // Informações adicionais
        mensagem += `\n\n━━━━━━━━━━━━━━━━\n`;
        mensagem += `📅 **HISTÓRICO**\n\n`;
        
        if (userData.primeira_compra) {
            mensagem += `🎯 **Primeira compra:** ${new Date(userData.primeira_compra).toLocaleDateString('pt-BR')}\n`;
        }
        
        if (userData.ultima_compra) {
            mensagem += `📅 **Última compra:** ${new Date(userData.ultima_compra).toLocaleDateString('pt-BR')}\n`;
        }

        mensagem += `👥 **Total de compradores:** ${ranking.totalUsuarios}\n`;

        // Dica para melhorar posição
        if (ranking.posicao > 1) {
            mensagem += `\n💡 **Dica:** Continue comprando para melhorar sua posição no ranking!`;
        }

        return mensagem;
    }

    async sendMessage(jid, text, options = {}) {
        try {
            await this.sock.sendMessage(jid, { text, ...options });
        } catch (err) {
            console.error("❌ Erro ao enviar mensagem:", err);
        }
    }
}

module.exports = MeInfoCommand;
