class LimparCommand {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;
        this.isCleaning = false;
    }

    async execute(msg, args, from, sender) {
        try {
            if (this.isCleaning) {
                await this.sendMessage(from, '⚠️ Já estou executando uma limpeza!');
                return;
            }

            if (!from.endsWith('@g.us')) {
                await this.sendMessage(from, '❌ Este comando só pode ser usado em grupos!');
                return;
            }

            const groupMetadata = await this.sock.groupMetadata(from);
            const participants = groupMetadata.participants;

            let botJid = this.sock.user.id;
            if (botJid.includes(':')) {
                botJid = botJid.split(':')[0] + '@s.whatsapp.net';
            }
            const botNumber = botJid.split('@')[0].replace(/[^0-9]/g, '');

            console.log('🔍 Bot JID original:', botJid);
            console.log('🔢 Bot Number:', botNumber);
            console.log('👥 Total de participantes:', participants.length);

            const botParticipant = participants.find(p => {
                const participantNumber = p.id.split('@')[0].replace(/[^0-9]/g, '');
                return participantNumber === botNumber;
            });

            if (!botParticipant) {
                console.log('⚠️ Bot não encontrado na lista (normal com Baileys)');
                await this.sendMessage(from, '⚠️ Não consegui verificar se sou admin, mas vou tentar executar.\nSe der erro, me promova a admin!');
            } else if (!botParticipant.admin) {
                await this.sendMessage(from, '❌ Eu preciso ser administrador do grupo para executar a limpeza!');
                return;
            }

            await this.sendMessage(from, '🔍 Analisando membros do grupo...\nAguarde...');

            const usersData = this.dataManager.getUsersData();

            let toRemove = [];
            let stats = {
                total: participants.length,
                comCompra: 0,
                novos: 0,
                semCompraAntigos: 0,
                admins: 0
            };

            for (const participant of participants) {
                const memberJid = participant.id;

                if (participant.admin || memberJid === botJid) {
                    stats.admins++;
                    continue;
                }

                const temCompra = usersData.usuarios && usersData.usuarios[memberJid];
                if (temCompra) {
                    stats.comCompra++;
                    continue;
                }

                const entrouRecentemente = this.dataManager.memberEnteredInLastDays(from, memberJid, 5);
                if (entrouRecentemente) {
                    stats.novos++;
                    continue;
                }

                stats.semCompraAntigos++;
                toRemove.push(memberJid);
            }

            let mensagem = `📊 *ANÁLISE DO GRUPO*\n\n`;
            mensagem += `👥 Total de membros: *${stats.total}*\n`;
            mensagem += `👑 Admins: *${stats.admins}*\n`;
            mensagem += `✅ Com compra registrada: *${stats.comCompra}*\n`;
            mensagem += `🆕 Novos (últimos 5 dias): *${stats.novos}*\n`;
            mensagem += `❌ Sem compra e antigos: *${stats.semCompraAntigos}*\n\n`;

            if (toRemove.length === 0) {
                mensagem += `✨ *Não há membros para remover!*\nTodos os membros têm compra registrada ou entraram recentemente.`;
                await this.sendMessage(from, mensagem);
                return;
            }

            mensagem += `🗑️ *${toRemove.length} membro(s) serão removidos.*\n\n`;
            mensagem += `⚠️ *DESEJA CONTINUAR?*\n\n`;
            mensagem += `Digite:\n`;
            mensagem += `• *sim* ou *s* para CONFIRMAR\n`;
            mensagem += `• *não* ou *n* para CANCELAR\n\n`;
            mensagem += `⏱️ Você tem 30 segundos para responder.`;

            await this.sendMessage(from, mensagem);

            const confirmed = await this.waitForConfirmation(from, sender, 30000);

            if (!confirmed) {
                await this.sendMessage(from, '❌ Limpeza cancelada (tempo esgotado ou cancelada).');
                return;
            }

            this.isCleaning = true;
            await this.sendMessage(from, `🔄 Removendo ${toRemove.length} membro(s)...\nIsso pode demorar um pouco.`);

            let removidos = 0;
            let erros = 0;

            for (let i = 0; i < toRemove.length; i += 5) {
                const batch = toRemove.slice(i, i + 5);

                try {
                    await this.sock.groupParticipantsUpdate(from, batch, 'remove');
                    removidos += batch.length;

                    for (const jid of batch) {
                        this.dataManager.removeMemberEntry(from, jid);
                    }

                    if (i + 5 < toRemove.length) {
                        await this.sleep(2000);
                    }
                } catch (err) {
                    console.error('Erro ao remover lote:', err);
                    erros += batch.length;
                }
            }

            let resultado = `✅ *LIMPEZA CONCLUÍDA*\n\n`;
            resultado += `🗑️ Removidos: *${removidos}*\n`;
            if (erros > 0) resultado += `⚠️ Erros: *${erros}*\n`;
            resultado += `\n✨ Grupo limpo com sucesso!`;

            await this.sendMessage(from, resultado);
            this.isCleaning = false;

        } catch (err) {
            console.error('Erro no comando limpar:', err);
            await this.sendMessage(from, '❌ Ocorreu um erro ao executar a limpeza!');
            this.isCleaning = false;
        }
    }

    // ✅ FUNÇÃO SIMPLES: Espera resposta de TEXTO
    async waitForConfirmation(groupJid, senderJid, timeout) {
        return new Promise((resolve) => {
            const timeoutId = setTimeout(() => {
                this.sock.ev.off('messages.upsert', handler);
                resolve(false);
            }, timeout);

            const handler = async (m) => {
                const msg = m.messages[0];
                if (!msg || !msg.message) return;
                if (msg.key.remoteJid !== groupJid) return;
                if (msg.key.fromMe) return;

                const sender = msg.key.participant || msg.key.remoteJid;
                
                // Pega o texto da mensagem
                const messageText = (
                    msg.message?.conversation ||
                    msg.message?.extendedTextMessage?.text ||
                    ''
                ).toLowerCase().trim();

                if (sender === senderJid) {
                    // Confirmar
                    if (['sim', 's', 'yes', 'y', 'confirmar', 'ok'].includes(messageText)) {
                        clearTimeout(timeoutId);
                        this.sock.ev.off('messages.upsert', handler);
                        await this.sendMessage(groupJid, '✅ Confirmação recebida! Iniciando limpeza...');
                        resolve(true);
                    }
                    // Cancelar
                    else if (['não', 'nao', 'n', 'no', 'cancelar', 'cancel'].includes(messageText)) {
                        clearTimeout(timeoutId);
                        this.sock.ev.off('messages.upsert', handler);
                        await this.sendMessage(groupJid, '❌ Limpeza cancelada.');
                        resolve(false);
                    }
                }
            };

            this.sock.ev.on('messages.upsert', handler);
        });
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async sendMessage(jid, text, options = {}) {
        try {
            await this.sock.sendMessage(jid, { text, ...options });
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
        }
    }
}

module.exports = LimparCommand;
