const fs = require('fs');
const path = require('path');

const EventHandler = require('./EventHandler');
const SecurityHandler = require('./SecurityHandler');
const PaymentHandler = require('./PaymentHandler');
const CommandRouter = require('./CommandRouter');

// Handlers especializados
const TabelaHandler = require('./TabelaHandler');
const ComprovanteHandler = require('./ComprovanteHandler');
const CompraHandler = require('./CompraHandler');

// Comandos públicos
const MenuCommand = require('../commands/membros/menu');
const TikTokCommand = require('../commands/membros/tiktok');
const TabelaCommand = require('../commands/membros/tabela');
const PingCommand = require('../commands/membros/ping');
const HelpCommand = require('../commands/membros/help');
const PlayCommand = require('../commands/membros/play');

// Comandos de dono
const MeInfoCommand = require('../commands/dono/me');
const AtivarCommand = require('../commands/dono/ativar');
const JoinCommand = require('../commands/dono/join');
const SairCommand = require('../commands/dono/sair');
const LicencaCommand = require('../commands/dono/licensa');
const LicencasCommand = require('../commands/dono/licensas');
const LimparCommand = require('../commands/dono/limpar');
const SemCompraCommand = require('../commands/dono/semcompra');
const MarcarCommand = require('../commands/dono/marcar');
const AddPagamento = require('../commands/dono/addPagamento');
const AddCoinCommand = require('../commands/dono/addcoin');
const ConfigNumerosCommand = require('../commands/dono/confignumeros');
const FotoGpCommand = require('../commands/dono/fotogp');
const ClientesCommand = require('../commands/dono/clientes');
const DescGpCommand = require('../commands/dono/descgp');
const NomeGpCommand = require('../commands/dono/nomegp');
const RebaixarCommand = require('../commands/dono/rebaixar');
const AntiMentionCommand = require('../commands/dono/antimention');
const DeleteCommand = require('../commands/dono/delete');
const SetPrefixCommand = require('../commands/dono/setprefix');
const LinkGpCommand = require('../commands/dono/linkgp');
const AntiLinkCommand = require('../commands/dono/antilink');
const ComprarCommand = require('../commands/dono/comprar');
const StatsCommand = require('../commands/dono/stats');
const ComprovantesCommand = require('../commands/dono/comprovantes');
const GrupoCommand = require('../commands/dono/grupo');
const BanCommand = require('../commands/dono/ban');
const AdminCommand = require('../commands/dono/admin');
const PromoverCommand = require('../commands/dono/promover');
const MigrarGrupoCommand = require('../commands/dono/migrargrupo');

const whatsappValidator = require('./WhatsAppValidator');

class MessageHandler {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;

        // Inicializar sub-handlers
        this.eventHandler = new EventHandler(sock, dataManager);
        this.securityHandler = new SecurityHandler(sock, dataManager);
        this.paymentHandler = new PaymentHandler(sock, dataManager);

        // Handlers especializados
        this.tabelaHandler = new TabelaHandler(sock, dataManager);
        this.comprovanteHandler = new ComprovanteHandler(sock, dataManager);
        this.compraHandler = new CompraHandler(sock, dataManager);

        // Comandos públicos
        this.menuCommand = new MenuCommand(sock, dataManager);
        this.pingCommand = new PingCommand(sock, dataManager);
        this.tabelaCommand = new TabelaCommand(sock, dataManager);
        this.tiktokCommand = new TikTokCommand(sock, dataManager);
        this.playCommand = new PlayCommand(sock, dataManager);
        this.helpCommand = new HelpCommand(sock, dataManager);

        // Comandos de dono
        this.infoCommand = new MeInfoCommand(sock, dataManager);
        this.ativarCommand = new AtivarCommand(sock, dataManager);
        this.joinCommand = new JoinCommand(sock, dataManager);
        this.sairCommand = new SairCommand(sock, dataManager);
        this.licencaCommand = new LicencaCommand(sock, dataManager);
        this.licencasCommand = new LicencasCommand(sock, dataManager);
        this.limparCommand = new LimparCommand(sock, dataManager);
        this.semComprasCommand = new SemCompraCommand(sock, dataManager);
        this.marcarCommand = new MarcarCommand(sock, dataManager);
        this.addcoinCommand = new AddCoinCommand(sock, dataManager);
        this.configNumerosCommand = new ConfigNumerosCommand(sock, dataManager);
        this.fotogpCommand = new FotoGpCommand(sock, dataManager);
        this.clientesCommand = new ClientesCommand(sock, dataManager);
        this.descgpCommand = new DescGpCommand(sock, dataManager);
        this.nomegpCommand = new NomeGpCommand(sock, dataManager);
        this.rebaixarCommand = new RebaixarCommand(sock, dataManager);
        this.antimentionCommand = new AntiMentionCommand(sock, dataManager);
        this.deleteCommand = new DeleteCommand(sock, dataManager);
        this.setprefixCommand = new SetPrefixCommand(sock, dataManager);
        this.linkgpCommand = new LinkGpCommand(sock, dataManager);
        this.antilinkCommand = new AntiLinkCommand(sock, dataManager);
        this.comprarCommand = new ComprarCommand(sock, dataManager);
        this.statsCommand = new StatsCommand(sock, dataManager);
        this.comprovantesCommand = new ComprovantesCommand(sock, dataManager);
        this.grupoCommand = new GrupoCommand(sock, dataManager);
        this.banCommand = new BanCommand(sock, dataManager);
        this.adminCommands = new AdminCommand(sock, dataManager);
        this.promoteCommand = new PromoverCommand(sock, dataManager);

        // Router de comandos
        const commands = {
            menuCommand: this.menuCommand,
            pingCommand: this.pingCommand,
            tabelaCommand: this.tabelaCommand,
            tiktokCommand: this.tiktokCommand,
            infoCommand: this.infoCommand,
            playCommand: this.playCommand,
            helpCommand: this.helpCommand
        };

        this.commandRouter = new CommandRouter(sock, dataManager, commands);

        // Configurar eventos
        this.eventHandler.setup();
    }

    async handle(msg) {
        try {
            // ========== EXTRAÇÃO DE DADOS ==========
            const from = msg.key.remoteJid;
            const messageText = this.getMessageText(msg);
            const senderName = msg.pushName || "Usuário";
            const isGroup = from.endsWith('@g.us');
            
            let sender = isGroup ? msg.key.participant : from;
            if (!sender) sender = from;

            const senderNumber = sender
                .replace(/(@s\.whatsapp\.net|@lid|@c\.us)/g, '')
                .split('@')[0];

            // ========== DEBUG LOGS ==========
            console.log('========== DEBUG MESSAGE HANDLER ==========');
            console.log('fromMe:', msg.key.fromMe);
            console.log('remoteJid:', msg.key.remoteJid);
            console.log('participant:', msg.key.participant);
            console.log('isGroup:', isGroup);
            console.log('sender:', sender);
            console.log('senderNumber:', senderNumber);
            console.log('==========================================');

            // ========== VERIFICAR GRUPO PERMITIDO ==========
            const allowedGroups = this.dataManager.getAllowedGroups();
            
            if (isGroup && !allowedGroups.includes(from)) {
                console.log(`⚠️ Grupo não permitido: ${from}`);
                return;
            }

            // ========== ATUALIZAR DADOS DO USUÁRIO ==========
            await this.updateUserData(msg, sender, senderNumber, senderName);

            // ========== LOG DA MENSAGEM ==========
            this.logMessage(msg, messageText, from, sender, isGroup, senderName);

            // ========== PREFIXO ==========
            const donoData = this.dataManager.getDonoData();
            const PREFIX = donoData.Prefixo || '!';

            // ========== COMANDO !ATIVAR (SEM VALIDAÇÃO) ==========
            if (messageText.toLowerCase().startsWith(`${PREFIX}ativar`)) {
                const args = messageText.slice(PREFIX.length + 6).trim().split(/ +/);
                await this.ativarCommand.execute(msg, args, from, sender);
                return;
            }

            // ========== STATUS MENTION (COM VALIDAÇÃO ALAUDA) ==========
            if (msg.message?.groupStatusMentionMessage && isGroup) {
                await this.handleStatusMention(msg, from, sender);
                return;
            }

            // ========== DETECTAR IMAGEM (COMPROVANTE) ==========
            const hasImage = msg.message?.imageMessage;
            if (hasImage) {
                console.log('📸 Imagem detectada');
                await this.comprovanteHandler.processarImagem(msg, from, sender);
                return;
            }

            // ========== SISTEMA DE PAGAMENTO ==========
            if (messageText) {
                const handled = await this.paymentHandler.handle(messageText, from);
                if (handled) return;
            }

            // ========== COMANDOS ESPECIAIS ==========
            if (messageText === '!renovar' && isGroup) {
                await this.handleRenovar(messageText, from, senderNumber);
                return;
            }

            if (messageText.toLowerCase().startsWith('!addpagamento')) {
                const args = messageText.split(' ').slice(1);
                await AddPagamento.execute(this.sock, msg, args, this.dataManager);
                return;
            }

            if (messageText.toLowerCase().startsWith('!addtabela')) {
                await this.handleAddTabela(messageText, from, sender, senderNumber, msg);
                return;
            }

            if (messageText === '/grupoId' && isGroup) {
                await this.sock.sendMessage(from, { text: `📌 ID deste grupo: ${from}` });
                return;
            }

            // ========== SEGURANÇA ==========
            if (isGroup && messageText) {
                if (await this.securityHandler.checkAntiPalavrao(msg, messageText, from, sender)) return;
                if (await this.antilinkCommand.checkForLinks(msg, from, sender)) return;
            }

            if (!isGroup && messageText) {
                if (await this.securityHandler.checkAntiPV(from, sender)) return;
            }

            // ========== DETECTAR COMPROVANTE ==========
            if (messageText && this.comprovanteHandler.isComprovante(messageText)) {
                await this.comprovanteHandler.processar(messageText, from, sender);
                return;
            }

	    // ========== COMANDO PREFIXO (SEM PREFIXO) ==========
if (messageText) {
    const bodyLower = messageText.toLowerCase().trim();
    
    if (bodyLower === 'prefixo' || bodyLower === 'prefix') {
        console.log('📌 Comando prefixo detectado (sem prefixo)');
        
        const PrefixoCommand = require('../commands/membros/prefixo');
        const prefixoCmd = new PrefixoCommand(this.sock, this.dataManager);
        await prefixoCmd.execute(msg, [], from, sender);
        return;
    }
}


            // ========== COMANDOS PÚBLICOS ==========
            if (messageText) {
                const handled = await this.handlePublicCommands(msg, messageText, from, sender, PREFIX);
                if (handled) return;
            }

            // ========== COMANDOS DE DONO ==========
            if (messageText && (messageText.startsWith(PREFIX) || messageText.startsWith('/'))) {
                const isDono = this.dataManager.isDono(senderNumber);
                if (isDono) {
                    await this.handleDonoCommand(msg, messageText, from, sender);
                }
            }

        } catch (error) {
            console.error('❌ Erro no MessageHandler:', error);
            console.error('Stack:', error.stack);
        }
    }

    async handleStatusMention(msg, from, sender) {
        const participant = msg.key.participant;
        const participantName = msg.pushName || participant?.split('@')[0] || 'Usuário';

        console.log('🎯 Status mention detectado:', participant);

        try {
            // Verificar proteções
            const donoData = this.dataManager.getDonoData();
            const donoBotNumber = donoData.NumeroDono + '@s.whatsapp.net';
            const isDonoBOT = participant === donoBotNumber;

            const groupMetadata = await this.sock.groupMetadata(from);
            const isAdminGrupo = groupMetadata.participants.some(
                p => p.id === participant && (p.admin === 'admin' || p.admin === 'superadmin')
            );

            const botNumber = this.sock.user.id.split(':')[0] + '@s.whatsapp.net';
            const isBot = participant === botNumber;

            if (isDonoBOT || isAdminGrupo || isBot) {
                console.log('✅ Usuário protegido');
                return;
            }

            // Validar com Alauda API
            const validation = await whatsappValidator.validate(from);

            if (!validation.valid) {
                console.log('❌ Grupo não autorizado');
                await this.sock.sendMessage(from, {
                    text: validation.message || `⚠️ BOT NÃO ATIVADO NESTE GRUPO`
                });
                return;
            }

            // Consumir créditos
            const consumption = await whatsappValidator.consume(from);

            if (!consumption.success) {
                console.log('❌ Erro ao consumir créditos');
                return;
            }

            // Processar avisos/ban
            let warnings = this.dataManager.getStatusMentionWarnings(from, participant);

            if (warnings === 0) {
                warnings = this.dataManager.addStatusMentionWarning(from, participant);
                await this.sock.sendMessage(from, {
                    text: `⚠️ *AVISO* ⚠️\n\n@${participant.split('@')[0]}, evite marcar o grupo nos seus status.\n\n⚠️ *Próxima vez você será removido!*\n\n📊 Avisos: ${warnings}/2`,
                    mentions: [participant]
                });
            } else {
                await this.sock.groupParticipantsUpdate(from, [participant], 'remove');
                await this.sock.sendMessage(from, {
                    text: `❌ @${participant.split('@')[0]} foi removido por marcar o grupo no status repetidamente.`,
                    mentions: [participant]
                });
            }

        } catch (error) {
            console.error('Erro no handleStatusMention:', error);
        }
    }

    async handlePublicCommands(msg, messageText, from, sender, PREFIX) {
        let cmdText = messageText.trim();

        if (cmdText.startsWith(PREFIX)) {
            cmdText = cmdText.slice(PREFIX.length).trim();
        } else if (cmdText.startsWith('/')) {
            cmdText = cmdText.slice(1).trim();
        } else {
            return false;
        }

        const parts = cmdText.split(/\s+/);
        const cmd = parts[0].toLowerCase();
        const args = parts.slice(1);

        console.log('📍 Comando público:', cmd);

        switch (cmd) {
            case 'menu':
            case 'ajuda':
            case 'help':
                await this.menuCommand.execute(msg, args, from, sender);
                return true;

            case 'ping':
                await this.pingCommand.execute(from);
                return true;

            case 'tabela':
                await this.tabelaCommand.execute(msg, from, sender);
                return true;

            case 'tiktok':
                await this.tiktokCommand.execute(msg, args, from, sender);
                return true;

            case 'me':
                await this.infoCommand.execute(msg, [], from, sender, false);
                return true;

            case 'info':
                await this.infoCommand.execute(msg, args, from, sender, true);
                return true;

            case 'dono':
                const dono = this.dataManager.getDonoData();
                await this.sendMessage(from, `👨‍💼 Dono: ${dono.NickDono}\n📞 Número: +${dono.NumeroDono}`);
                return true;

            case 'infodono':
                const donoInfo = this.dataManager.getDonoData();
                await this.sendMessage(from, `👨‍💼 Nome: ${donoInfo.NickDono}\n📞 Número: +${donoInfo.NumeroDono}`);
                return true;

            case 'infobot':
                const donoBot = this.dataManager.getDonoData();
                await this.sendMessage(from, `🤖 Bot: ${donoBot.NomeDoBot || 'Bot'}\n⚙️ Prefixo: ${PREFIX}\n🔗 Repositório: https://github.com/Eliobros/mega-bot`);
                return true;

            default:
                return false;
        }
    }

    async handleDonoCommand(msg, messageText, from, sender) {
        let senderJid = msg.key.participant || msg.key.remoteJid;
        if (Array.isArray(senderJid)) senderJid = senderJid[0];

        const donoData = this.dataManager.getDonoData();
        const prefixo = donoData.Prefixo || '!';

        const withoutPrefix = messageText.slice(prefixo.length).trim();
        const args = withoutPrefix.split(/\s+/);
        const cmd = args[0].toLowerCase();
        const commandArgs = args.slice(1);

        const senderNumber = sender.split('@')[0];

        console.log('========= COMANDO DE DONO =========');
        console.log('Comando:', cmd);
        console.log('Args:', commandArgs);
        console.log('===================================');

        switch (cmd) {
            case 'addgp':
                if (from.endsWith('@g.us')) {
                    const added = this.dataManager.addAllowedGroup(from);
                    await this.sendMessage(from, added ? '✅ Grupo adicionado' : 'ℹ️ Grupo já está na lista');
                }
                break;

            case 'rmgp':
                if (from.endsWith('@g.us')) {
                    const removed = this.dataManager.removeAllowedGroup(from);
                    await this.sendMessage(from, removed ? '✅ Grupo removido' : 'ℹ️ Grupo não estava na lista');
                }
                break;

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
                await this.grupoCommand.execute(commandArgs, from, sender, msg.pushName);
                break;

            case 'ban':
            case 'b':
            case 'chutar':
                await this.banCommand.execute(msg, commandArgs, from, sender);
                break;

            case 'antilink':
                await this.antilinkCommand.execute(msg, commandArgs, from, sender);
                break;

            case 'setprefix':
                await this.setprefixCommand.execute(msg, commandArgs, from, sender);
                break;

            case 'licenca':
            case 'licença':
            case 'license':
                await this.licencaCommand.execute(msg, commandArgs, from, sender);
                break;

            case 'licencas':
            case 'licenças':
            case 'licenses':
                await this.licencasCommand.execute(msg, commandArgs, from, sender);
                break;

            case 'linkgp':
                await this.linkgpCommand.execute(msg, commandArgs, from, sender);
                break;

            case 'antimention':
                await this.antimentionCommand.execute(msg, commandArgs, from, sender);
                break;

            case 'migrargrupo':
                const migrarCmd = new MigrarGrupoCommand(this.sock, this.dataManager);
                await migrarCmd.execute(msg, commandArgs, from, sender);
                break;

            case 'delete':
            case 'del':
            case 'd':
                await this.deleteCommand.execute(msg, commandArgs, from, sender);
                break;

            case 'limpar':
            case 'evacuar':
                await this.limparCommand.execute(msg, sender, from);
                break;

            case 'semcompras':
            case 'fantasmas':
            case 't':
                await this.semComprasCommand.execute(msg, sender, from);
                break;

            case 'marcar':
                await this.marcarCommand.execute(msg, sender, from);
                break;

            case 'join':
            case 'entrar':
                await this.joinCommand.execute(msg, commandArgs, from, senderJid);
                break;

            case 'sair':
            case 'leave':
                await this.sairCommand.execute(msg, commandArgs, from, senderJid);
                break;

            case 'hidetag':
            case 'ht':
                await this.adminCommands.execute(msg, commandArgs, from, sender);
                break;

            case 'meunumero':
            case 'debug':
                await this.handleDebugCommand(sender, senderNumber, from);
                break;

            case 'promover':
            case 'promote':
                await this.promoteCommand.execute(msg, commandArgs, from, sender);
                break;

            case 'rebaixar':
            case 'demote':
                await this.rebaixarCommand.execute(msg, commandArgs, from, sender);
                break;

            case 'registrar':
            case 'config':
                await this.configNumerosCommand.execute(msg, commandArgs, from, sender);
                break;

            case 'msgbv':
                await this.adminCommands.msgbv(msg, commandArgs, from, sender);
                break;

            case 'msgsaiu':
                await this.adminCommands.msgsaiu(msg, commandArgs, from, sender);
                break;

            case 'bemvindo':
                await this.adminCommands.bemvindo(msg, commandArgs, from, sender);
                break;

            case 'saiu':
                await this.adminCommands.saiu(msg, commandArgs, from, sender);
                break;

            case 'play':
            case 'p':
                await this.playCommand.execute(msg, commandArgs, from, sender);
                break;

            case 'admins':
                await this.adminCommands.admins(msg, commandArgs, from, sender);
                break;

            case 'clientes':
            case 'rankmb':
                await this.clientesCommand.execute(msg, commandArgs, from, sender);
                break;

            case 'nomegp':
            case 'setname':
                await this.nomegpCommand.execute(msg, commandArgs, from, sender);
                break;

            case 'fotogp':
            case 'setfoto':
                await this.fotogpCommand.execute(msg, commandArgs, from, sender);
                break;

            case 'addcoin':
            case 'addsaldo':
                await this.addcoinCommand.execute(msg, commandArgs, from, sender);
                break;

            case 'descgp':
            case 'setdesc':
                await this.descgpCommand.execute(msg, commandArgs, from, sender);
                break;

            case 'reiniciar':
            case 'restart':
                await this.adminCommands.reiniciar(msg, commandArgs, from);
                break;

            case 'status-bot':
                await this.adminCommands.statusbot(msg, commandArgs, from);
                break;

            case 'premio':
                await this.adminCommands.premio(msg, commandArgs, from);
                break;

            case 'anticall':
                await this.adminCommands.anticall(msg, commandArgs, from);
                break;

            case 'antipalavrao':
                await this.adminCommands.antipalavrao(msg, commandArgs, from);
                break;

            case 'addpalavrao':
                await this.adminCommands.addpalavrao(msg, commandArgs, from);
                break;

            case 'rmpalavra':
                await this.adminCommands.rmpalavra(msg, commandArgs, from);
                break;

            case 'listpalavra':
                await this.adminCommands.listpalavra(msg, commandArgs, from);
                break;

            case 'antifake':
                await this.adminCommands.antifake(msg, commandArgs, from);
                break;

            case 'antipv':
                await this.adminCommands.antipv(msg, commandArgs, from);
                break;

            default:
                await this.sendMessage(from, `❌ Comando não reconhecido. Digite ${prefixo}help`);
        }
    }

    async handleRenovar(messageText, from, senderNumber) {
        const donoData = this.dataManager.getDonoData();
        if (senderNumber !== donoData.NumeroDono.replace(/\D/g, '')) {
            return this.sock.sendMessage(from, {
                text: '⚠️ Apenas o dono pode renovar assinaturas.'
            });
        }

        const args = messageText.split(' ').slice(1);
        const days = parseInt(args[0]) || 30;
        const renovado = this.dataManager.renewGroupSubscription(from, days);

        if (renovado) {
            const newDate = new Date(Date.now() + days * 86400000).toLocaleDateString();
            await this.sock.sendMessage(from, {
                text: `✅ Assinatura renovada por ${days} dias!\nNova data: ${newDate}`
            });
        } else {
            await this.sock.sendMessage(from, {
                text: '❌ Este grupo não possui assinatura ativa.'
            });
        }
    }

    async handleAddTabela(messageText, from, sender, senderNumber, msg) {
        const donoData = this.dataManager.getDonoData();
        if (senderNumber !== donoData.NumeroDono.replace(/\D/g, '')) {
            return this.sock.sendMessage(sender, {
                text: '⚠️ Apenas o dono pode registrar tabelas.'
            });
        }

        if (!from.endsWith('@g.us')) {
            return this.sock.sendMessage(sender, {
                text: '❌ Este comando só funciona em grupos.'
            });
        }

        const args = messageText.split(' ').slice(1);
        let tabelaTexto = args.join(' ').trim();

        if (tabelaTexto.startsWith('"') && tabelaTexto.endsWith('"')) {
            tabelaTexto = tabelaTexto.slice(1, -1);
        }

        if (!tabelaTexto && msg.message.conversation) {
            tabelaTexto = msg.message.conversation;
        } else if (!tabelaTexto && msg.message.extendedTextMessage?.text) {
            tabelaTexto = msg.message.extendedTextMessage.text;
        }

        if (!tabelaTexto) {
            return this.sock.sendMessage(sender, {
                text: '❌ Use: !addTabela "texto da tabela"'
            });
        }

        this.dataManager.saveTabelaByGroup(from, {
            tabela: tabelaTexto,
            criadoEm: new Date().toISOString()
        });

        await this.sock.sendMessage(from, {
            text: '✅ Tabela registrada com sucesso!'
        });
    }

    async handleDebugCommand(sender, senderNumber, from) {
        const debugInfo = `
🔍 *DEBUG - INFORMAÇÕES*

━━━━━━━━━━━━━━━━━━━━━━━
📱 *Sender JID:*
${sender}

🔢 *Número:*
${senderNumber}

━━━━━━━━━━━━━━━━━━━━━━━
💡 *Use no dono.json:*
"NumeroDono": "${senderNumber}"

🤖 *Tina Bot Debug*
        `;

        await this.sendMessage(from, debugInfo);
    }

    async updateUserData(msg, sender, senderNumber, senderName) {
        try {
            const usersData = this.dataManager.getUsersData();
            if (!usersData.usuarios) usersData.usuarios = {};

            if (!usersData.usuarios[sender]) {
                usersData.usuarios[sender] = {
                    nome: senderName,
                    pushName: senderName,
                    numero: senderNumber,
                    total_compras: 0,
                    total_gb_acumulado: 0,
                    primeira_compra: '',
                    ultima_compra: '',
                    compras_hoje: 0,
                    historico_compras: []
                };
            } else {
                usersData.usuarios[sender].pushName = senderName;
                if (!usersData.usuarios[sender].nome || usersData.usuarios[sender].nome === usersData.usuarios[sender].numero) {
                    usersData.usuarios[sender].nome = senderName;
                }
                if (!usersData.usuarios[sender].numero) {
                    usersData.usuarios[sender].numero = senderNumber;
                }
            }

            this.dataManager.saveUsersData();
        } catch (e) {
            console.log('Aviso: erro ao atualizar usuário');
        }
    }

    logMessage(msg, messageText, from, sender, isGroup, senderName) {
        const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const senderNumber = sender.split('@')[0];

        console.log(`
========= TINA BOT Logs =======
|-> Mensagem: ${messageText}
|-> Usuário: ${senderName}
|-> Número: ${senderNumber}
|-> Sender JID: ${sender}
|-> Grupo: ${isGroup ? "Sim" : "Não"}
|-> Data: ${time}
==============================
        `);
    }

    async isGroupAdmin(groupJid, sender) {
        try {
            const metadata = await this.sock.groupMetadata(groupJid);
            const participant = metadata.participants.find(p => p.id === sender);
            return participant?.admin === 'admin' || participant?.admin === 'superadmin';
        } catch (err) {
            console.error("Erro ao verificar admin:", err);
            return false;
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
