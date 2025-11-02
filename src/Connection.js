const { 
    default: makeWASocket, 
    DisconnectReason, 
    useMultiFileAuthState,
    Browsers
} = require('baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const qrcode = require('qrcode-terminal');

class Connection {
    constructor() {
        this.sock = null;
        this.qrCode = null;
    }

    async initialize() {
        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
        
        this.sock = makeWASocket({
            auth: state,
            printQRInTerminal: false, // Removido para evitar o warning
            logger: pino({ level: 'silent' }),
            browser: Browsers.macOS('Desktop'),
            generateHighQualityLinkPreview: true,
        });

        // Salvar credenciais quando atualizadas
        this.sock.ev.on('creds.update', saveCreds);

        return this.sock;
    }

    setupConnectionHandlers(reconnectCallback) {
        this.sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                console.log('📱 QR Code gerado! Escaneie com seu WhatsApp');
                qrcode.generate(qr, { small: true });
                this.qrCode = qr;
            }
            
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
}

module.exports = Connection;
