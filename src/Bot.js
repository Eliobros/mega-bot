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

        // Escutar mensagens
        this.sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if (!msg) return;

    const from = msg.key.remoteJid;

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
}

module.exports = Bot;
