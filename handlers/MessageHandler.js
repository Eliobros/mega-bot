const fs = require('fs');
const path = require('path');

const EventHandler = require('./EventHandler');
const SecurityHandler = require('./SecurityHandler');
const PaymentHandler = require('./PaymentHandler');
const CommandLoader = require('./CommandLoader');

// Handlers especializados
const TabelaHandler = require('./TabelaHandler');
const ComprovanteHandler = require('./ComprovanteHandler');
const CompraHandler = require('./CompraHandler');

const whatsappValidator = require('./WhatsAppValidator');

class MessageHandler {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;

        // 🆕 Proteção contra duplicação de mensagens
        this.processedMessages = new Set();

        // Inicializar sub-handlers
        this.eventHandler = new EventHandler(sock, dataManager);
        this.securityHandler = new SecurityHandler(sock, dataManager);
        this.paymentHandler = new PaymentHandler(sock, dataManager);

        // Handlers especializados
        this.tabelaHandler = new TabelaHandler(sock, dataManager);
        this.comprovanteHandler = new ComprovanteHandler(sock, dataManager);
        this.compraHandler = new CompraHandler(sock, dataManager);

        // 🚀 NOVO: Sistema de carregamento automático de comandos
        this.commandLoader = new CommandLoader(sock, dataManager);

        // Configurar eventos
        this.eventHandler.setup();

        console.log('✅ MessageHandler inicializado com sistema de comandos dinâmico');
    }

    async handle(msg) {
        try {
            // 🆕 PROTEÇÃO CONTRA FLOOD - Ignorar mensagens duplicadas
            const msgId = msg.key.id;
            if (this.processedMessages.has(msgId)) {
                console.log('⏭️ Mensagem já processada, ignorando...');
                return;
            }
            this.processedMessages.add(msgId);
            
            // Limpar cache após 2 minutos
            setTimeout(() => this.processedMessages.delete(msgId), 120000);

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
                await this.commandLoader.executeCommand('ativar', msg, args, from, sender);
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

            // ========== COMANDOS ESPECIAIS (SEM PREFIXO) ==========
            if (messageText === '!renovar' && isGroup) {
                await this.handleRenovar(messageText, from, senderNumber);
                return;
            }

            if (messageText.toLowerCase().startsWith('!addpagamento')) {
                const args = messageText.split(' ').slice(1);
                await this.commandLoader.executeCommand('addpagamento', msg, args, from, sender);
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
                // Verificar palavrão
                if (await this.securityHandler.checkAntiPalavrao(msg, messageText, from, sender)) return;
                
                // 🆕 Verificar antilink apenas se houver link na mensagem
                if (messageText.includes('http') || messageText.includes('www.') || messageText.includes('.com')) {
                    const hasAntilink = await this.securityHandler.checkAntilink(messageText, from, sender);
                    if (hasAntilink) return;
                }
            }

            if (!isGroup && messageText) {
                if (await this.securityHandler.checkAntiPV(from, sender)) return;
            }

            // ========== DETECTAR COMPROVANTE ==========
            if (messageText && this.comprovanteHandler.isComprovante(messageText)) {
                await this.comprovanteHandler.processar(messageText, from, sender);
                return;
            }

            // ========== COMANDO PREFIXO (SEM PREFIXO - CASO ESPECIAL) ==========
            if (messageText) {
                const bodyLower = messageText.toLowerCase().trim();
                if (bodyLower === 'prefixo' || bodyLower === 'prefix') {
                    console.log('📌 Comando prefixo detectado (sem prefixo)');
                    await this.commandLoader.executeCommand('prefixo', msg, [], from, sender);
                    return;
                }
            }

            // ========== PROCESSAR COMANDOS COM PREFIXO ==========
            if (messageText && (messageText.startsWith(PREFIX) || messageText.startsWith('/'))) {
                await this.handleCommand(messageText, msg, from, sender, PREFIX);
                return;
            }

        } catch (error) {
            console.error('❌ Erro no MessageHandler:', error);
            console.error('Stack:', error.stack);
        }
    }

    async handleCommand(messageText, msg, from, sender, PREFIX) {
        // Remove prefixo
        let cmdText = messageText.trim();

        if (cmdText.startsWith(PREFIX)) {
            cmdText = cmdText.slice(PREFIX.length).trim();
        } else if (cmdText.startsWith('/')) {
            cmdText = cmdText.slice(1).trim();
        }

        // Parse comando e argumentos
        const parts = cmdText.split(/\s+/);
        const commandName = parts[0].toLowerCase();
        const args = parts.slice(1);

        console.log(`🎮 Executando comando: ${commandName}`);
        console.log(`📝 Argumentos:`, args);

        // Executar comando através do CommandLoader
        const executed = await this.commandLoader.executeCommand(
            commandName,
            msg,
            args,
            from,
            sender
        );

        // Se comando não foi encontrado
        if (!executed) {
            await this.sock.sendMessage(from, {
                text: `❌ Comando *${PREFIX}${commandName}* não encontrado.\n\n` +
                      `💡 Digite *${PREFIX}help* para ver comandos disponíveis.`
            });
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

