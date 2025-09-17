const TabelaHandler = require('./TabelaHandler');
const ComprovanteHandler = require('./ComprovanteHandler');
const CompraHandler = require('./CompraHandler');

// Comandos de membros
const MenuCommand = require('../commands/membros/menu');
const TabelaCommand = require('../commands/membros/tabela');
const PingCommand = require('../commands/membros/ping');
const HelpCommand = require('../commands/membros/help');

// Comandos de dono
const DeleteCommand = require('../commands/dono/delete')
const SetPrefixCommand = require('../commands/dono/setprefix')
const LinkGpCommand = require('../commands/dono/linkgp')
const AntiLinkCommand = require('../commands/dono/antilink')
const ComprarCommand = require('../commands/dono/comprar');
const StatsCommand = require('../commands/dono/stats');
const ComprovantesCommand = require('../commands/dono/comprovantes');
const GrupoCommand = require('../commands/dono/grupo');
const BanCommand = require('../commands/dono/ban');

class MessageHandler {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;

        // Inicializar handlers
        this.tabelaHandler = new TabelaHandler(sock, dataManager);
        this.comprovanteHandler = new ComprovanteHandler(sock, dataManager);
        this.compraHandler = new CompraHandler(sock, dataManager);

        // Inicializar comandos de membros
        this.menuCommand = new MenuCommand(sock, dataManager);
        this.tabelaCommand = new TabelaCommand(sock, dataManager);
        this.pingCommand = new PingCommand(sock, dataManager);
        this.helpCommand = new HelpCommand(sock, dataManager);

        // Inicializar comandos de dono
        this.deleteCommand = new DeleteCommand(sock, dataManager)
        this.antilinkCommand = new AntiLinkCommand(sock, dataManager)
        this.setprefixCommand = new SetPrefixCommand(sock, dataManager)
        this.linkgpCommand = new LinkGpCommand(sock, dataManager)
        this.comprarCommand = new ComprarCommand(sock, dataManager);
        this.statsCommand = new StatsCommand(sock, dataManager);
        this.comprovantesCommand = new ComprovantesCommand(sock, dataManager);
        this.grupoCommand = new GrupoCommand(sock, dataManager);
        this.banCommand = new BanCommand(sock, dataManager);
        // ✅ Removida linha duplicada: this.antilinkCommand = new AntiLinkCommand(sock, dataManager)
    }

    async handle(msg) {
        const from = msg.key.remoteJid;
        const messageText = this.getMessageText(msg);
        const isGroup = from.endsWith('@g.us');

        // 📌 Pega o número do remetente
        let sender = isGroup ? msg.key.participant : from;
        if (!sender) sender = from; // fallback se participant for null

        const senderNumber = sender
            .replace(/(@s\.whatsapp\.net|@lid|@c\.us)/g, '')
            .split('@')[0];

        const senderName = msg.pushName || "Usuário";

        // 📌 Pega nome do grupo se for grupo
        let groupName = "N/A";
        if (isGroup && this.sock.groupMetadata) {
            try {
                const metadata = await this.sock.groupMetadata(from);
                groupName = metadata.subject || "Grupo sem nome";
            } catch {
                groupName = "Desconhecido";
            }
        }

        // 📌 Log formatado
        const date = new Date();
        const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        console.log(`
========= TINA BOT Logs=======
|-> Mensagem: ${messageText}
|-> Usuário: ${senderName}
|-> Número: ${senderNumber}
|-> Grupo: ${isGroup ? "Sim" : "Não"}
|-> Nome do grupo: ${groupName}
|-> Data: ${time}
==============================
`);

        // 📌 Sistema de pagamento corrigido (sem botões)
        await this.handlePaymentSystem(messageText, from, isGroup);

        // 📌 Comando /grupoId
        if (messageText === '/grupoId' && isGroup) {
            await this.sock.sendMessage(from, { text: `📌 ID deste grupo: ${from}` });
            return;
        }

        // 📌 Verificar antilink antes de processar outros comandos
        if (isGroup && messageText) {
            const linkDetected = await this.antilinkCommand.checkForLinks(msg, from, sender);
            if (linkDetected) {
                return; // Se link foi detectado e usuário removido, não processar mais nada
            }
        }

        // 📌 Detectar comprovantes
        if (messageText && this.comprovanteHandler.isComprovante(messageText)) {
            await this.comprovanteHandler.processar(messageText, from, sender);
            return;
        }

        // 📌 Comandos do dono (prefixo !)
        const donoData = this.dataManager.getDonoData();
        if (this.dataManager.isDono(senderNumber) && messageText.startsWith(donoData.prefixo)) {
            await this.handleDonoCommand(msg, messageText, from, sender);
            return;
        }

        // 📌 Comandos públicos
        if (messageText) {
            const command = messageText.toLowerCase().trim();
            switch (command) {
                case '/start':
                case '/menu':
                    await this.menuCommand.execute(from);
                    break;

                case '/ping':
                    await this.pingCommand.execute(from);
                    break;

                case '/help':
                    await this.helpCommand.execute(from);
                    break;

                case 'tabela':
                case '/tabela':
                    await this.tabelaCommand.execute(msg);
                    break;

                
            }
        }
    }

    // 📌 Sistema de pagamento sem botões
    async handlePaymentSystem(messageText, from, isGroup) {
        if (!isGroup) return; // Só funciona em grupos

        const text = messageText.toLowerCase();

        // Comando principal de pagamento
        if (text === "pagamento") {
            const paymentMessage = `
🏦 *FORMAS DE PAGAMENTO DISPONÍVEIS* 💸

━━━━━━━━━━━━━━━━━━━━━━━

*📱 OPÇÃO 1 - Habibo*
Digite: \`pagamento1\`

*📱 OPÇÃO 2 - Aida & Paulo*  
Digite: \`pagamento2\`

━━━━━━━━━━━━━━━━━━━━━━━

💡 *Como usar:*
• Digite \`pagamento1\` ou \`pagamento2\`
• Escolha a forma de pagamento desejada
• Após pagar, envie o comprovativo no grupo

🤖 *Tina Bot* 💎
            `;

            await this.sock.sendMessage(from, { text: paymentMessage });
            return true;
        }

        // Pagamento 1 (Habibo)
        if (text === "pagamento1") {
            const payment1Message = `
🏦 *PAGAMENTO OPÇÃO 1* 💳

━━━━━━━━━━━━━━━━━━━━━━━

*👤 ADM:* Zëüs Lykraios 💎
*📞 Chamadas e SMS:* 862840075

*💳 FORMAS DE PAGAMENTO:*

🔹 *M-PESA:* 841617651
   📝 Nome: Habibo Julio

🔹 *E-MOLA:* 862840075  
   📝 Nome: Habibo Julio

━━━━━━━━━━━━━━━━━━━━━━━

📋 *INSTRUÇÕES:*
1️⃣ Faça o pagamento usando os dados acima
2️⃣ Envie o comprovativo neste grupo
3️⃣ Inclua o número que vai receber o pacote

⚠️ *Importante:* Guarde seu comprovativo até a confirmação!

🤖 *Tina Bot* 💎
            `;

            await this.sock.sendMessage(from, { text: payment1Message });
            return true;
        }

        // Pagamento 2 (Aida & Paulo)
        if (text === "pagamento2") {
            const payment2Message = `
🏦 *PAGAMENTO OPÇÃO 2* 💵

━━━━━━━━━━━━━━━━━━━━━━━

*💳 FORMAS DE PAGAMENTO:*

🔹 *E-MOLA:* 866399986
   📝 Nome: Aida 💸

🔹 *M-PESA:* 848300881
   📝 Nome: Paulo 💸

━━━━━━━━━━━━━━━━━━━━━━━

📋 *INSTRUÇÕES:*
1️⃣ Faça o pagamento usando os dados acima
2️⃣ Envie o comprovativo neste grupo
3️⃣ Aguarde a confirmação do administrador

⚠️ *Importante:* Guarde seu comprovativo até a confirmação!

🤖 *Tina Bot* 💎
            `;

            await this.sock.sendMessage(from, { text: payment2Message });
            return true;
        }

        return false; // Não foi comando de pagamento
    }
    
   async handleDonoCommand(msg, messageText, from, sender) {
    const donoData = this.dataManager.getDonoData();
    const comando = messageText.replace(donoData.prefixo, '').trim();
    const args = comando.split(' ');
    const cmd = args[0].toLowerCase();
    
    // 🔧 CORREÇÃO: Remover o comando dos args para passar apenas os parâmetros
    const commandArgs = args.slice(1); // Remove o primeiro elemento (comando)
    
    console.log(`🔍 DEBUG COMANDO:
    - Comando completo: "${comando}"
    - Comando (cmd): "${cmd}"
    - Args originais: ${JSON.stringify(args)}
    - Args para comando: ${JSON.stringify(commandArgs)}`);

    switch (cmd) {
        case 'comprar':
            await this.comprarCommand.execute(msg, commandArgs, from, sender);
            break;

        case 'stats':
            await this.statsCommand.execute(from);
            break;

        case 'comprovantes':
            await this.comprovantesCommand.execute(from, commandArgs);
            break;

        case 'grupo':
            await this.grupoCommand.execute(commandArgs, from);
            break;

        case 'ban':
            await this.banCommand.execute(msg, commandArgs, from, sender);
            break;

        case 'antilink':
            await this.antilinkCommand.execute(msg, commandArgs, from, sender);
            break;

        case 'setprefix':
            await this.setprefixCommand.execute(msg, commandArgs, from, sender);
            break;

        case 'linkgp':
            await this.linkgpCommand.execute(msg, commandArgs, from, sender);
            break;

        case 'delete':
        case 'd':
        case 'del':
            await this.deleteCommand.execute(msg, args, from, sender)

        default:
            await this.sendMessage(from, `❌ Comando não reconhecido. Digite ${donoData.prefixo}help para ver os comandos.`);
    }
}
    getMessageText(msg) {
        return (
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            msg.message?.imageMessage?.caption ||
            msg.message?.videoMessage?.caption ||
            ''
        );
    }

    async sendMessage(jid, text, options = {}) {
        try {
            await this.sock.sendMessage(jid, { text, ...options });
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
        }
    }
}

module.exports = MessageHandler;