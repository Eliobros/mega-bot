const { 
    default: makeWASocket, 
    DisconnectReason, 
    useMultiFileAuthState,
    Browsers
} = require('baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');

class Connection {
    constructor() {
        this.sock = null;
        this.pairingCode = null;
    }

    async initialize(phoneNumber = null) {
        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

        this.sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: Browsers.macOS('Desktop'),
            generateHighQualityLinkPreview: true,
        });

        // Gerar Pairing Code se não estiver registrado
        if (phoneNumber && !this.sock.authState.creds.registered) {
            console.log('📱 Gerando Pairing Code...');
            const code = await this.sock.requestPairingCode(phoneNumber);
            this.pairingCode = code;
            console.log('🔑 SEU PAIRING CODE:', code);
            console.log('👉 Abra WhatsApp > Dispositivos Vinculados > Vincular com número');
        }

        // Salvar credenciais quando atualizadas
        this.sock.ev.on('creds.update', saveCreds);

        return this.sock;
    }

    setupConnectionHandlers(reconnectCallback) {
        this.sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error instanceof Boom) 
                    ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
                    : true;

                console.log('Conexão fechada devido a:', lastDisconnect?.error);

                if (shouldReconnect) {
                    console.log('🔄 Reconectando...');
                    reconnectCallback();
                }
            } else if (connection === 'open') {
                console.log('✅ Conectado ao WhatsApp!');
            }
        });
    }

    getSocket() {
        return this.sock;
    }

    getPairingCode() {
        return this.pairingCode;
    }
}

module.exports = Connection;