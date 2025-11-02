const TabelaHandler = require('./TabelaHandler');
const ComprovanteHandler = require('./ComprovanteHandler');
const CompraHandler = require('./CompraHandler');

// Comandos de membros
//const TinaCommand = require('../commands/membros/tina');
const MenuCommand = require('../commands/membros/menu');
//const SemCompraCommand = require('../commands/dono/semcompra');
//const MarcarCommand = require('../commands/dono/marcar');
const TabelaCommand = require('../commands/membros/tabela');
const PingCommand = require('../commands/membros/ping');
const HelpCommand = require('../commands/membros/help');
const PlayCommand = require('../commands/membros/play')

//comandos para dono
const whatsappValidator = require('../handlers/WhatsAppValidator');
const AtivarCommand = require('../commands/dono/ativar');
const LimparCommand = require('../commands/dono/limpar');
const SemCompraCommand = require('../commands/dono/semcompra');
const MarcarCommand = require('../commands/dono/marcar');
const AddPagamento = require('../commands/dono/addPagamento');
const MeInfoCommand = require('../commands/dono/me');
const AddCoinCommand = require('../commands/dono/addcoin');
const FotoGpCommand = require('../commands/dono/fotogp');
const ClientesCommand = require('../commands/dono/clientes');
const DescGpCommand = require('../commands/dono/descgp');
const NomeGpCommand = require('../commands/dono/nomegp');
const RebaixarCommand = require('../commands/dono/rebaixar');
const AntiMentionCommand = require('../commands/dono/antimention');
const DeleteCommand = require('../commands/dono/delete')
const SetPrefixCommand = require('../commands/dono/setprefix')
const LinkGpCommand = require('../commands/dono/linkgp')
const AntiLinkCommand = require('../commands/dono/antilink')
const ComprarCommand = require('../commands/dono/comprar');
const StatsCommand = require('../commands/dono/stats');
const ComprovantesCommand = require('../commands/dono/comprovantes');
const GrupoCommand = require('../commands/dono/grupo');
const BanCommand = require('../commands/dono/ban');
const AdminCommand = require('../commands/dono/admin');
const PromoverCommand = require('../commands/dono/promover');

class MessageHandler {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;

        // Inicializar handlers
        this.tabelaHandler = new TabelaHandler(sock, dataManager);
        this.comprovanteHandler = new ComprovanteHandler(sock, dataManager);
        this.compraHandler = new CompraHandler(sock, dataManager);

        // Inicializar comandos de membros
        this.playCommand = new PlayCommand(sock, dataManager);
        this.menuCommand = new MenuCommand(sock, dataManager);
        this.tabelaCommand = new TabelaCommand(sock, dataManager);
        this.pingCommand = new PingCommand(sock, dataManager);
        this.helpCommand = new HelpCommand(sock, dataManager);

        // Inicializar comandos de dono
	this.ativarCommand = new AtivarCommand(sock, dataManager);
	this.limparCommand = new LimparCommand(sock, dataManager);
	this.semComprasCommand = new SemCompraCommand(sock, dataManager);
	this.marcarCommamd = new MarcarCommand(sock, dataManager);
//	this.tinaCommand = new TinaCommand(sock, dataManager)
        this.infoCommand = new MeInfoCommand(sock, dataManager)
        this.clientesCommand = new ClientesCommand(sock, dataManager);
        this.addcoinCommand = new AddCoinCommand(sock, dataManager);
        this.fotogpCommand = new FotoGpCommand(sock, dataManager);
        this.descgpCommand = new DescGpCommand(sock, dataManager);
        this.nomegpCommand = new NomeGpCommand(sock, dataManager)
        this.adminCommands = new AdminCommand(sock, dataManager)
        this.antimentionCommand = new AntiMentionCommand(sock, dataManager);
        this.deleteCommand = new DeleteCommand(sock, dataManager)
        this.antilinkCommand = new AntiLinkCommand(sock, dataManager)
        this.setprefixCommand = new SetPrefixCommand(sock, dataManager)
        this.linkgpCommand = new LinkGpCommand(sock, dataManager)
        this.comprarCommand = new ComprarCommand(sock, dataManager);
        this.statsCommand = new StatsCommand(sock, dataManager);
        this.comprovantesCommand = new ComprovantesCommand(sock, dataManager);
        this.grupoCommand = new GrupoCommand(sock, dataManager);
        this.banCommand = new BanCommand(sock, dataManager);
        this.hidetagCommand = new AdminCommand(sock, dataManager);
        this.promoteCommand = new PromoverCommand(sock, dataManager);
        this.rebaixarCommand = new RebaixarCommand(sock, dataManager);
        this.bemvindoCommand = new AdminCommand(sock, dataManager);
        this.saiuCommand = new AdminCommand(sock, dataManager);
        this.msgbvCommand = new AdminCommand(sock, dataManager);
        this.msgsaiuCommand = new AdminCommand(sock, dataManager);

        // ✅ CORREÇÃO: Registrar eventos no constructor, NÃO no método handle()
        this.setupEvents();
    }

    // ✅ Método separado para configurar eventos (chamado apenas UMA vez)
    setupEvents() {
        // Detectar mudanças no grupo (entrada/saída de membros)
        this.sock.ev.on('group-participants.update', async (update) => {
            const { id: groupJid, participants,action } = update;
            
            console.log(`👥 Evento detectado: ${action} no grupo ${groupJid}`);
            console.log(`👤 Participantes: ${participants.join(', ')}`);
            
            try {
                for (const participantJid of participants) {
                    if (action === 'add') {
                        // Novo membro entrou
                        console.log(`👋 Novo membro: ${participantJid} entrou em ${groupJid}`);
                        // Antifake: permitir apenas +258
                        try {
                            const cfg = this.dataManager.getDonoData().groups?.[groupJid] || {};
                            if (cfg.antifake === true) {
                                const num = participantJid.replace('@s.whatsapp.net','');
                                if (!num.startsWith('258')) {
                                    await this.sock.groupParticipantsUpdate(groupJid, [participantJid], 'remove');
                                    await this.sendMessage(groupJid, `🚫 Número não permitido: @${num}. Apenas Moçambique (+258).`, { mentions: [participantJid] });
                                    continue;
                                }
                            }
                        } catch {}
                        await this.adminCommands.handleNewMember(groupJid, participantJid);
                        
                    } else if (action === 'remove') {
                        // Membro saiu/foi removido
                        console.log(`👋 Membro saiu: ${participantJid} saiu de ${groupJid}`);
                        await this.adminCommands.handleMemberLeft(groupJid, participantJid);
                    }
                }
            } catch (error) {
                console.error(`❌ Erro ao processar evento ${action}:`, error);
            }
        });

        // Anti-call: bloquear chamadas recebidas
        this.sock.ev.on('call', async (calls) => {
            try {
                const dono = this.dataManager.getDonoData();
                const anticallAtivo = Object.values(dono.groups || {}).some(g => g.anticall === true);
                if (!anticallAtivo) return;
                for (const call of calls) {
                    const fromJid = call.from || call.id || null;
                    if (!fromJid) continue;
                    try {
                        await this.sock.updateBlockStatus(fromJid, 'block');
                        const num = fromJid.replace('@s.whatsapp.net', '');
                        await this.sendMessage(fromJid, '🚫 Chamadas não são permitidas. Você foi bloqueado.');
                        console.log(`📵 Usuário ${num} bloqueado por ligação.`);
                    } catch (e) {
                        console.log('Falha ao bloquear chamador:', e?.message || e);
                    }
                }
            } catch (e) {
                console.log('Erro no handler de call:', e?.message || e);
            }
        });

        console.log("✅ Eventos configurados com sucesso!");
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

    async handle(msg) {
        // ========== EXTRAÇÃO DE DADOS DA MENSAGEM ==========
        const from = msg.key.remoteJid;
        const messageText = this.getMessageText(msg);
        const senderName = msg.pushName || "Usuário";
        const isGroup = from.endsWith('@g.us');
	// ===== 🔍 LOGS DE DEBUG =====
    console.log('========== DEBUG MESSAGE HANDLER ==========');
    console.log('fromMe:', msg.key.fromMe);
    console.log('remoteJid:', msg.key.remoteJid);
    console.log('participant:', msg.key.participant);
    console.log('messageType:', Object.keys(msg.message || {})[0]);
    console.log('messageStubType:', msg.messageStubType);
    console.log('isGroup:', isGroup);
    console.log('==========================================');
    // ============================
	  
	 
	if (msg.key.fromMe) {
        console.log('⏭️ Ignorando mensagem do próprio bot');
        return; // Para aqui, não processa mais nada
    }
        // 📌 Pega o número do remetente
        let sender = isGroup ? msg.key.participant : from;
        if (!sender) sender = from; // fallback se participant for null

        // 🔢 Extrai só o número (sem @s.whatsapp.net, @lid, @c.us)
        const senderNumber = sender
            .replace(/(@s\.whatsapp\.net|@lid|@c\.us)/g, '')
            .split('@')[0];

        // ========== VERIFICAÇÃO DE GRUPO PERMITIDO ==========
        const allowedGroups = this.dataManager.getAllowedGroups();
        if (isGroup && !allowedGroups.includes(from)) {
            console.log(`⚠️ Mensagem ignorada de grupo não permitido: ${from}`);
            return;
        }

        // ========== ATUALIZAR PUSHNAME DO USUÁRIO ==========
        try {
            const usersData = this.dataManager.getUsersData();
            if (!usersData.usuarios) usersData.usuarios = {};
            const jidKey = sender;
            if (!usersData.usuarios[jidKey]) {
                usersData.usuarios[jidKey] = {
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
                usersData.usuarios[jidKey].pushName = senderName;
                if (!usersData.usuarios[jidKey].nome || usersData.usuarios[jidKey].nome === usersData.usuarios[jidKey].numero) {
                    usersData.usuarios[jidKey].nome = senderName;
                }
                if (!usersData.usuarios[jidKey].numero) {
                    usersData.usuarios[jidKey].numero = senderNumber;
                }
            }
            this.dataManager.saveUsersData();
        } catch (e) {
            console.log('Aviso: não foi possível atualizar pushName do usuário.');
        }

        // ========== PEGAR NOME DO GRUPO ==========
        let groupName = "N/A";
        if (isGroup && this.sock.groupMetadata) {
            try {
                const metadata = await this.sock.groupMetadata(from);
                groupName = metadata.subject || "Grupo sem nome";
            } catch {
                groupName = "Desconhecido";
            }
        }
	
	
    // ========== VERIFICAÇÃO DE GRUPO PERMITIDO
    
    if (isGroup && !allowedGroups.includes(from)) {
        console.log(`⚠️ Mensagem ignorada de grupo não permitido`);
        return;
    }

    // Carrega o prefixo
    const donoData = this.dataManager.getDonoData();
    const PREFIX = donoData.Prefixo || '!';

    // ========== COMANDO !ativar (NÃO PRECISA DE VALIDAÇÃO) ==========
    if (messageText.toLowerCase().startsWith(`${PREFIX}ativar`)) {
        const args = messageText.slice(PREFIX.length + 6).trim().split(/ +/);
        await this.ativarCommand.execute(msg, args, from, sender);
        return; // Para aqui
    }

    // ===== 🚨 DETECTAR MENÇÃO DO GRUPO NO STATUS (COM VALIDAÇÃO ALAUDA) =====
    if (msg.message?.groupStatusMentionMessage && isGroup) {
        const participant = msg.key.participant;
        const participantName = msg.pushName || participant?.split('@')[0] || 'Usuário';
        
        console.log('🎯 DETECTADO: Alguém marcou o grupo no status!');
        console.log('Quem marcou:', participant);
        console.log('Nome:', participantName);

        // ===== 🔐 VALIDAÇÃO COM ALAUDA API =====
        console.log(`\n🔐 ========== VALIDAÇÃO ALAUDA API ==========`);
        console.log(`📱 Validando número: ${senderNumber}`);
        
        const validation = await whatsappValidator.validate(senderNumber);

        if (!validation.valid) {
            console.log(`❌ Número ${senderNumber} NÃO autorizado ou sem créditos`);
            console.log(`Motivo: ${validation.message}`);
            console.log(`============================================\n`);
            
            // Envia mensagem informando que precisa ativar
            await this.sock.sendMessage(from, {
                text: validation.message || 
                      `⚠️ *BOT NÃO ATIVADO*\n\n` +
                      `O bot precisa ser ativado com uma chave da Alauda API.\n\n` +
                      `📝 *Como ativar:*\n` +
                      `${PREFIX}ativar <sua_chave>\n\n` +
                      `💡 *Exemplo:*\n` +
                      `${PREFIX}ativar alauda_live_abc123\n\n` +
                      `🔗 Obtenha sua chave em:\n` +
                      `https://alauda-api.com`
            });
            
            return; // ❌ NÃO processa a ação
        }

        console.log(`✅ Número AUTORIZADO!`);
        console.log(`💰 Créditos disponíveis: ${validation.credits}`);
        console.log(`💵 Custo desta operação: ${validation.cost || 50} créditos`);
        console.log(`📊 Cache: ${validation.fromCache ? 'SIM' : 'NÃO'}`);
        console.log(`============================================\n`);

        // ===== 💰 CONSOME CRÉDITOS =====
        console.log(`💳 Consumindo créditos...`);
        const consumption = await whatsappValidator.consume(senderNumber);

        if (!consumption.success) {
            console.log(`❌ ERRO ao consumir créditos: ${consumption.message}`);
            
            if (consumption.no_credits) {
                // ❌ SEM CRÉDITOS - Avisa no grupo
                await this.sock.sendMessage(from, {
                    text: `⚠️ *CRÉDITOS INSUFICIENTES*\n\n` +
                          `O bot não pode processar esta ação porque os créditos acabaram.\n\n` +
                          `💰 *Recarregue sua conta para continuar!*\n\n` +
                          `📊 *Informações:*\n` +
                          `• Cada operação: 50 créditos\n` +
                          `• Créditos atuais: 0\n\n` +
                          `🔗 *Recarregar em:*\n` +
                          `https://alauda-api.com/recarregar`
                });
            }
            
            return; // ❌ NÃO processa a ação
        }

        console.log(`✅ Créditos consumidos com sucesso!`);
        console.log(`💸 Consumidos: ${consumption.credits_consumed} créditos`);
        console.log(`💳 Restantes: ${consumption.credits_remaining} créditos\n`);

        // ===== ✅ AGORA SIM, PROCESSA A AÇÃO =====
        console.log(`🚀 Processando ação de status mention...\n`);
        
        // Obter ou criar registro de avisos
        let warnings = this.dataManager.getStatusMentionWarnings(from, participant);
        
        if (warnings === 0) {
            // ⚠️ PRIMEIRO AVISO
            warnings = this.dataManager.addStatusMentionWarning(from, participant);
            
            await this.sock.sendMessage(from, {
                text: `⚠️ *AVISO* ⚠️\n\n` +
                      `@${participant.split('@')[0]}, evite marcar o grupo nos seus status.\n\n` +
                      `⚠️ *Próxima vez você será removido do grupo!*\n\n` +
                      `ℹ️ Créditos restantes: ${consumption.credits_remaining}`,
                mentions: [participant]
            });
            
            console.log(`✅ Primeiro aviso dado para ${participantName}`);
            console.log(`📊 Total de avisos: ${warnings}/2\n`);
            
        } else if (warnings === 1) {
            // ❌ SEGUNDO AVISO = BAN
            this.dataManager.addStatusMentionWarning(from, participant);
            
            // Remove do grupo
            await this.sock.groupParticipantsUpdate(from, [participant], 'remove');
            
            await this.sock.sendMessage(from, {
                text: `❌ @${participant.split('@')[0]} foi removido por marcar o grupo no status repetidamente.\n\n` +
                      `ℹ️ Créditos restantes: ${consumption.credits_remaining}`,
                mentions: [participant]
            });
            
            console.log(`🚫 ${participantName} foi BANIDO por marcar o grupo novamente`);
            console.log(`📊 Total de avisos: 2/2 - REMOVIDO\n`);
            
        } else {
            // Já foi banido antes, bane de novo (caso tenha voltado)
            await this.sock.groupParticipantsUpdate(from, [participant], 'remove');
            console.log(`🚫 ${participantName} foi BANIDO novamente (reincidente)\n`);
        }

        // Log final
        console.log(`🎉 Operação concluída com sucesso!`);
        console.log(`💰 Sistema de créditos funcionando corretamente\n`);
        
        return; // Para aqui, não processa como mensagem normal
    }


	// Detectar imagem
const hasImage = msg.message?.imageMessage;

if (hasImage) {
    console.log('📸 Imagem detectada, verificando se é comprovante...');
    await this.comprovanteHandler.processarImagem(msg, from, sender);
    return;
}


        // ========== LOG FORMATADO ==========
        const date = new Date();
        const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        console.log(`
========= TINA BOT Logs=======
|-> Mensagem: ${messageText}
|-> Usuário: ${senderName}
|-> Número: ${senderNumber}
|-> Sender JID: ${sender}
|-> Grupo: ${isGroup ? "Sim" : "Não"}
|-> Nome do grupo: ${groupName}
|-> Data: ${time}
==============================
`);

// ========== 🆕 ADICIONE ISSO AQUI ==========
    // 🤖 MODO AUTOMÁTICO NO PV (antes de qualquer outro processamento)
  /*  if (!isGroup && messageText && messageText.trim().length > 0) {
//        const donoData = this.dataManager.getDonoData();
        const prefixo = donoData.prefixo || '!';
        
        // Se NÃO começar com prefixo, enviar para Tina automaticamente
        if (!messageText.startsWith(prefixo) && !messageText.startsWith('/')) {
            console.log('🤖 PV AUTO-TINA: Mensagem sem prefixo detectada');
            
            // Modelo padrão para PV (você pode mudar!)
            const defaultPvModel = 'tina-devil'; // ou 'tina-devil', 'tina-tech'
            
            try {
                await this.tinaCommand.chat(from, sender, messageText, defaultPvModel);
                return; // 🛑 Para aqui, não processa mais nada
            } catch (error) {
                console.error('❌ Erro no auto-Tina:', error.message);
                await this.sendMessage(from, '❌ Desculpe, houve um erro ao processar sua mensagem. Tente novamente!');
                return;
            }
        }
        
        console.log('🔧 Comando com prefixo no PV - processando normalmente');
    }
    // ========== FIM DA ADIÇÃO ==========
    

*/
        // ========== SISTEMA DE PAGAMENTO ==========
        await this.handlePaymentSystem(messageText, from, isGroup);

        // ========== COMANDO !RENOVAR ==========
        if (messageText === '!renovar' && isGroup) {
            const donoData = this.dataManager.getDonoData();
            if (senderNumber !== donoData.NumeroDono.replace(/\D/g, '')) {
                return this.sock.sendMessage(from, {
                    text: '⚠️ Apenas o dono da Tina pode renovar assinaturas de grupos.'
                });
            }

            const args = messageText.split(' ').slice(1);
            const days = parseInt(args[0]) || 30;
            const renovado = this.dataManager.renewGroupSubscription(from, days);

            if (renovado) {
                await this.sock.sendMessage(from, {
                    text: `✅ Assinatura renovada por ${days} dias!\nNova data de expiração: ${(new Date(Date.now() + days * 86400000)).toLocaleDateString()}`
                });
            } else {
                await this.sock.sendMessage(from, {
                    text: '❌ Este grupo não possui assinatura ativa. Adicione a Tina novamente para registrar uma nova.'
                });
            }
            return;
        }

        // ========== COMANDO !ADDPAGAMENTO ==========
        if (messageText.toLowerCase().startsWith('!addpagamento')) {
            const args = messageText.split(' ').slice(1);
            await AddPagamento.execute(this.sock, msg, args, this.dataManager);
            return;
        }

        // ========== COMANDO !ADDTABELA ==========
        if (messageText.toLowerCase().startsWith('!addtabela')) {
            const donoData = this.dataManager.getDonoData();
            if (senderNumber !== donoData.NumeroDono.replace(/\D/g, '')) {
                return this.sock.sendMessage(sender, {
                    text: '⚠️ Apenas o dono da Tina pode registrar tabelas.'
                });
            }

            if (!from.endsWith('@g.us')) {
                return this.sock.sendMessage(sender, {
                    text: '❌ Este comando só pode ser usado dentro de um grupo.'
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
                    text: '❌ Use o comando assim:\n!addTabela "cole aqui toda a tabela"\n\nOu envie o comando seguido do texto completo da tabela.'
                });
            }

            this.dataManager.saveTabelaByGroup(from, {
                tabela: tabelaTexto,
                criadoEm: new Date().toISOString()
            });

            await this.sock.sendMessage(from, {
                text: `✅ *Tabela registrada com sucesso!* 🗂️\nAgora qualquer pessoa pode usar o comando *!tabela* para ver a tabela deste grupo.`
            });
            return;
        }

        // ========== COMANDO /GRUPOID ==========
        if (messageText === '/grupoId' && isGroup) {
            await this.sock.sendMessage(from, { text: `📌 ID deste grupo: ${from}` });
            return;
        }

        // ========== ANTI-PALAVRÃO ==========
        if (isGroup && messageText) {
            const dono = this.dataManager.getDonoData();
            const gcfg = dono.groups?.[from] || {};
            if (gcfg.antipalavrao === true && Array.isArray(gcfg.palavroes) && gcfg.palavroes.length > 0) {
                const textoLower = messageText.toLowerCase();
                const hit = gcfg.palavroes.find(p => textoLower.includes(p.toLowerCase()));
                if (hit) {
                    try {
                        await this.sock.sendMessage(from, { delete: msg.key });
                    } catch {}
                    await this.sendMessage(from, `⚠️ @${senderNumber}, palavra proibida detectada.`, { mentions: [sender] });
                    return;
                }
            }
        }

        // ========== ANTILINK ==========
        if (isGroup && messageText) {
            const linkDetected = await this.antilinkCommand.checkForLinks(msg, from, sender);
            if (linkDetected) {
                return;
            }
        }

        // ========== DETECTAR COMPROVANTES ==========
        if (messageText && this.comprovanteHandler.isComprovante(messageText)) {
            await this.comprovanteHandler.processar(messageText, from, sender);
            return;
        }

        // ========== ANTI-PV ==========
        if (!isGroup && messageText) {
            const dono = this.dataManager.getDonoData();
            const antipvAtivo = Object.values(dono.groups || {}).some(g => g.antipv === true);
            if (antipvAtivo) {
                try {
                    await this.sendMessage(from, '🚫 PV desativado. Contate-nos pelos grupos.');
                    await this.sock.updateBlockStatus(from, 'block');
                } catch {}
                return;
            }
        }

        // ========== COMANDOS DO DONO ==========
//        const donoData = this.dataManager.getDonoData();
        const prefixo = donoData.prefixo || '!';
        
        if (messageText.startsWith(prefixo)) {
            const isDono = this.dataManager.isDono(senderNumber);
            
            if (isDono) {
                console.log('🔑 COMANDO DE DONO DETECTADO');
                await this.handleDonoCommand(msg, messageText, from, sender);
                return;
            }
        }

        // ========== COMANDOS PÚBLICOS ==========
        if (messageText) {
            const lowerText = messageText.toLowerCase().trim();
            const parts = messageText.trim().split(/\s+/);
            const lowerCmd = parts[0].toLowerCase();
            const publicArgs = parts.slice(1);

            switch (lowerCmd) {
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
                    await this.tabelaCommand.execute(msg, from, sender);
                    break;

                case 'me':
                case '/me':
                    await this.infoCommand.execute(msg, [], from, sender, false);
                    break;

                case 'info':
                case '/info':
                    await this.infoCommand.execute(msg, publicArgs, from, sender, true);
                    break;

                case 'dono':
                case '/dono': {
                    const dono = this.dataManager.getDonoData();
                    await this.sendMessage(from, `👨‍💼 Dono: ${dono.NickDono}\n📞 Número: +${dono.NumeroDono}`);
                    break;
                }

                case 'infodono':
                case '/infodono': {
                    const dono = this.dataManager.getDonoData();
                    await this.sendMessage(from, `👨‍💼 Nome: ${dono.NickDono}\n📞 Número: +${dono.NumeroDono}`);
                    break;
                }

                case 'infobot':
                case '/infobot': {
                    const dono = this.dataManager.getDonoData();
                    await this.sendMessage(from, `🤖 Bot: ${dono.NomeDoBot || 'Bot'}\n⚙️ Prefixo: ${dono.prefixo || '!'}\n🔗 Repositório: https://github.com/Eliobros/mega-bot`);
                    break;
                }
            }
        }
    }

    async handleDonoCommand(msg, messageText, from, sender) {
        const donoData = this.dataManager.getDonoData();
        const prefixo = donoData.prefixo || '!';
        
        // Remove o prefixo e processa
        const withoutPrefix = messageText.slice(prefixo.length).trim();
        const args = withoutPrefix.split(/\s+/);
        const cmd = args[0].toLowerCase();
        const commandArgs = args.slice(1);
        
        const senderNumber = sender.split('@')[0];
        
        console.log('\n========= COMANDO DE DONO PROCESSADO =========');
        console.log('📱 From:', from);
        console.log('👤 Sender:', sender);
        console.log('🔢 Sender Number:', senderNumber);
        console.log('💬 Mensagem completa:', messageText);
        console.log('⚙️ Comando:', cmd);
        console.log('📝 Args:', commandArgs);
        console.log('============================================\n');

        switch (cmd) {
            case 'addgp':
                if (from.endsWith('@g.us')) {
                    const added = this.dataManager.addAllowedGroup(from);
                    await this.sendMessage(from, added ? '✅ Grupo adicionado à lista de permitidos.' : 'ℹ️ Este grupo já está na lista de permitidos.');
                } else {
                    await this.sendMessage(from, '❌ Use este comando dentro do grupo que deseja permitir.');
                }
                break;

            case 'rmgp':
                if (from.endsWith('@g.us')) {
                    const removed = this.dataManager.removeAllowedGroup(from);
                    await this.sendMessage(from, removed ? '✅ Grupo removido da lista de permitidos.' : 'ℹ️ Este grupo não estava na lista de permitidos.');
                } else {
                    await this.sendMessage(from, '❌ Use este comando dentro do grupo que deseja remover.');
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
                const isDono = this.dataManager.isDono(senderNumber);
                const isAdmin = await this.isGroupAdmin(from, sender);
                
                if (!isDono && !isAdmin) {
                    await this.sendMessage(from, '❌ Apenas administradores podem usar este comando!');
                    return;
                }
                
                const groupJid = msg.key.remoteJid;
                const senderObj = msg.key.participant || sender;

                let senderName = "Desconhecido";
                try {
                    senderName = msg.pushName;
                    
                    if (!senderName || senderName === "Desconhecido") {
                        const metadata = await this.sock.groupMetadata(groupJid);
                        const participant = metadata.participants.find(p => p.id === senderObj);
                        senderName = participant?.notify || participant?.verifiedName;
                    }
                    
                    if (!senderName) {
                        senderName = senderObj.split('@')[0];
                    }
                } catch (err) {
                    console.error("Erro ao pegar senderName:", err);
                    senderName = senderObj.split('@')[0];
                }

                await this.grupoCommand.execute(commandArgs, groupJid, senderObj, senderName);
                break;

            case 'ban':
            case 'b':
            case 'chutar':
                await this.banCommand.execute(msg, commandArgs, from, sender);
                break;

            case 'antilink':
                await this.antilinkCommand.execute(msg, commandArgs, from, sender);
                break;

            case 'info':
            case 'me':
            case 'dados':
                await this.infoCommand.execute(msg, commandArgs, from, sender);
                break;

            case 'setprefix':
                await this.setprefixCommand.execute(msg, commandArgs, from, sender);
                break;

	   case 'tina':
	   case 'ai':
    	        await this.tinaCommand.execute(msg, commandArgs, from, sender);
    		break;

            case 'linkgp':
                await this.linkgpCommand.execute(msg, commandArgs, from, sender);
                break;

            case 'antimention':
                await this.antimentionCommand.execute(msg, commandArgs, from, sender);
                break;

            case 'delete':
            case 'del':
            case 'd':
                console.log('🔴🔴🔴 CASE DELETE ATIVADO 🔴🔴🔴');
                console.log('Parâmetros que serão enviados:');
                console.log('- msg.key:', JSON.stringify(msg.key, null, 2));
                console.log('- commandArgs:', commandArgs);
                console.log('- from (groupJid):', from);
                console.log('- sender (senderJid):', sender);
                console.log('- deleteCommand existe?', !!this.deleteCommand);
                console.log('======================================\n');
                
                await this.deleteCommand.execute(msg, commandArgs, from, sender);
                break;

	    case 'limpar':
	    case 'evacuar':
	    case 'fora':
		await this.limparCommand.execute(msg, sender, from);
		break;

	    case 'semcompras':
	    case 'fantasmas':
	    case 'turistas':
	    case 't':
		await this.semComprasCommand.execute(msg, sender, from)
		break;

	    case 'marcar':
		await this.marcarCommamd.execute(msg, sender, from);
		break;

	    case 'ativar':
	    case 'init':
	    case 'a':
		await this.ativarCommand.execute(msg, commandArgs, from, sender);
                break
            case 'hidetag':
            case 'ht':
                await this.hidetagCommand.execute(msg, commandArgs, from, sender);
                break;

	    
case 'meunumero':
case 'mynumber':
case 'debug':
    const debugInfo = `
🔍 *DEBUG - INFORMAÇÕES DO REMETENTE*

━━━━━━━━━━━━━━━━━━━━━━━
📱 *Sender JID Completo:*
${sender}

🔢 *Número Extraído:*
${senderNumber}

👤 *Push Name:*
${msg.pushName || 'N/A'}

🏪 *Group JID:*
${from}

━━━━━━━━━━━━━━━━━━━━━━━
💡 *Use este número no dono.json:*
\`\`\`
"NumeroDono": "${senderNumber}"
\`\`\`

🤖 *Tina Bot Debug*
    `;
    
    await this.sendMessage(from, debugInfo);
    break;

            case 'promover':
            case 'promote':
                await this.promoteCommand.execute(msg, commandArgs, from, sender);
                break;

            case 'rebaixar':
            case 'demote':
                await this.rebaixarCommand.execute(msg, commandArgs, from, sender);
                break;

            case 'advertir':
            case 'warn':
            case 'adv':
                await this.adminCommands.advertir(msg, commandArgs, from, sender);
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
            case 'mudarname':
            case 'mudarnome':
                await this.nomegpCommand.execute(msg, commandArgs, from, sender);
                break;

            case 'fotogp':
            case 'setfoto':
            case 'mudarfoto':
                await this.fotogpCommand.execute(msg, commandArgs, from, sender);
                break;

            case 'addcoin':
            case 'addsaldo':
                await this.addcoinCommand.execute(msg, commandArgs, from, sender);
                break;

            case 'descgp':
            case 'setdesc':
            case 'mudardesc':
                await this.descgpCommand.execute(msg, commandArgs, from, sender);
                break;

            case 'reiniciar':
            case 'restart':
                await this.adminCommands.reiniciar(msg, commandArgs, from);
                break;

            case 'status-bot':
            case 'statusbot':
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
                await this.sendMessage(from, `❌ Comando não reconhecido. Digite ${prefixo}help para ver os comandos.`);
        }
    }

    // 📌 Sistema de pagamento sem botões
    async handlePaymentSystem(messageText, from, isGroup) {
        if (!isGroup) return false; // Só funciona em grupos

        const text = messageText.toLowerCase();

        // 🔹 Carregar pagamentos do JSON
        const fs = require("fs");
        const path = require("path");
        const filePath = path.join(__dirname, "..", "data", "pagamentos.json");
        let pagamentosData = {};
        if (fs.existsSync(filePath)) {
            pagamentosData = JSON.parse(fs.readFileSync(filePath, "utf8"));
        }

        const pagamentos = pagamentosData[from] || [];

        // Se não houver pagamentos registrados
        if (pagamentos.length === 0) return false;

        // 🔹 Comando principal "pagamento"
        if (text === "pagamento") {
            if (pagamentos.length === 1) {
                const p = pagamentos[0];
                const msgText = `
🏦 *PAGAMENTO DISPONÍVEL* 💳

━━━━━━━━━━━━━━━━━━━━━━━
*👤 ADM:* ${p.nome}
*📞 Número:* ${p.numero}

*💳 FORMAS DE PAGAMENTO:*
🔹 M-PESA: ${p.mpesa || "N/A"}
🔹 E-MOLA: ${p.emola || "N/A"}

━━━━━━━━━━━━━━━━━━━━━━━
📋 *INSTRUÇÕES:*
1️⃣ Faça o pagamento usando os dados acima
2️⃣ Envie o comprovativo neste grupo
3️⃣ Inclua o número que vai receber o pacote

⚠️ Guarde seu comprovativo até a confirmação!
🤖 *Tina Bot* 💎
                `;
                await this.sock.sendMessage(from, { text: msgText });
            } else {
                let menu = `🏦 *FORMAS DE PAGAMENTO DISPONÍVEIS* 💸\n\n━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
                pagamentos.forEach((p, i) => {
                    menu += `📱 *OPÇÃO ${i + 1} - ${p.nome}*\nDigite: pagamento${i + 1}\n\n`;
                });
                menu += `━━━━━━━━━━━━━━━━━━━━━━━\n💡 *Como usar:*\n• Digite pagamento1, pagamento2, etc.\n• Escolha a forma de pagamento\n• Envie o comprovativo no grupo\n\n🤖 Tina Bot 💎`;

                await this.sock.sendMessage(from, { text: menu });
            }
            return true;
        }

        // 🔹 Comandos dinâmicos pagamento1, pagamento2, etc.
        const match = text.match(/^pagamento(\d+)$/);
        if (match) {
            const index = parseInt(match[1], 10) - 1;
            const p = pagamentos[index];
            if (!p) {
                await this.sock.sendMessage(from, { text: "⚠️ Esta opção não existe neste grupo." });
                return true;
            }

            const msgText = `
🏦 *PAGAMENTO OPÇÃO ${index + 1}* 💳

━━━━━━━━━━━━━━━━━━━━━━━
*👤 ADM:* ${p.nome}
*📞 Número:* ${p.numero}

*💳 FORMAS DE PAGAMENTO:*
🔹 M-PESA: ${p.mpesa || "N/A"}
🔹 E-MOLA: ${p.emola || "N/A"}

━━━━━━━━━━━━━━━━━━━━━━━
📋 *INSTRUÇÕES:*
1️⃣ Faça o pagamento usando os dados acima
2️⃣ Envie o comprovativo neste grupo
3️⃣ Inclua o número que vai receber o pacote

⚠️ Guarde seu comprovativo até a confirmação!
🤖 *Tina Bot* 💎
            `;
            await this.sock.sendMessage(from, { text: msgText });
            return true;
        }

        return false; // Não foi comando de pagamento
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
