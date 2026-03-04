const fs = require('fs');
const path = require('path');

class AntiLinkCommand {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;
        this.donoFile = path.join(__dirname, '../../database/dono.json');
    }

    getConfig() {
        try {
            return JSON.parse(fs.readFileSync(this.donoFile));
        } catch (error) {
            // Se o arquivo não existir, criar estrutura básica
            return { groups: {}, Prefixo: '!', NumeroDono: '' };
        }
    }

    saveConfig(config) {
        fs.writeFileSync(this.donoFile, JSON.stringify(config, null, 2));
    }

    // Pegar prefixo do dono.json
    getPrefix() {
        const config = this.getConfig();
        return config.Prefixo || '!';
    }

    // Verificar se antilink está ativo para um grupo específico
    isAntilinkActive(groupJid) {
        const config = this.getConfig();
        return config.groups && config.groups[groupJid] && config.groups[groupJid].antilink === true;
    }

    // Ativar antilink para um grupo específico
    enableAntilink(groupJid, groupName) {
        let config = this.getConfig();
        
        // Inicializar estrutura se não existir
        if (!config.groups) {
            config.groups = {};
        }
        
        if (!config.groups[groupJid]) {
            config.groups[groupJid] = {};
        }
        
        config.groups[groupJid].antilink = true;
        config.groups[groupJid].groupName = groupName;
        config.groups[groupJid].enabledAt = new Date().toISOString();
        
        this.saveConfig(config);
    }

    // Desativar antilink para um grupo específico
    disableAntilink(groupJid) {
        let config = this.getConfig();
        
        if (config.groups && config.groups[groupJid]) {
            config.groups[groupJid].antilink = false;
            config.groups[groupJid].disabledAt = new Date().toISOString();
        }
        
        this.saveConfig(config);
    }

    // Método centralizado para obter dados do dono
getDonoInfo() {
    const donoData = this.dataManager.getDonoData();

    // sempre retorna no formato "numero@s.whatsapp.net"
    const donoJid = donoData.NumeroDono + '@s.whatsapp.net';

    return {
        jid: donoJid,
        number: donoData.NumeroDono
    };
}

// Função auxiliar para normalizar qualquer jid
normalizeJid(jid) {
    if (!jid) return '';
    const num = jid.split('@')[0];
    return num + '@s.whatsapp.net';
}

    // Verificar permissões do usuário
    async checkUserPermissions(groupJid, senderJid) {
        const dono = this.getDonoInfo();
        const isDono = senderJid === dono.jid;
        
        try {
            const groupMetadata = await this.sock.groupMetadata(groupJid);
            const participant = groupMetadata.participants.find(p => p.id === senderJid);
            const isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
            
            return {
                isDono,
                isAdmin,
                groupMetadata,
                participant
            };
        } catch (error) {
            console.error("Erro ao verificar permissões:", error);
            return { isDono, isAdmin: false, groupMetadata: null, participant: null };
        }
    }

    // Enviar log para o dono
    async sendLogToDono(message) {
        const dono = this.getDonoInfo();
        await this.sendMessage(dono.jid, message);
    }

    async execute(msg, args, groupJid, senderJid) {
        console.log(`🔍 DEBUG ANTILINK:
        - GroupJid: ${groupJid}
        - SenderJid: ${senderJid}
        - Args: ${JSON.stringify(args)}
        - Args[0]: ${args[0]}
        - Args length: ${args.length}`);

        const prefix = this.getPrefix();

        if (!groupJid.endsWith('@g.us')) {
            await this.sendMessage(groupJid, '❌ Este comando só funciona em grupos!');
            return;
        }

        // Verificar permissões
        const permissions = await this.checkUserPermissions(groupJid, senderJid);
        
        console.log(`🔍 DEBUG PERMISSÕES:
        - isDono: ${permissions.isDono}
        - isAdmin: ${permissions.isAdmin}
        - groupMetadata existe: ${permissions.groupMetadata ? 'Sim' : 'Não'}`);
        
        if (!permissions.groupMetadata) {
            await this.sendMessage(groupJid, '❌ Erro ao acessar informações do grupo!');
            return;
        }

        if (!permissions.isAdmin && !permissions.isDono) {
            await this.sendMessage(groupJid, '❌ Apenas admins podem usar este comando!');
            return;
        }

        const groupName = permissions.groupMetadata.subject;

        console.log(`🔍 DEBUG ARGS[0]: "${args[0]}"`);

        // Ativar antilink para este grupo
        if (args[0] === "1" || args[0] === "on" || args[0] === "ativar") {
            console.log("✅ Executando ATIVAR antilink...");
            
            this.enableAntilink(groupJid, groupName);
            await this.sendMessage(groupJid, `🚫 *Antilink ativado!*\n📍 Grupo: ${groupName}\n🛡️ Links serão detectados e usuários removidos`);
            
            // Log para o dono (se não for o próprio dono executando)
            if (!permissions.isDono) {
                const userNumber = senderJid.replace('@s.whatsapp.net', '');
                await this.sendLogToDono(`✅ *Antilink ativado*\n📍 Grupo: ${groupName}\n👤 Ativado por: @${userNumber}\n🆔 ID: ${groupJid}`);
            }
            return;
        }

        // Desativar antilink para este grupo
        if (args[0] === "0" || args[0] === "off" || args[0] === "desativar") {
            console.log("✅ Executando DESATIVAR antilink...");
            
            this.disableAntilink(groupJid);
            await this.sendMessage(groupJid, `✅ *Antilink desativado!*\n📍 Grupo: ${groupName}\n🔓 Links não serão mais detectados`);
            
            // Log para o dono (se não for o próprio dono executando)
            if (!permissions.isDono) {
                const userNumber = senderJid.replace('@s.whatsapp.net', '');
                await this.sendLogToDono(`❌ *Antilink desativado*\n📍 Grupo: ${groupName}\n👤 Desativado por: @${userNumber}\n🆔 ID: ${groupJid}`);
            }
            return;
        }

        // Verificar status do antilink neste grupo
        if (args[0] === "status" || args[0] === "info") {
            console.log("✅ Executando STATUS antilink...");
            
            const isActive = this.isAntilinkActive(groupJid);
            const config = this.getConfig();
            const groupConfig = config.groups ? config.groups[groupJid] : null;
            
            let statusMsg = `📊 *Status do Antilink*\n\n`;
            statusMsg += `📍 *Grupo:* ${groupName}\n`;
            statusMsg += `🔥 *Status:* ${isActive ? '🟢 Ativo' : '🔴 Inativo'}\n`;
            
            if (groupConfig && groupConfig.enabledAt) {
                statusMsg += `📅 *Ativado em:* ${new Date(groupConfig.enabledAt).toLocaleString('pt-BR')}\n`;
            }
            
            if (groupConfig && groupConfig.disabledAt && !isActive) {
                statusMsg += `📅 *Desativado em:* ${new Date(groupConfig.disabledAt).toLocaleString('pt-BR')}\n`;
            }
            
            statusMsg += `🆔 *ID do Grupo:* ${groupJid}`;
            
            await this.sendMessage(groupJid, statusMsg);
            return;
        }

        // Listar todos os grupos com antilink ativo (só para o dono)
        if ((args[0] === "list" || args[0] === "lista") && permissions.isDono) {
            console.log("✅ Executando LIST antilink...");
            
            const config = this.getConfig();
            let listMsg = `📋 *Grupos com Antilink*\n\n`;
            
            if (!config.groups || Object.keys(config.groups).length === 0) {
                listMsg += "❌ Nenhum grupo com antilink configurado.";
            } else {
                let activeCount = 0;
                let inactiveCount = 0;
                
                for (const [groupId, groupConfig] of Object.entries(config.groups)) {
                    if (groupConfig.antilink) {
                        activeCount++;
                        listMsg += `${activeCount}. *${groupConfig.groupName || 'Nome não disponível'}*\n`;
                        listMsg += `   🟢 Status: Ativo\n`;
                        listMsg += `   📅 Desde: ${new Date(groupConfig.enabledAt).toLocaleDateString('pt-BR')}\n`;
                        listMsg += `   🆔 \`${groupId}\`\n\n`;
                    } else {
                        inactiveCount++;
                    }
                }
                
                if (activeCount === 0) {
                    listMsg += "❌ Nenhum grupo com antilink ativo.";
                } else {
                    listMsg += `\n📈 *Resumo:*\n`;
                    listMsg += `🟢 Ativos: ${activeCount}\n`;
                    listMsg += `🔴 Inativos: ${inactiveCount}`;
                }
            }
            
            await this.sendMessage(senderJid, listMsg);
            return;
        }

        // Se chegou aqui sem argumentos válidos, mostrar ajuda
        console.log("❌ Nenhuma condição atendida, mostrando ajuda...");
        console.log(`Args recebidos: ${JSON.stringify(args)}`);
        console.log(`Primeiro arg: "${args[0]}"`);
        
        let helpMsg = `🚫 *Comando Antilink*\n\n`;
        helpMsg += `📝 *Como usar:*\n`;
        helpMsg += `• \`${prefix}antilink 1\` ou \`${prefix}antilink on\` - Ativar\n`;
        helpMsg += `• \`${prefix}antilink 0\` ou \`${prefix}antilink off\` - Desativar\n`;
        helpMsg += `• \`${prefix}antilink status\` - Ver status atual\n`;
        
        if (permissions.isDono) {
            helpMsg += `• \`${prefix}antilink list\` - Listar todos os grupos (só dono)\n`;
        }
        
        helpMsg += `\n⚠️ *Nota:* Apenas admins podem usar este comando`;
        helpMsg += `\n\n🔍 *Debug Info:* Args recebidos: [${args.join(', ')}]`;
        
        await this.sendMessage(groupJid, helpMsg);
    }

    // Método para verificar links (chamado externamente)
    async checkForLinks(msg, groupJid, senderJid) {
        // Só processa se o antilink estiver ativo para este grupo
        if (!this.isAntilinkActive(groupJid)) {
            return false;
        }

        const dono = this.getDonoInfo();

        // Regex melhorada para detectar mais tipos de links
        const linkRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[^\s]+\.(com|org|net|io|br|pt|gov|edu|mil|int|co|me|tv|app|tech|dev|site|online|store|shop|blog)[^\s]*|whatsapp\.com\/|wa\.me\/|t\.me\/|chat\.whatsapp\.com|discord\.gg\/|youtube\.com|youtu\.be|instagram\.com|facebook\.com|twitter\.com|x\.com|tiktok\.com|telegram\.me)/gi;
        
        const body = msg.message?.conversation || 
                    msg.message?.extendedTextMessage?.text ||
                    msg.message?.imageMessage?.caption ||
                    msg.message?.videoMessage?.caption;

        if (body && linkRegex.test(body)) {
            try {
                // Obter informações do grupo
                const groupMetadata = await this.sock.groupMetadata(groupJid);
                const participant = groupMetadata.participants.find(p => p.id === senderJid);
                const isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';

                // Se for admin, apenas avisar no log
                if (isAdmin) {
                    console.log(`⚠️ Admin ${senderJid} enviou link no grupo ${groupMetadata.subject} — ignorado pelo antilink`);
                    return false;
                }

                // Se for o dono, ignorar
                if (senderJid === dono.jid) {
                    console.log(`👑 Dono enviou link — ignorado pelo antilink`);
                    return false;
                }

                // Apagar mensagem
                await this.sock.sendMessage(groupJid, {
                    delete: {
                        remoteJid: groupJid,
                        id: msg.key.id,
                        participant: msg.key.participant || senderJid
                    }
                });

                // Pequena pausa para garantir que a mensagem foi deletada
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Remover usuário
                await this.sock.groupParticipantsUpdate(groupJid, [senderJid], 'remove');

                // Aviso no grupo
                const userNum = senderJid.replace('@s.whatsapp.net', '');
                let aviso = `🚫 *Link Detectado & Removido*\n\n`;
                aviso += `👤 Usuário: @${userNum}\n`;
                aviso += `⚖️ *Motivo:* Postou link no grupo\n`;
                aviso += `🛡️ *Antilink:* Ativo neste grupo\n`;
                aviso += `📱 *Ação:* Usuário removido automaticamente`;
                
                await this.sendMessage(groupJid, aviso, { mentions: [senderJid] });

                // Log detalhado para o dono
                let log = `🚨 *ANTILINK EXECUTADO*\n\n`;
                log += `🏪 *Grupo:* ${groupMetadata.subject}\n`;
                log += `👤 *Usuário removido:* +${userNum}\n`;
                log += `💬 *Link detectado:* ${body.substring(0, 150)}${body.length > 150 ? '...' : ''}\n`;
                log += `📅 *Data/Hora:* ${new Date().toLocaleString('pt-BR')}\n`;
                log += `🔗 *Tipo:* ${body.match(linkRegex)?.[0] || 'Link não identificado'}\n`;
                log += `🆔 *ID do Grupo:* ${groupJid}\n`;
                log += `👥 *Membros restantes:* ${groupMetadata.participants.length - 1}`;
                
                await this.sendLogToDono(log);

                console.log(`🚫 Antilink executado: ${userNum} removido do grupo ${groupMetadata.subject}`);
                return true;
                
            } catch (e) {
                console.error("❌ Erro no AntiLink:", e);
                
                // Tentar avisar no grupo sobre o erro
                try {
                    await this.sendMessage(groupJid, '⚠️ Erro ao executar antilink. Verifique as permissões do bot.');
                } catch (err) {
                    console.error("Erro ao enviar mensagem de erro:", err);
                }
                
                return false;
            }
        }

        return false;
    }

    async sendMessage(jid, text, options = {}) {
        try {
            await this.sock.sendMessage(jid, { text, ...options });
        } catch (err) {
            console.error("❌ Erro ao enviar mensagem:", err);
        }
    }
}

module.exports = AntiLinkCommand;
