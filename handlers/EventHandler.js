class EventHandler {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;
    }

    setup() {
        // Evento: Membros entrando/saindo
        this.sock.ev.on('group-participants.update', async (update) => {
            await this.handleParticipantUpdate(update);
        });

        // Evento: Anti-call
        this.sock.ev.on('call', async (calls) => {
            await this.handleCall(calls);
        });

        console.log("✅ Eventos configurados!");
    }

    async handleParticipantUpdate(update) {
        const { id: groupJid, participants, action } = update;

        console.log(`👥 Evento: ${action} no grupo ${groupJid}`);

        try {
            for (const participantJid of participants) {
                if (action === 'add') {
                    console.log(`👋 Novo membro: ${participantJid}`);
                    
                    // Antifake
                    const cfg = this.dataManager.getDonoData().groups?.[groupJid] || {};
                    if (cfg.antifake === true) {
                        const num = participantJid.replace('@s.whatsapp.net', '');
                        if (!num.startsWith('258')) {
                            await this.sock.groupParticipantsUpdate(groupJid, [participantJid], 'remove');
                            await this.sock.sendMessage(groupJid, {
                                text: `🚫 Número não permitido: @${num}. Apenas Moçambique (+258).`,
                                mentions: [participantJid]
                            });
                            continue;
                        }
                    }

                    // Bem-vindo (se tiver AdminCommand)
                    // await this.adminCommands.handleNewMember(groupJid, participantJid);

                } else if (action === 'remove') {
                    console.log(`👋 Membro saiu: ${participantJid}`);
                    // await this.adminCommands.handleMemberLeft(groupJid, participantJid);
                }
            }
        } catch (error) {
            console.error(`❌ Erro ao processar ${action}:`, error);
        }
    }

    async handleCall(calls) {
        try {
            const dono = this.dataManager.getDonoData();
            const anticallAtivo = Object.values(dono.groups || {}).some(g => g.anticall === true);
            
            if (!anticallAtivo) return;

            for (const call of calls) {
                const fromJid = call.from || call.id || null;
                if (!fromJid) continue;

                try {
                    await this.sock.updateBlockStatus(fromJid, 'block');
                    await this.sock.sendMessage(fromJid, {
                        text: '🚫 Chamadas não são permitidas. Você foi bloqueado.'
                    });
                    console.log(`📵 ${fromJid} bloqueado por ligação.`);
                } catch (e) {
                    console.log('Falha ao bloquear:', e?.message);
                }
            }
        } catch (e) {
            console.log('Erro no handler de call:', e?.message);
        }
    }
}

module.exports = EventHandler;
