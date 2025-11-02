class SemCompraCommand {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;
    }

    async execute(msg, args, from, sender) {
        try {
            // Verificar se é um grupo
            if (!from.endsWith('@g.us')) {
                await this.sendMessage(from, '❌ Este comando só pode ser usado em grupos!');
                return;
            }

            await this.sendMessage(from, '🔍 Analisando membros do grupo...\nAguarde...');

            // Buscar metadados do grupo
            const groupMetadata = await this.sock.groupMetadata(from);
            const participants = groupMetadata.participants;
            const botJid = this.sock.user.id.replace(/:\d+/, '@s.whatsapp.net');

            // Obter dados
            const usersData = this.dataManager.getUsersData();
            const membersEntry = this.dataManager.getAllMembersEntry(from);

            let semCompra = [];
            let stats = {
                total: participants.length,
                comCompra: 0,
                semCompraNovos: 0,
                semCompraAntigos: 0,
                admins: 0
            };

            // Analisar cada membro
            for (const participant of participants) {
                const memberJid = participant.id;
                const numero = memberJid.replace(/@.*/, '');

                // Contar admins separadamente
                if (participant.admin || memberJid === botJid) {
                    stats.admins++;
                    continue;
                }

                // Verificar se tem compra registrada
                const temCompra = usersData.usuarios && usersData.usuarios[memberJid];
                
                if (temCompra) {
                    stats.comCompra++;
                    continue;
                }

                // Não tem compra - verificar se é novo ou antigo
                const entrouRecentemente = this.dataManager.memberEnteredInLastDays(from, memberJid, 15);
                const entryDate = this.dataManager.getMemberEntryDate(from, memberJid);
                
                let diasNoGrupo = 'Desconhecido';
                if (entryDate) {
                    const entry = new Date(entryDate);
                    const now = new Date();
                    const diffTime = Math.abs(now - entry);
                    diasNoGrupo = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                }

                const info = {
                    jid: memberJid,
                    numero,
                    diasNoGrupo,
                    novo: entrouRecentemente
                };

                if (entrouRecentemente) {
                    stats.semCompraNovos++;
                } else {
                    stats.semCompraAntigos++;
                }

                semCompra.push(info);
            }

            // Ordenar: primeiro os mais antigos
            semCompra.sort((a, b) => {
                if (a.diasNoGrupo === 'Desconhecido' && b.diasNoGrupo === 'Desconhecido') return 0;
                if (a.diasNoGrupo === 'Desconhecido') return 1;
                if (b.diasNoGrupo === 'Desconhecido') return -1;
                return b.diasNoGrupo - a.diasNoGrupo;
            });

            // Montar mensagem
            let mensagem = `📊 *MEMBROS SEM COMPRA*\n\n`;
            mensagem += `👥 Total de membros: *${stats.total}*\n`;
            mensagem += `👑 Admins: *${stats.admins}*\n`;
            mensagem += `✅ Com compra: *${stats.comCompra}*\n`;
            mensagem += `❌ Sem compra: *${semCompra.length}*\n`;
            mensagem += `   • 🆕 Novos (<15 dias): *${stats.semCompraNovos}*\n`;
            mensagem += `   • ⏰ Antigos (>15 dias): *${stats.semCompraAntigos}*\n\n`;

            if (semCompra.length === 0) {
                mensagem += `✨ *Todos os membros têm compra registrada!*`;
                await this.sendMessage(from, mensagem);
                return;
            }

            mensagem += `━━━━━━━━━━━━━━━━━━━\n`;
            mensagem += `*LISTA DETALHADA:*\n\n`;

            // Limitar a 50 membros por mensagem para evitar mensagens muito longas
            const limite = Math.min(semCompra.length, 50);
            
            for (let i = 0; i < limite; i++) {
                const membro = semCompra[i];
                const emoji = membro.novo ? '🆕' : '⏰';
                const dias = membro.diasNoGrupo === 'Desconhecido' ? 
                            '❓ dias' : `${membro.diasNoGrupo} dias`;
                
                mensagem += `${i + 1}. ${emoji} @${membro.numero}\n`;
                mensagem += `   └ No grupo há: ${dias}\n`;
            }

            if (semCompra.length > 50) {
                mensagem += `\n⚠️ *Mostrando apenas os primeiros 50 de ${semCompra.length}*`;
            }

            mensagem += `\n━━━━━━━━━━━━━━━━━━━\n`;
            mensagem += `\n💡 *Legenda:*`;
            mensagem += `\n🆕 = Novo (menos de 15 dias)`;
            mensagem += `\n⏰ = Antigo (mais de 15 dias)`;
            mensagem += `\n❓ = Data de entrada desconhecida`;

            // Enviar com menções
            const mentions = semCompra.slice(0, limite).map(m => m.jid);
            await this.sendMessage(from, mensagem, { mentions });

            // Se tem muitos membros antigos, dar uma dica
            if (stats.semCompraAntigos > 10) {
                await this.sendMessage(from, 
                    `\n⚠️ *ATENÇÃO:* Você tem *${stats.semCompraAntigos}* membros antigos sem compra!\n` +
                    `💡 Use o comando de limpeza para remover membros inativos.`
                );
            }

        } catch (err) {
            console.error('Erro no comando semcompra:', err);
            await this.sendMessage(from, '❌ Ocorreu um erro ao listar os membros!');
        }
    }

    async sendMessage(jid, text, options = {}) {
        try {
            await this.sock.sendMessage(jid, { text, ...options });
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
        }
    }
}

module.exports = SemCompraCommand;
