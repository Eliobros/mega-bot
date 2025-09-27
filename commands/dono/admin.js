const fs = require('fs');
const path = require('path');
const { jidNormalizedUser } = require('@whiskeysockets/baileys');


class AdminCommands {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;
        this.donoFile = path.join(__dirname, '../../database/dono.json');
        this.advertenciasFile = path.join(__dirname, '../../database/advertencias.json');
    }

    getConfig() {
        try {
            return JSON.parse(fs.readFileSync(this.donoFile));
        } catch (error) {
            return { Prefixo: '!', NumeroDono: '' };
        }
    }

    saveConfig(data) {
        try {
            fs.writeFileSync(this.donoFile, JSON.stringify(data, null, 2));
            return true;
        } catch (err) {
            console.error('Erro ao salvar dono.json:', err);
            return false;
        }
    }

    getAdvertencias() {
        try {
            return JSON.parse(fs.readFileSync(this.advertenciasFile));
        } catch (error) {
            return {};
        }
    }

    saveAdvertencias(data) {
        try {
            fs.writeFileSync(this.advertenciasFile, JSON.stringify(data, null, 2));
            return true;
        } catch (error) {
            console.error("Erro ao salvar advertências:", error);
            return false;
        }
    }

    getPrefix() {
        const config = this.getConfig();
        return config.Prefixo || '!';
    }

    // COMANDO REBAIXAR
    async rebaixar(msg, args, groupJid, senderJid) {
        const config = this.getConfig();
        const donoJid = config.NumeroDono + '@s.whatsapp.net';

        if (!groupJid.endsWith('@g.us')) {
            await this.sendMessage(groupJid, '❌ Este comando só funciona em grupos!');
            return;
        }

        try {
            const groupMetadata = await this.sock.groupMetadata(groupJid);
            const participant = groupMetadata.participants.find(p => p.id === senderJid);
            const isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
            const isDono = senderJid === donoJid;

            if (!isAdmin && !isDono) {
                await this.sendMessage(groupJid, '❌ Apenas admins podem usar este comando!');
                return;
            }

            const botJid = this.sock.user.id.replace(/:\d+/, '') + '@s.whatsapp.net';
            const botParticipant = groupMetadata.participants.find(p => p.id === botJid);
            const botIsAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';

            if (!botIsAdmin) {
                await this.sendMessage(groupJid, '❌ O bot precisa ser administrador para rebaixar membros!');
                return;
            }

            const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
            
            let targetJid = null;

            if (mentionedJids.length > 0) {
                targetJid = mentionedJids[0];
            } else if (quotedParticipant) {
                targetJid = quotedParticipant;
            } else {
                await this.sendMessage(groupJid, '❌ Mencione alguém ou responda uma mensagem para rebaixar!');
                return;
            }

            // Verificar se o usuário é admin
            const targetParticipant = groupMetadata.participants.find(p => p.id === targetJid);
            if (!targetParticipant?.admin) {
                const targetNum = targetJid.replace('@s.whatsapp.net', '');
                await this.sendMessage(groupJid, `⚠️ @${targetNum} não é administrador!`, { mentions: [targetJid] });
                return;
            }

            // Rebaixar usuário
            await this.sock.groupParticipantsUpdate(groupJid, [targetJid], 'demote');

            const targetNum = targetJid.replace('@s.whatsapp.net', '');
            const demoterNum = senderJid.replace('@s.whatsapp.net', '');

            let successMsg = `📉 *USUÁRIO REBAIXADO!*\n\n`;
            successMsg += `❌ @${targetNum} não é mais administrador\n`;
            successMsg += `👤 Rebaixado por: @${demoterNum}\n`;
            successMsg += `📅 Data: ${new Date().toLocaleString('pt-BR')}`;

            await this.sendMessage(groupJid, successMsg, { mentions: [targetJid, senderJid] });

            // Log para o dono
            if (!isDono) {
                await this.sendMessage(donoJid, `📉 REBAIXAMENTO\nGrupo: ${groupMetadata.subject}\nRebaixado: +${targetNum}\nPor: +${promoterNum}`);
            }

        } catch (error) {
            console.error("Erro ao rebaixar:", error);
            await this.sendMessage(groupJid, '❌ Erro ao rebaixar usuário!');
        }
    }

    // COMANDO MSGBV (Mensagem de Boas-vindas)
    async msgbv(msg, args, groupJid, senderJid) {
        const config = this.getConfig();
        const donoJid = config.NumeroDono + '@s.whatsapp.net';

        if (!groupJid.endsWith('@g.us')) {
            await this.sendMessage(groupJid, '❌ Este comando só funciona em grupos!');
            return;
        }

        try {
            const groupMetadata = await this.sock.groupMetadata(groupJid);
            const participant = groupMetadata.participants.find(p => p.id === senderJid);
            const isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
            const isDono = senderJid === donoJid;

            if (!isAdmin && !isDono) {
                await this.sendMessage(groupJid, '❌ Apenas admins podem configurar mensagem de boas-vindas!');
                return;
            }

            if (!args.length) {
                const prefix = this.getPrefix();
                let helpMsg = `👋 *Mensagem de Boas-vindas*\n\n`;
                helpMsg += `📝 *Como usar:*\n`;
                helpMsg += `• \`${prefix}msgbv sua mensagem aqui\`\n\n`;
                helpMsg += `🏷️ *Variáveis disponíveis:*\n`;
                helpMsg += `• \`@user\` - Menciona o novo membro\n`;
                helpMsg += `• \`{nome}\` - Nome do novo membro\n`;
                helpMsg += `• \`{grupo}\` - Nome do grupo\n`;
                helpMsg += `• \`{membros}\` - Total de membros\n\n`;
                helpMsg += `💡 *Exemplo:*\n`;
                helpMsg += `\`${prefix}msgbv Bem-vindo @user ao grupo {grupo}! 🎉\``;

                await this.sendMessage(groupJid, helpMsg);
                return;
            }

            const mensagem = args.join(' ');

            // Salvar mensagem no config
            let configFile = this.getConfig();
            if (!configFile.groups) configFile.groups = {};
            if (!configFile.groups[groupJid]) configFile.groups[groupJid] = {};
            
            configFile.groups[groupJid].msgbv = mensagem;
            configFile.groups[groupJid].msgbv_ativa = true;
            configFile.groups[groupJid].groupName = groupMetadata.subject;

            fs.writeFileSync(this.donoFile, JSON.stringify(configFile, null, 2));

            let successMsg = `✅ *Mensagem de boas-vindas configurada!*\n\n`;
            successMsg += `📝 *Mensagem salva:*\n${mensagem}\n\n`;
            successMsg += `🎯 *Preview:* Quando alguém entrar, verá essa mensagem personalizada`;

            await this.sendMessage(groupJid, successMsg);

        } catch (error) {
            console.error("Erro ao configurar msgbv:", error);
            await this.sendMessage(groupJid, '❌ Erro ao configurar mensagem de boas-vindas!');
        }
    }

    // COMANDO ADVERTIR
    async advertir(msg, args, groupJid, senderJid) {
        const config = this.getConfig();
        const donoJid = config.NumeroDono + '@s.whatsapp.net';

        if (!groupJid.endsWith('@g.us')) {
            await this.sendMessage(groupJid, '❌ Este comando só funciona em grupos!');
            return;
        }

        try {
            const groupMetadata = await this.sock.groupMetadata(groupJid);
            const participant = groupMetadata.participants.find(p => p.id === senderJid);
            const isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
            const isDono = senderJid === donoJid;

            if (!isAdmin && !isDono) {
                await this.sendMessage(groupJid, '❌ Apenas admins podem advertir usuários!');
                return;
            }

            const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
            
            let targetJid = null;

            if (mentionedJids.length > 0) {
                targetJid = mentionedJids[0];
            } else if (quotedParticipant) {
                targetJid = quotedParticipant;
            } else {
                await this.sendMessage(groupJid, '❌ Mencione alguém ou responda uma mensagem para advertir!');
                return;
            }

            // Verificar se não está tentando advertir admin
            const targetParticipant = groupMetadata.participants.find(p => p.id === targetJid);
            if (targetParticipant?.admin) {
                await this.sendMessage(groupJid, '❌ Não é possível advertir administradores!');
                return;
            }

            const motivo = args.join(' ') || 'Comportamento inadequado';
            const targetNum = targetJid.replace('@s.whatsapp.net', '');
            const adminNum = senderJid.replace('@s.whatsapp.net', '');

            // Carregar advertências
            let advertencias = this.getAdvertencias();
            const userKey = `${groupJid}_${targetJid}`;

            if (!advertencias[userKey]) {
                advertencias[userKey] = {
                    count: 0,
                    warnings: [],
                    userNum: targetNum,
                    groupName: groupMetadata.subject
                };
            }

            advertencias[userKey].count++;
            advertencias[userKey].warnings.push({
                motivo,
                admin: adminNum,
                data: new Date().toISOString()
            });

            const totalWarnings = advertencias[userKey].count;

            // Salvar advertências
            this.saveAdvertencias(advertencias);

            if (totalWarnings >= 3) {
                // 3 advertências = BAN
                try {
                    await this.sock.groupParticipantsUpdate(groupJid, [targetJid], 'remove');

                    let banMsg = `🚨 *USUÁRIO BANIDO AUTOMATICAMENTE!*\n\n`;
                    banMsg += `👤 Usuário: @${targetNum}\n`;
                    banMsg += `⚠️ Advertências: ${totalWarnings}/3\n`;
                    banMsg += `📋 Último motivo: ${motivo}\n`;
                    banMsg += `👮 Admin responsável: @${adminNum}\n`;
                    banMsg += `🔨 Ação: Removido do grupo\n`;
                    banMsg += `📅 Data: ${new Date().toLocaleString('pt-BR')}`;

                    await this.sendMessage(groupJid, banMsg, { mentions: [targetJid, senderJid] });

                    // Reset advertências após ban
                    delete advertencias[userKey];
                    this.saveAdvertencias(advertencias);

                } catch (error) {
                    await this.sendMessage(groupJid, '❌ Erro ao banir usuário! Verifique se o bot é administrador.');
                }
            } else {
                // Apenas advertência
                let warnMsg = `⚠️ *ADVERTÊNCIA ${totalWarnings}/3*\n\n`;
                warnMsg += `👤 Usuário: @${targetNum}\n`;
                warnMsg += `📋 Motivo: ${motivo}\n`;
                warnMsg += `👮 Admin: @${adminNum}\n`;
                warnMsg += `🚨 Faltam ${3 - totalWarnings} advertência(s) para o ban\n`;
                warnMsg += `📅 Data: ${new Date().toLocaleString('pt-BR')}\n\n`;
                warnMsg += `💡 *Dica:* Melhore seu comportamento!`;

                await this.sendMessage(groupJid, warnMsg, { mentions: [targetJid, senderJid] });
            }

            // Log para o dono
            if (!isDono) {
                await this.sendMessage(donoJid, `⚠️ ADVERTÊNCIA ${totalWarnings}/3\nGrupo: ${groupMetadata.subject}\nUsuário: +${targetNum}\nMotivo: ${motivo}\nAdmin: +${adminNum}`);
            }

        } catch (error) {
            console.error("Erro ao advertir:", error);
            await this.sendMessage(groupJid, '❌ Erro ao advertir usuário!');
        }
    }

    // COMANDO MSGSAIU (Mensagem de saída)
    async msgsaiu(msg, args, groupJid, senderJid) {
        const config = this.getConfig();
        const donoJid = config.NumeroDono + '@s.whatsapp.net';

        if (!groupJid.endsWith('@g.us')) {
            await this.sendMessage(groupJid, '❌ Este comando só funciona em grupos!');
            return;
        }

        try {
            const groupMetadata = await this.sock.groupMetadata(groupJid);
            const participant = groupMetadata.participants.find(p => p.id === senderJid);
            const isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
            const isDono = senderJid === donoJid;

            if (!isAdmin && !isDono) {
                await this.sendMessage(groupJid, '❌ Apenas admins podem configurar mensagem de saída!');
                return;
            }

            if (!args.length) {
                const prefix = this.getPrefix();
                let helpMsg = `👋 *Mensagem de Saída*\n\n`;
                helpMsg += `📝 *Como usar:*\n`;
                helpMsg += `• \`${prefix}msgsaiu sua mensagem aqui\`\n\n`;
                helpMsg += `🏷️ *Variáveis disponíveis:*\n`;
                helpMsg += `• \`{nome}\` - Nome de quem saiu\n`;
                helpMsg += `• \`{grupo}\` - Nome do grupo\n`;
                helpMsg += `• \`{membros}\` - Total de membros restantes\n\n`;
                helpMsg += `💡 *Exemplo:*\n`;
                helpMsg += `\`${prefix}msgsaiu {nome} saiu do grupo {grupo} 😢\``;

                await this.sendMessage(groupJid, helpMsg);
                return;
            }

            const mensagem = args.join(' ');

            // Salvar mensagem no config
            let configFile = this.getConfig();
            if (!configFile.groups) configFile.groups = {};
            if (!configFile.groups[groupJid]) configFile.groups[groupJid] = {};
            
            configFile.groups[groupJid].msgsaiu = mensagem;
            configFile.groups[groupJid].msgsaiu_ativa = true;
            configFile.groups[groupJid].groupName = groupMetadata.subject;

            fs.writeFileSync(this.donoFile, JSON.stringify(configFile, null, 2));

            let successMsg = `✅ *Mensagem de saída configurada!*\n\n`;
            successMsg += `📝 *Mensagem salva:*\n${mensagem}\n\n`;
            successMsg += `🎯 *Preview:* Quando alguém sair, essa mensagem aparecerá`;

            await this.sendMessage(groupJid, successMsg);

        } catch (error) {
            console.error("Erro ao configurar msgsaiu:", error);
            await this.sendMessage(groupJid, '❌ Erro ao configurar mensagem de saída!');
        }
    }

    // COMANDO ADMINS
    async admins(msg, args, groupJid, senderJid) {
        if (!groupJid.endsWith('@g.us')) {
            await this.sendMessage(groupJid, '❌ Este comando só funciona em grupos!');
            return;
        }

        try {
            const groupMetadata = await this.sock.groupMetadata(groupJid);
            const senderNum = senderJid.replace('@s.whatsapp.net', '');
            
            // Obter todos os admins
            const admins = groupMetadata.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');
            const adminJids = admins.map(admin => admin.id);

            if (adminJids.length === 0) {
                await this.sendMessage(groupJid, '❌ Não há administradores neste grupo!');
                return;
            }

            let adminMsg = `🚨 *CHAMADA DE EMERGÊNCIA PARA ADMINS*\n\n`;
            adminMsg += `👤 O usuário @${senderNum} solicita a presença imediata de todos os administradores!\n\n`;
            adminMsg += `👑 *Admins marcados:*\n`;
            
            // Listar admins
            admins.forEach((admin, index) => {
                const adminNum = admin.id.replace('@s.whatsapp.net', '');
                adminMsg += `${index + 1}. @${adminNum}\n`;
            });

            adminMsg += `\n⏰ *Horário:* ${new Date().toLocaleString('pt-BR')}`;
            adminMsg += `\n📍 *Grupo:* ${groupMetadata.subject}`;
            adminMsg += `\n🆘 *Favor comparecer com urgência!*`;

            // Incluir o usuário que fez a solicitação nas menções
            const allMentions = [...adminJids, senderJid];

            await this.sendMessage(groupJid, adminMsg, { mentions: allMentions });

            console.log(`🚨 Admins chamados por ${senderNum} no grupo ${groupMetadata.subject}`);

        } catch (error) {
            console.error("Erro ao chamar admins:", error);
            await this.sendMessage(groupJid, '❌ Erro ao chamar administradores!');
        }
    }

    // ===== Moderations and toggles =====
    async toggleGroupFlag(groupJid, flagKey, value) {
        const cfg = this.getConfig();
        if (!cfg.groups) cfg.groups = {};
        if (!cfg.groups[groupJid]) cfg.groups[groupJid] = {};
        cfg.groups[groupJid][flagKey] = value;
        this.saveConfig(cfg);
        return cfg.groups[groupJid];
    }

    async anticall(msg, args, groupJid) {
        const on = args[0] === '1';
        const g = await this.toggleGroupFlag(groupJid, 'anticall', on);
        await this.sendMessage(groupJid, `${on ? '✅' : '❌'} Anti-call ${on ? 'ativado' : 'desativado'} neste grupo.`);
    }

    async antipalavrao(msg, args, groupJid) {
        const on = args[0] === '1';
        const g = await this.toggleGroupFlag(groupJid, 'antipalavrao', on);
        if (!g.palavroes) g.palavroes = [];
        this.saveConfig(this.getConfig());
        await this.sendMessage(groupJid, `${on ? '✅' : '❌'} Anti-palavrão ${on ? 'ativado' : 'desativado'} neste grupo.`);
    }

    async addpalavrao(msg, args, groupJid) {
        const palavra = args.join(' ').trim();
        if (!palavra) {
            await this.sendMessage(groupJid, '❌ Informe a palavra a bloquear.');
            return;
        }
        const cfg = this.getConfig();
        if (!cfg.groups) cfg.groups = {};
        if (!cfg.groups[groupJid]) cfg.groups[groupJid] = {};
        if (!Array.isArray(cfg.groups[groupJid].palavroes)) cfg.groups[groupJid].palavroes = [];
        if (!cfg.groups[groupJid].palavroes.includes(palavra)) cfg.groups[groupJid].palavroes.push(palavra);
        this.saveConfig(cfg);
        await this.sendMessage(groupJid, `✅ Palavra adicionada: "${palavra}"`);
    }

    async rmpalavra(msg, args, groupJid) {
        const palavra = args.join(' ').trim();
        const cfg = this.getConfig();
        const arr = cfg.groups?.[groupJid]?.palavroes || [];
        const before = arr.length;
        cfg.groups[groupJid].palavroes = arr.filter(p => p.toLowerCase() !== palavra.toLowerCase());
        this.saveConfig(cfg);
        await this.sendMessage(groupJid, before !== cfg.groups[groupJid].palavroes.length ? `✅ Removida: "${palavra}"` : `ℹ️ Não estava na lista: "${palavra}"`);
    }

    async listpalavra(msg, args, groupJid) {
        const arr = this.getConfig().groups?.[groupJid]?.palavroes || [];
        await this.sendMessage(groupJid, arr.length ? `📝 Palavras bloqueadas:\n- ${arr.join('\n- ')}` : 'ℹ️ Nenhuma palavra bloqueada.');
    }

    async antifake(msg, args, groupJid) {
        const on = args[0] === '1';
        await this.toggleGroupFlag(groupJid, 'antifake', on);
        await this.sendMessage(groupJid, `${on ? '✅' : '❌'} Anti-fake ${on ? 'ativado' : 'desativado'} (permite apenas números +258).`);
    }

    async antipv(msg, args, groupJid) {
        const on = args[0] === '1';
        await this.toggleGroupFlag(groupJid, 'antipv', on);
        await this.sendMessage(groupJid, `${on ? '✅' : '❌'} Anti-PV ${on ? 'ativado (o bot bloqueará PV)' : 'desativado'}.`);
    }

    async reiniciar(msg, args, groupJid) {
        await this.sendMessage(groupJid, '♻️ Reiniciando bot...');
        process.exit(0);
    }

    async statusbot(msg, args, groupJid) {
        try {
            const os = require('os');
            const { execSync } = require('child_process');
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const usedMem = totalMem - freeMem;
            const cpus = os.cpus();
            const load = os.loadavg()[0].toFixed(2);
            let totalDisk = 'N/A';
            let usedDisk = 'N/A';
            try {
                const out = execSync('df -h --output=size,used / | tail -1').toString().trim();
                const [size, used] = out.split(/\s+/);
                totalDisk = size; usedDisk = used;
            } catch {}
            const name = this.getConfig().NomeDoBot || 'Bot';
            const host = os.hostname();

            let msgTxt = `🤖 Nome do bot: ${name}\n`;
            msgTxt += `💾 Armazenamento: ${totalDisk}/${usedDisk}\n`;
            msgTxt += `🧠 Memória: ${(totalMem/1e9).toFixed(2)}GB / ${(usedMem/1e9).toFixed(2)}GB\n`;
            msgTxt += `🖥️ CPU: ${cpus[0]?.model || 'N/A'} (load ${load})\n`;
            msgTxt += `🖧 Hostname: ${host}\n`;
            msgTxt += `📦 Repo: https://github.com/Eliobros/mega-bot`;

            await this.sendMessage(groupJid, msgTxt);
        } catch (e) {
            await this.sendMessage(groupJid, '❌ Erro ao coletar status do bot.');
        }
    }

    async premio(msg, args, groupJid) {
        const usersData = require('../../utils/dataManager');
        // Não instanciar aqui; usar o de fora seria melhor, mas criaremos uma visão simples
        try {
            const dm = new (require('../../utils/dataManager'))();
            dm.loadAll();
            const data = dm.getUsersData();
            const users = Object.entries(data.usuarios || {}).map(([jid, u]) => ({ jid, ...u }))
                .sort((a, b) => (b.total_gb_acumulado||0) - (a.total_gb_acumulado||0));
            const top = users[0];
            if (!top) {
                await this.sendMessage(groupJid, 'ℹ️ Ainda não há compradores para premiar.');
                return;
            }
            const num = top.numero || top.jid.replace('@s.whatsapp.net','');
            const nome = top.pushName || top.nome || num;
            const hoje = new Date();
            const dia = '1 de outubro';
            const msgTxt = `🏆 PRÊMIO DO TOP 1\n\n👤 ${nome} (@${num}) está no topo do ranking!\n🎁 Receberá 1GB no dia ${dia}  se se mantiver em 1º.\n⚠️ Mantenha-se no topo para não perder a oportunidade!`;
            await this.sendMessage(groupJid, msgTxt, { mentions: [top.jid] });
        } catch (e) {
            await this.sendMessage(groupJid, '❌ Erro ao calcular prêmio.');
        }
    }

    // COMANDO BEMVINDO (ativar/desativar)
    async bemvindo(msg, args, groupJid, senderJid) {
        const config = this.getConfig();
        const donoJid = config.NumeroDono + '@s.whatsapp.net';
        const prefix = this.getPrefix();

        if (!groupJid.endsWith('@g.us')) {
            await this.sendMessage(groupJid, '❌ Este comando só funciona em grupos!');
            return;
        }

        try {
            const groupMetadata = await this.sock.groupMetadata(groupJid);
            const participant = groupMetadata.participants.find(p => p.id === senderJid);
            const isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
            const isDono = senderJid === donoJid;

            if (!isAdmin && !isDono) {
                await this.sendMessage(groupJid, '❌ Apenas admins podem usar este comando!');
                return;
            }

            if (!args[0] || (args[0] !== '1' && args[0] !== '0')) {
                let configFile = this.getConfig();
                const isActive = configFile.groups?.[groupJid]?.bemvindo_ativo || false;
                const hasMsgBv = configFile.groups?.[groupJid]?.msgbv || false;

                let statusMsg = `👋 *Sistema de Boas-vindas*\n\n`;
                statusMsg += `📍 *Grupo:* ${groupMetadata.subject}\n`;
                statusMsg += `🔥 *Status:* ${isActive ? '🟢 Ativo' : '🔴 Inativo'}\n`;
                statusMsg += `💬 *Mensagem definida:* ${hasMsgBv ? '✅ Sim' : '❌ Não'}\n\n`;
                statusMsg += `📝 *Como usar:*\n`;
                statusMsg += `• \`${prefix}bemvindo 1\` - Ativar\n`;
                statusMsg += `• \`${prefix}bemvindo 0\` - Desativar\n\n`;
                if (!hasMsgBv) {
                    statusMsg += `⚠️ *Configure uma mensagem primeiro com:*\n\`${prefix}msgbv sua mensagem aqui\``;
                }

                await this.sendMessage(groupJid, statusMsg);
                return;
            }

            const novoStatus = args[0] === '1';

            // Salvar configuração
            let configFile = this.getConfig();
            if (!configFile.groups) configFile.groups = {};
            if (!configFile.groups[groupJid]) configFile.groups[groupJid] = {};

            configFile.groups[groupJid].bemvindo_ativo = novoStatus;
            configFile.groups[groupJid].groupName = groupMetadata.subject;

            fs.writeFileSync(this.donoFile, JSON.stringify(configFile, null, 2));

            const statusText = novoStatus ? 'ativado' : 'desativado';
            const emoji = novoStatus ? '✅' : '❌';

            let responseMsg = `${emoji} *Sistema de boas-vindas ${statusText}!*\n\n`;
            responseMsg += `📍 Grupo: ${groupMetadata.subject}\n`;

            if (novoStatus) {
                if (configFile.groups[groupJid].msgbv) {
                    responseMsg += `💬 Mensagem personalizada será enviada\n`;
                    responseMsg += `🖼️ Com foto do grupo incluída`;
                } else {
                    responseMsg += `⚠️ *Atenção:* Configure uma mensagem com \`${prefix}msgbv\``;
                }
            }

            await this.sendMessage(groupJid, responseMsg);

        } catch (error) {
            console.error("Erro ao configurar bemvindo:", error);
            await this.sendMessage(groupJid, '❌ Erro ao configurar sistema de boas-vindas!');
        }
    }

    // COMANDO SAIU (ativar/desativar)
    async saiu(msg, args, groupJid, senderJid) {
        const config = this.getConfig();
        const donoJid = config.NumeroDono + '@s.whatsapp.net';
        const prefix = this.getPrefix();

        if (!groupJid.endsWith('@g.us')) {
            await this.sendMessage(groupJid, '❌ Este comando só funciona em grupos!');
            return;
        }

        try {
            const groupMetadata = await this.sock.groupMetadata(groupJid);
            const participant = groupMetadata.participants.find(p => p.id === senderJid);
            const isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
            const isDono = senderJid === donoJid;

            if (!isAdmin && !isDono) {
                await this.sendMessage(groupJid, '❌ Apenas admins podem usar este comando!');
                return;
            }

            if (!args[0] || (args[0] !== '1' && args[0] !== '0')) {
                let configFile = this.getConfig();
                const isActive = configFile.groups?.[groupJid]?.saiu_ativo || false;
                const hasMsgSaiu = configFile.groups?.[groupJid]?.msgsaiu || false;

                let statusMsg = `👋 *Sistema de Saída*\n\n`;
                statusMsg += `📍 *Grupo:* ${groupMetadata.subject}\n`;
                statusMsg += `🔥 *Status:* ${isActive ? '🟢 Ativo' : '🔴 Inativo'}\n`;
                statusMsg += `💬 *Mensagem definida:* ${hasMsgSaiu ? '✅ Sim' : '❌ Não'}\n\n`;
                statusMsg += `📝 *Como usar:*\n`;
                statusMsg += `• \`${prefix}saiu 1\` - Ativar\n`;
                statusMsg += `• \`${prefix}saiu 0\` - Desativar\n\n`;
                if (!hasMsgSaiu) {
                    statusMsg += `⚠️ *Configure uma mensagem primeiro com:*\n\`${prefix}msgsaiu sua mensagem aqui\``;
                }

                await this.sendMessage(groupJid, statusMsg);
                return;
            }

            const novoStatus = args[0] === '1';

            // Salvar configuração
            let configFile = this.getConfig();
            if (!configFile.groups) configFile.groups = {};
            if (!configFile.groups[groupJid]) configFile.groups[groupJid] = {};

            configFile.groups[groupJid].saiu_ativo = novoStatus;
            configFile.groups[groupJid].groupName = groupMetadata.subject;

            fs.writeFileSync(this.donoFile, JSON.stringify(configFile, null, 2));

            const statusText = novoStatus ? 'ativado' : 'desativado';
            const emoji = novoStatus ? '✅' : '❌';

            let responseMsg = `${emoji} *Sistema de saída ${statusText}!*\n\n`;
            responseMsg += `📍 Grupo: ${groupMetadata.subject}\n`;

            if (novoStatus) {
                if (configFile.groups[groupJid].msgsaiu) {
                    responseMsg += `💬 Mensagem personalizada será enviada\n`;
                    responseMsg += `🖼️ Com foto do grupo incluída`;
                } else {
                    responseMsg += `⚠️ *Atenção:* Configure uma mensagem com \`${prefix}msgsaiu\``;
                }
            }

            await this.sendMessage(groupJid, responseMsg);

        } catch (error) {
            console.error("Erro ao configurar saiu:", error);
            await this.sendMessage(groupJid, '❌ Erro ao configurar sistema de saída!');
        }
    }

    // FUNÇÃO PARA PROCESSAR NOVOS MEMBROS (chamada externamente)
    async handleNewMember(groupJid, newMemberJid) {
        try {
            const config = this.getConfig();
            const groupConfig = config.groups?.[groupJid];

            // Verificar se o sistema de boas-vindas está ativo
            if (!groupConfig?.bemvindo_ativo || !groupConfig?.msgbv) {
                return false;
            }

            const groupMetadata = await this.sock.groupMetadata(groupJid);
            const newMemberNum = newMemberJid.replace('@s.whatsapp.net', '');
            
            // Obter nome do usuário (pode não estar disponível imediatamente)
            let userName = newMemberNum;
            try {
                const contact = await this.sock.onWhatsApp(newMemberJid);
                if (contact[0]?.name) {
                    userName = contact[0].name;
                }
            } catch (err) {
                // Usar número se não conseguir o nome
            }

            // Processar variáveis na mensagem
            let mensagem = groupConfig.msgbv;
            mensagem = mensagem.replace(/@user/g, `@${newMemberNum}`);
            mensagem = mensagem.replace(/{nome}/g, userName);
            mensagem = mensagem.replace(/{grupo}/g, groupMetadata.subject);
            mensagem = mensagem.replace(/{membros}/g, groupMetadata.participants.length.toString());

            // Tentar obter foto do grupo
            let groupPicture = null;
            try {
                groupPicture = await this.sock.profilePictureUrl(groupJid, 'image');
            } catch (error) {
                console.log("Não foi possível obter foto do grupo");
            }

            if (groupPicture) {
                // Enviar com imagem
                await this.sock.sendMessage(groupJid, {
                    image: { url: groupPicture },
                    caption: mensagem,
                    mentions: [newMemberJid]
                });
            } else {
                // Enviar só texto
                await this.sock.sendMessage(groupJid, {
                    text: mensagem,
                    mentions: [newMemberJid]
                });
            }

            console.log(`👋 Boas-vindas enviadas para ${newMemberNum} no grupo ${groupMetadata.subject}`);
            return true;

        } catch (error) {
            console.error("Erro ao processar novo membro:", error);
            return false;
        }
    }

    // FUNÇÃO PARA PROCESSAR SAÍDA DE MEMBROS (chamada externamente)
    async handleMemberLeft(groupJid, leftMemberJid) {
        try {
            const config = this.getConfig();
            const groupConfig = config.groups?.[groupJid];

            // Verificar se o sistema de saída está ativo
            if (!groupConfig?.saiu_ativo || !groupConfig?.msgsaiu) {
                return false;
            }

            const groupMetadata = await this.sock.groupMetadata(groupJid);
            const leftMemberNum = leftMemberJid.replace('@s.whatsapp.net', '');

            // Obter nome do usuário
            let userName = leftMemberNum;
            try {
                const contact = await this.sock.onWhatsApp(leftMemberJid);
                if (contact[0]?.name) {
                    userName = contact[0].name;
                }
            } catch (err) {
                // Usar número se não conseguir o nome
            }

            // Processar variáveis na mensagem
            let mensagem = groupConfig.msgsaiu;
            mensagem = mensagem.replace(/{nome}/g, userName);
            mensagem = mensagem.replace(/{grupo}/g, groupMetadata.subject);
            mensagem = mensagem.replace(/{membros}/g, (groupMetadata.participants.length).toString());

            // Tentar obter foto do grupo
            let groupPicture = null;
            try {
                groupPicture = await this.sock.profilePictureUrl(groupJid, 'image');
            } catch (error) {
                console.log("Não foi possível obter foto do grupo");
            }

            if (groupPicture) {
                // Enviar com imagem
                await this.sock.sendMessage(groupJid, {
                    image: { url: groupPicture },
                    caption: mensagem
                });
            } else {
                // Enviar só texto
                await this.sock.sendMessage(groupJid, {
                    text: mensagem
                });
            }

            console.log(`👋 Mensagem de saída enviada para ${userName} no grupo ${groupMetadata.subject}`);
            return true;

        } catch (error) {
            console.error("Erro ao processar saída de membro:", error);
            return false;
        }
    }

    async sendMessage(jid, text, options = {}) {
        try {
            await this.sock.sendMessage(jid, { text, ...options });
        } catch (err) {
            console.error("❌ Erro ao enviar mensagem:", err);
        }
    }
}

module.exports = AdminCommands;
