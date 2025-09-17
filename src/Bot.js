const Connection = require('./Connection');
const MessageHandler = require('../handlers/MessageHandler');
const DataManager = require('../utils/dataManager');

class Bot {
    constructor() {
        this.connection = new Connection();
        this.dataManager = new DataManager();
        this.messageHandler = null;
        this.sock = null;

        // 📌 IDs dos grupos permitidos
        this.allowedGroups = [
            //'120363294031651231@g.us',
    '120363401341705925@g.us',
	    '120363402444500303@g.us',
            // '96170191420-1389636270@g.us' // adicione mais se quiser
        ];
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

            // 📌 Filtro: só PV ou grupos permitidos
            if (msg.key.remoteJid.endsWith('@g.us')) {
                if (!this.allowedGroups.includes(msg.key.remoteJid)) {
                    return; // ignora grupos que não estão na lista
                }
            }

            await this.messageHandler.handle(msg);
        });
    }
}

module.exports = Bot;
