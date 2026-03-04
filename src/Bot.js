const Connection = require('./Connection');
const MessageHandler = require('../handlers/MessageHandler');
const DataManager = require('../utils/dataManager');

class Bot {
    constructor(phoneNumber = null) {  // 🆕 Recebe número de telefone
        this.connection = new Connection();
        this.dataManager = new DataManager();
        this.messageHandler = null;
        this.sock = null;
        this.phoneNumber = phoneNumber;  // 🆕 Guarda o número
        this.allowedGroups = null;
    }

    async start() {
        // Carregar dados
        this.dataManager.loadAll();

        // 🆕 Passa o número pro initialize
        this.sock = await this.connection.initialize(this.phoneNumber);

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

	     // FILTRO 1: Só processar mensagens novas (type: 'notify')
    if (m.type !== 'notify') {
        console.log('⏭️ Ignorando mensagens do histórico (type:', m.type + ')');
        return; // Para TUDO aqui se não for 'notify'
    }
    
//    const msg = m.messages[0];
  //  if (!msg) return;

    // FILTRO 2: Ignorar notificações de sistema
    if (msg.messageStubType) {
        console.log('⏭️ Ignorando notificação de sistema (stubType:', msg.messageStubType + ')');
        return;
    }

    // FILTRO 3: Ignorar mensagens antigas (mais de 1 minuto)
    const messageTimestamp = msg.messageTimestamp;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const messageAge = currentTimestamp - messageTimestamp;
    
    if (messageAge > 60) {
        console.log('⏭️ Mensagem antiga ignorada (idade:', messageAge, 'segundos)');
        return;
    }

    // FILTRO 4: Ignorar newsletter
//    const from = msg.key.remoteJid;
    if (from?.includes('@newsletter')) {
        console.log('⏭️ Ignorando mensagem de newsletter');
        return;
    }

    // FILTRO 5: Ignorar suas próprias mensagens
    if (msg.key.fromMe) {
        console.log('⏭️ Ignorando mensagem própria');
        return;
    }


            // ===== 🔍 LOGS PARA DESCOBRIR O TIPO DA MENSAGEM =====
            console.log('========== NOVA MENSAGEM ==========');
            const messageType = Object.keys(msg.message || {})[0];
            console.log('Tipo da mensagem:', messageType);
            console.log('messageStubType:', msg.messageStubType);
            console.log('De:', from);

            if (from.endsWith('@g.us')) {
                console.log('🆔 ID DO GRUPO:', from);
            } else if (from.endsWith('@s.whatsapp.net')) {
                console.log('💬 Mensagem privada de:', from);
            }

            console.log('Estrutura completa', JSON.stringify(m, null, 2));
            console.log('===================================');

            // ===== 🚨 DETECTAR NOTIFICAÇÕES DO SISTEMA =====
            if (msg.messageStubType) {
                console.log('🔔 Notificação de sistema detectada!');
                console.log('StubType:', msg.messageStubType);
                console.log('StubParameters:', msg.messageStubParameters);

                switch (msg.messageStubType) {
                    case 27:
                        console.log('✅ Membro(s) adicionado(s) ao grupo');
                        try {
                            const params = JSON.parse(msg.messageStubParameters[0]);
                            console.log('📱 Adicionado:', params.phoneNumber);
                        } catch (e) {
                            console.log('Parâmetros brutos:', msg.messageStubParameters);
                        }
                        break;

                    case 28:
                        console.log('❌ Membro(s) removido(s) do grupo');
                        try {
                            const params = JSON.parse(msg.messageStubParameters[0]);
                            console.log('📱 Removido:', params.phoneNumber);
                        } catch (e) {
                            console.log('Parâmetros brutos:', msg.messageStubParameters);
                        }
                        break;

                    case 29:
                        console.log('🚪 Membro(s) saiu(saíram) do grupo');
                        try {
                            const params = JSON.parse(msg.messageStubParameters[0]);
                            console.log('📱 Saiu:', params.phoneNumber);
                        } catch (e) {
                            console.log('Parâmetros brutos:', msg.messageStubParameters);
                        }
                        break;

                    case 72:
                        console.log('✅ Você foi adicionado a um grupo');
                        break;

                    case 73:
                        console.log('❌ Você foi removido de um grupo');
                        break;

                    default:
                        console.log('❓ Tipo de notificação desconhecido:', msg.messageStubType);
                }

                console.log('===================================');
            }

            if (from.endsWith('@g.us')) {
                this.allowedGroups = this.dataManager.getAllowedGroups();
                const assinatura = this.dataManager.getGroupSubscription(from);

                const messageText = msg.message?.conversation ||
                                   msg.message?.extendedTextMessage?.text || '';
                const prefix = this.dataManager.getDonoData().Prefixo || '!';
                const isCommand = messageText.trim().startsWith(prefix);

                let command = '';
                if (isCommand) {
                    const commandParts = messageText.trim().slice(prefix.length).trim().split(/\s+/);
                    command = commandParts[0].toLowerCase();
                }

                let senderJid = msg.key.participant || msg.key.remoteJid;
                if (Array.isArray(senderJid)) senderJid = senderJid[0];
                const senderNumber = senderJid
                    .replace(/(@s\.whatsapp\.net|@lid|@c\.us)/g, '')
                    .split('@')[0];

                const isDono = this.dataManager.isDono(senderNumber);
                const isDonoCommand = isDono && (command === 'licenca' || command === 'licença');

                console.log('🔍 DEBUG: messageText:', messageText);
                console.log('🔍 DEBUG: command:', command);
                console.log('🔍 DEBUG: isDono:', isDono, '| isDonoCommand:', isDonoCommand);

                if (!assinatura) {
                    if (isDonoCommand) {
                        console.log('🔓 Permitindo comando de licença do dono sem assinatura');
                        await this.messageHandler.handle(msg);
                    }
                    return;
                }

                const agora = new Date();
                const expira = new Date(assinatura.endDate);
                const diasRestantes = Math.ceil((expira - agora) / (1000 * 60 * 60 * 24));

                if (diasRestantes === 3 && assinatura.active) {
                    const hoje = new Date().toDateString();
                    if (assinatura.lastWarning !== hoje) {
                        assinatura.lastWarning = hoje;
                        this.dataManager.saveGroupSubscriptionsData();

                        await this.sock.sendMessage(from, {
                            text: `⚠️ *ATENÇÃO!*\n\nA assinatura deste grupo expira em *3 dias*!\nRenove para continuar usando a Tina.`
                        });
                    }
                }

                if (agora > expira) {
                    if (isDonoCommand) {
                        console.log('🔓 Permitindo comando de licença do dono (grupo expirado)');
                        await this.messageHandler.handle(msg);
                        return;
                    }

                    if (assinatura.active) {
                        this.dataManager.deactivateGroupSubscription(from);
                        await this.sock.sendMessage(from, {
                            text: `❌ *A assinatura deste grupo expirou!*\n\n` +
                                  `Data de expiração: ${expira.toLocaleDateString('pt-BR')}\n\n` +
                                  `Entre em contato com o dono para renovar: ${this.dataManager.getDonoData().NumeroDono}`
                        });
                    }
                    return;
                }

                if (!this.allowedGroups.includes(from)) {
                    return;
                }
            }

            await this.messageHandler.handle(msg);
        });
    }

    async handleGroupParticipantsUpdate(update) {
        const { id: groupJid, participants, action } = update;

        console.log('👥 GROUP PARTICIPANT UPDATE');
        console.log('Grupo:', groupJid);
        console.log('Ação:', action);
        console.log('Participantes:', participants);

        if (!this.allowedGroups || !this.allowedGroups.includes(groupJid)) {
            console.log('⚠️ Grupo não está na lista de permitidos, ignorando...');
            return;
        }

        if (action === 'add') {
            const hoje = new Date().toISOString();

            for (const participantJid of participants) {
                this.dataManager.addMemberEntry(groupJid, participantJid, hoje);
                console.log(`✅ Novo membro registrado: ${participantJid} em ${groupJid}`);
            }
        } else if (action === 'remove') {
            for (const participantJid of participants) {
                this.dataManager.removeMemberEntry(groupJid, participantJid);
                console.log(`❌ Membro removido do registro: ${participantJid}`);
            }
        }
    }
}

module.exports = Bot;
