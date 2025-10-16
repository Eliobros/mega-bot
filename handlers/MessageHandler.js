const TabelaHandler = require('./TabelaHandler');
const ComprovanteHandler = require('./ComprovanteHandler');
const CompraHandler = require('./CompraHandler');


// Comandos de membros
const MenuCommand = require('../commands/membros/menu');
const TabelaCommand = require('../commands/membros/tabela');
const PingCommand = require('../commands/membros/ping');
const HelpCommand = require('../commands/membros/help');
const PlayCommand = require('../commands/membros/play')

//comandos para dono
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
        const from = msg.key.remoteJid;
        const messageText = this.getMessageText(msg);
	const senderName = msg.pushName || "Usuário";
        const isGroup = from.endsWith('@g.us');
	const text = messageText.trim();          // remove espaços extras
	const args = text.split(/ +/);            // divide por espaço
        const command = args.shift().replace(/^!/, '').toLowerCase(); // remove o '!' e deixa minúscula
        // 📌 Pega o número do remetente
        let sender = isGroup ? msg.key.participant : from;
        if (!sender) sender = from; // fallback se participant for null

        const senderNumber = sender
            .replace(/(@s\.whatsapp\.net|@lid|@c\.us)/g, '')
            .split('@')[0];

     
// Atualiza lista de grupos permitidos do DataManager
const allowedGroups = this.dataManager.getAllowedGroups();

// Verifica se o grupo não está na lista
if (isGroup && !allowedGroups.includes(from)) {
    console.log(`⚠️ Mensagem ignorada de grupo não permitido: ${from}`);
    return;
}
        // 📌 Atualizar/armazenar pushName para ranking e exibição
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
            // apenas log, não bloquear o fluxo
            console.log('Aviso: não foi possível atualizar pushName do usuário.');
        }

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

if (messageText === '!renovar' && isGroup) {
    const groupId = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const senderNumber = sender.split('@')[0]; // número puro sem @s.whatsapp.net
    const donoData = this.dataManager.getDonoData();

    if (!msg.key.remoteJid.endsWith('@g.us')) {
        return this.sock.sendMessage(sender, { text: '❌ Este comando só pode ser usado em grupos.' });
    }

    // 🔐 Verifica se o usuário é o dono
    if (senderNumber !== donoData.NumeroDono.replace(/\D/g, '')) {
        return this.sock.sendMessage(groupId, {
            text: '⚠️ Apenas o dono da Tina pode renovar assinaturas de grupos.'
        });
    }

    const days = parseInt(args[0]) || 30;
    const renovado = this.dataManager.renewGroupSubscription(groupId, days);

    if (renovado) {
        await this.sock.sendMessage(groupId, {
            text: `✅ Assinatura renovada por ${days} dias!\nNova data de expiração: ${(new Date(Date.now() + days * 86400000)).toLocaleDateString()}`
        });
    } else {
        await this.sock.sendMessage(groupId, {
            text: '❌ Este grupo não possui assinatura ativa. Adicione a Tina novamente para registrar uma nova.'
        });
    }
}

// dentro do handle(msg)
if (messageText.toLowerCase().startsWith('!addpagamento')) {
    const args = messageText.split(' ').slice(1); // pega os argumentos
    await AddPagamento.execute(this.sock, msg, args, this.dataManager);
    return; // evita continuar processando
}


if (command  === 'addtabela') {
    const sender = msg.key.participant || msg.key.remoteJid;
    const senderNumber = sender.split('@')[0];
    const donoData = this.dataManager.getDonoData();

    // 🔒 Apenas dono pode usar
    if (senderNumber !== donoData.NumeroDono.replace(/\D/g, '')) {
        return this.sock.sendMessage(sender, {
            text: '⚠️ Apenas o dono da Tina pode registrar tabelas.'
        });
    }

    const chatId = msg.key.remoteJid;

    // Só em grupos
    if (!chatId.endsWith('@g.us')) {
        return this.sock.sendMessage(sender, {
            text: '❌ Este comando só pode ser usado dentro de um grupo.'
        });
    }

    // Captura o texto completo da tabela
    let tabelaTexto = args.join(' ').trim();

    // Remove aspas caso o usuário use
    if (tabelaTexto.startsWith('"') && tabelaTexto.endsWith('"')) {
        tabelaTexto = tabelaTexto.slice(1, -1);
    }

    // Caso o texto venha em extendedTextMessage (mensagem longa)
    if (!tabelaTexto && msg.message.conversation) {
        tabelaTexto = msg.message.conversation;
    } else if (!tabelaTexto && msg.message.extendedTextMessage?.text) {
        tabelaTexto = msg.message.extendedTextMessage.text;
    }

    // Verifica se o texto existe
    if (!tabelaTexto) {
        return this.sock.sendMessage(sender, {
            text: '❌ Use o comando assim:\n!addTabela "cole aqui toda a tabela"\n\nOu envie o comando seguido do texto completo da tabela.'
        });
    }

    // Salva no banco (DataManager)
    this.dataManager.saveTabelaByGroup(chatId, {
        tabela: tabelaTexto,
        criadoEm: new Date().toISOString()
    });

    await this.sock.sendMessage(chatId, {
        text: `✅ *Tabela registrada com sucesso!* 🗂️\nAgora qualquer pessoa pode usar o comando *!tabela* para ver a tabela deste grupo.`
    });
}

        // 📌 Comando /grupoId
        if (messageText === '/grupoId' && isGroup) {
            await this.sock.sendMessage(from, { text: `📌 ID deste grupo: ${from}` });
            return;
        }

        // 📌 Verificar anti-palavrão
        if (isGroup && messageText) {
            const dono = this.dataManager.getDonoData();
            const gcfg = dono.groups?.[from] || {};
            if (gcfg.antipalavrao === true && Array.isArray(gcfg.palavroes) && gcfg.palavroes.length > 0) {
                const textoLower = messageText.toLowerCase();
                const hit = gcfg.palavroes.find(p => textoLower.includes(p.toLowerCase()));
                if (hit) {
                    // tentar apagar a mensagem
                    try {
                        await this.sock.sendMessage(from, { delete: msg.key });
                    } catch {}
                    await this.sendMessage(from, `⚠️ @${senderNumber}, palavra proibida detectada.`, { mentions: [sender] });
                    return;
                }
            }
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

        // 📌 Anti-PV: bloquear se ativado em algum grupo
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

        // 📌 Comandos do dono (prefixo !)
        const donoData = this.dataManager.getDonoData();
        if (this.dataManager.isDono(senderNumber) && messageText.startsWith(donoData.prefixo)) {
            await this.handleDonoCommand(msg, messageText, from, sender);
            return;
        }

        // 📌 Comandos públicos
        if (messageText) {
            const rawText = messageText.trim();
            const lowerText = rawText.toLowerCase();
            const parts = rawText.split(/\s+/);
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
    
    async handleDonoCommand(msg, messageText, from, sender) {
        const donoData = this.dataManager.getDonoData();
        const comando = messageText.replace(donoData.prefixo, '').trim();
        const args = comando.split(' ');
        const cmd = args[0].toLowerCase();
	const senderNumber = sender.split('@')[0]; // Extrai só o número        
        // 🔧 CORREÇÃO: Remover o comando dos args para passar apenas os parâmetros
        const commandArgs = args.slice(1); // Remove o primeiro elemento (comando)
        
        console.log(`🔍 DEBUG COMANDO:
        - Comando completo: "${comando}"
        - Comando (cmd): "${cmd}"
        - Args originais: ${JSON.stringify(args)}
        - Args para comando: ${JSON.stringify(commandArgs)}`);

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
        // ✅ TENTA PEGAR O NOME EM VÁRIAS FONTES
        // 1. pushName (nome que a pessoa usa)
        senderName = msg.pushName;
        
        // 2. Se não tiver, busca no metadata do grupo
        if (!senderName || senderName === "Desconhecido") {
            const metadata = await this.sock.groupMetadata(groupJid);
            const participant = metadata.participants.find(p => p.id === senderObj);
            senderName = participant?.notify || participant?.verifiedName;
        }
        
        // 3. Se ainda não tiver, pega só o número sem @s.whatsapp.net
        if (!senderName) {
            senderName = senderObj.split('@')[0];
        }
    } catch (err) {
        console.error("Erro ao pegar senderName:", err);
        // Fallback: só o número
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

            case 'linkgp':
                await this.linkgpCommand.execute(msg, commandArgs, from, sender);
                break;

            case 'antimention':
                await this.antimentionCommand.execute(msg, commandArgs, from, sender);
                break;

            case 'delete':
            case 'del':
	    case 'd':
                await this.deleteCommand.execute(msg, commandArgs, from, sender);
                break;
            
            case 'hidetag':
            case 'ht':
                await this.hidetagCommand.execute(msg, commandArgs, from, sender);
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
		await this.playCommand.execute(msg, commandArgs, from, sender)
		break

            case 'admins':
                await this.adminCommands.admins(msg, commandArgs, from, sender);
                break

	    case 'clientes':
	    case 'rankmb':
		await this.clientesCommand.execute(msg, commandArgs, from, sender);
		break

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
		await this.addcoinCommand.execute(msg, commandArgs, from, sender)
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
