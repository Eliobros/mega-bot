const Connection = require('./Connection');
const MessageHandler = require('../handlers/MessageHandler');
const DataManager = require('../utils/dataManager');

class Bot {
    constructor() {
        this.connection = new Connection();
        this.dataManager = new DataManager();
        this.messageHandler = null;
        this.sock = null;

        // 📌 Grupos permitidos agora vêm do DataManager (database/groupsAllowed.json)
        this.allowedGroups = null;
    }

    async start() {
        // Carregar dados
        this.dataManager.loadAll();

        // Inicializar conexão
        this.sock = await this.connection.initialize();

        // Configurar handlers
        this.connection.setupConnectionHandlers(() => this.start());

        // Inicializar handler de mensagens
        this.messageHandler = new MessageHandler(this.sock, this.dataManager);

        // 🆕 Listener para rastrear entradas/saídas de membros
        this.sock.ev.on('group-participants.update', async (update) => {
            await this.handleGroupParticipantsUpdate(update);
        });

        // Escutar mensagens
        this.sock.ev.on('messages.upsert', async (m) => {
            const msg = m.messages[0];
            if (!msg) return;

            const from = msg.key.remoteJid;

            // ===== 🔍 LOGS PARA DESCOBRIR O TIPO DA MENSAGEM =====
            console.log('========== NOVA MENSAGEM ==========');
            const messageType = Object.keys(msg.message || {})[0];
            console.log('Tipo da mensagem:', messageType);
            console.log('messageStubType:', msg.messageStubType);
            console.log('De:', from);
	    console.log('Estrutura completa',JSON.stringify(m, null, 2))            
            // Log completo (descomente se precisar ver tudo)
            // console.log('Estrutura completa:', JSON.stringify(msg, null, 2));
            console.log('===================================');
            
            // ===== 🚨 DETECTAR MENÇÃO NO STATUS =====
            if (msg.messageStubType) {
                console.log('🔔 Possível notificação de sistema!');
                console.log('StubType:', msg.messageStubType);
                console.log('StubParameters:', msg.messageStubParameters);
            }
            // ======================================

            if (from.endsWith('@g.us')) {
                // Atualiza grupos e assinaturas
                this.allowedGroups = this.dataManager.getAllowedGroups();
                const assinatura = this.dataManager.getGroupSubscription(from);

                if (!assinatura) {
                    const nova = this.dataManager.addGroupSubscription(from, 30);
                    await this.sock.sendMessage(from, {
                        text: `✅ *Tina ativada neste grupo!*\nAssinatura válida até: ${nova.endDate.toLocaleDateString()}`,
                    });
                } else {
                    const agora = new Date();
                    const expira = new Date(assinatura.endDate);

                    if (agora > expira) {
                        if (assinatura.active) {
                            this.dataManager.deactivateGroupSubscription(from);
                            await this.sock.sendMessage(from, {
                                text: `⚠️ *A assinatura deste grupo expirou!*\nO dono deve renovar para continuar usando a Tina.`,
                            });
                        }
                        return; // ❌ para de responder
                    }
                }

                // ignora se o grupo não está na lista de permitidos
                if (!this.allowedGroups.includes(from)) return;
            }

            await this.messageHandler.handle(msg);
        });
    }

    // 🆕 Função para lidar com entradas/saídas de membros
    async handleGroupParticipantsUpdate(update) {
        const { id: groupJid, participants, action } = update;

        // Só rastrear nos grupos permitidos
        if (!this.allowedGroups || !this.allowedGroups.includes(groupJid)) {
            return;
        }

        if (action === 'add') {
            // Registrar data de entrada dos novos membros
            const hoje = new Date().toISOString();

            for (const participantJid of participants) {
                this.dataManager.addMemberEntry(groupJid, participantJid, hoje);
                console.log(`✅ Novo membro registrado: ${participantJid} em ${groupJid}`);
            }
        } else if (action === 'remove') {
            // Opcional: remover do registro quando alguém sai
            for (const participantJid of participants) {
                this.dataManager.removeMemberEntry(groupJid, participantJid);
                console.log(`❌ Membro removido do registro: ${participantJid}`);
            }
        }
    }
}

module.exports = Bot;
