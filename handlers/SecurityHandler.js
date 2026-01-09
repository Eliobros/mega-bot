const fs = require('fs');
const whatsappValidator = require('./WhatsAppValidator');

class SecurityHandler {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;
    }

    /**
     * Verifica anti-palavrão no grupo
     */
    async checkAntiPalavrao(msg, messageText, from, sender) {
        const dono = this.dataManager.getDonoData();
        const gcfg = dono.groups?.[from] || {};

        if (gcfg.antipalavrao === true && Array.isArray(gcfg.palavroes) && gcfg.palavroes.length > 0) {
            const textoLower = messageText.toLowerCase();
            const hit = gcfg.palavroes.find(p => textoLower.includes(p.toLowerCase()));

            if (hit) {
                try {
                    // Apagar mensagem
                    await this.sock.sendMessage(from, { delete: msg.key });
                } catch (e) {
                    console.log('Erro ao deletar mensagem:', e?.message);
                }

                const senderNumber = sender.replace(/(@s\.whatsapp\.net|@lid|@c\.us)/g, '');
                
                await this.sock.sendMessage(from, {
                    text: `⚠️ @${senderNumber}, palavra proibida detectada: "${hit}"`,
                    mentions: [sender]
                });

                console.log(`🚫 Palavrão detectado: "${hit}" de ${senderNumber}`);
                return true;
            }
        }
        return false;
    }

    /**
     * Verifica anti-PV (bloquear mensagens privadas)
     */
    async checkAntiPV(from, sender) {
        // Só aplica em conversas privadas
        if (from.endsWith('@g.us')) return false;

        const dono = this.dataManager.getDonoData();
        const antipvAtivo = Object.values(dono.groups || {}).some(g => g.antipv === true);

        if (antipvAtivo) {
            try {
                await this.sock.sendMessage(from, {
                    text: '🚫 *PV DESATIVADO*\n\nO bot não aceita mensagens privadas no momento.\n\nPor favor, contate-nos através dos grupos oficiais.'
                });
                
                // Bloquear usuário
                await this.sock.updateBlockStatus(from, 'block');
                
                console.log(`🚫 PV bloqueado e usuário banido: ${from}`);
            } catch (e) {
                console.log('Erro ao bloquear PV:', e?.message);
            }
            return true;
        }
        return false;
    }

    /**
     * Verifica se alguém marcou o grupo no status
     * COM VALIDAÇÃO ALAUDA API
     */
    async checkStatusMention(msg, from) {
        // Só processa em grupos
        if (!from.endsWith('@g.us')) return false;

        // Verificar se é groupStatusMentionMessage
        if (!msg.message?.groupStatusMentionMessage) return false;

        const participant = msg.key.participant;
        const participantName = msg.pushName || participant?.split('@')[0] || 'Usuário';

        console.log('🎯 DETECTADO: Status mention no grupo!');
        console.log('👤 Quem marcou:', participant);
        console.log('📛 Nome:', participantName);
        console.log('🏪 Grupo:', from);

        // ===== 🛡️ VERIFICAR PROTEÇÕES =====
        try {
            // 1️⃣ Carregar dono do bot
            const donoData = this.dataManager.getDonoData();
            const donoBotNumber = donoData.NumeroDono + '@s.whatsapp.net';

            // 2️⃣ Verificar se é o dono do bot
            const isDonoBOT = participant === donoBotNumber;

            // 3️⃣ Pegar metadados do grupo
            const groupMetadata = await this.sock.groupMetadata(from);

            // 4️⃣ Verificar se é admin/dono do grupo
            const isAdminGrupo = groupMetadata.participants.some(
                p => p.id === participant && (p.admin === 'admin' || p.admin === 'superadmin')
            );

            // 5️⃣ Verificar se é o próprio bot
            const botNumber = this.sock.user.id.split(':')[0] + '@s.whatsapp.net';
            const isBot = participant === botNumber;

            console.log('🔐 Status de Proteção:');
            console.log(`   • Dono do BOT: ${isDonoBOT ? '✅ SIM' : '❌ NÃO'}`);
            console.log(`   • Admin do Grupo: ${isAdminGrupo ? '✅ SIM' : '❌ NÃO'}`);
            console.log(`   • É o BOT: ${isBot ? '✅ SIM' : '❌ NÃO'}`);

            // ===== ⛔ SE FOR PROTEGIDO, PARA AQUI =====
            if (isDonoBOT || isAdminGrupo || isBot) {
                console.log('✅ USUÁRIO PROTEGIDO - Não será banido!');

                let mensagemProtecao = '';

                if (isDonoBOT) {
                    mensagemProtecao = `👑 *DONO DO BOT PROTEGIDO*\n\n` +
                                      `@${participant.split('@')[0]}, você é o dono do bot!\n\n` +
                                      `Tem permissão total, mas evite marcar o grupo para dar o exemplo! 😊`;
                } else if (isAdminGrupo) {
                    mensagemProtecao = `🛡️ *ADMIN DO GRUPO PROTEGIDO*\n\n` +
                                      `@${participant.split('@')[0]}, você é admin deste grupo!\n\n` +
                                      `Está protegido, mas evite marcar o grupo no status! 😊`;
                } else if (isBot) {
                    // Se for o bot, não envia nada
                    return true;
                }

                await this.sock.sendMessage(from, {
                    text: mensagemProtecao,
                    mentions: [participant]
                });

                return true; // ⛔ PARA AQUI
            }

            console.log('❌ Usuário COMUM - Sujeito às regras');

        } catch (error) {
            console.error('⚠️ Erro ao verificar permissões:', error);
            // Se der erro, continua normal
        }

        // ===== 🔐 VALIDAÇÃO COM ALAUDA API =====
        console.log(`🔐 ========== VALIDAÇÃO ALAUDA API ==========`);
        console.log(`🆔 Validando grupo: ${from}`);

        const validation = await whatsappValidator.validate(from);

        if (!validation.valid) {
            console.log(`❌ Grupo ${from} NÃO autorizado ou sem créditos`);
            console.log(`Motivo: ${validation.message}`);

            await this.sock.sendMessage(from, {
                text: validation.message ||
                      `⚠️ *BOT NÃO ATIVADO NESTE GRUPO*\n\n` +
                      `Este grupo precisa ser ativado com uma chave da Alauda API.\n\n` +
                      `📝 *Como ativar:*\n` +
                      `!ativar <sua_chave>\n\n` +
                      `💡 *Exemplo:*\n` +
                      `!ativar alauda_live_abc123\n\n` +
                      `🔗 Obtenha sua chave em: https://alauda-api.com`
            });

            return true;
        }

        console.log(`✅ Grupo AUTORIZADO!`);
        console.log(`🏪 Nome: ${validation.group_name || 'Desconhecido'}`);
        console.log(`💰 Créditos: ${validation.credits}`);

        // ===== 💰 CONSUMIR CRÉDITOS =====
        console.log(`💳 Consumindo créditos...`);
        const consumption = await whatsappValidator.consume(from);

        if (!consumption.success) {
            console.log(`❌ ERRO ao consumir créditos: ${consumption.message}`);

            if (consumption.no_credits) {
                await this.sock.sendMessage(from, {
                    text: `⚠️ *CRÉDITOS INSUFICIENTES*\n\n` +
                          `O bot não pode processar esta ação porque os créditos acabaram.\n\n` +
                          `💰 *Recarregue para continuar protegendo este grupo!*\n\n` +
                          `📊 Créditos atuais: 0\n` +
                          `🔗 Recarregar em: https://alauda-api.com/recarregar`
                });
            }

            return true;
        }

        console.log(`✅ Créditos consumidos: ${consumption.credits_consumed}`);
        console.log(`💳 Créditos restantes: ${consumption.credits_remaining}`);

        // ===== ✅ PROCESSAR AVISOS/BAN =====
        let warnings = this.dataManager.getStatusMentionWarnings(from, participant);

        if (warnings === 0) {
            // ⚠️ PRIMEIRO AVISO
            warnings = this.dataManager.addStatusMentionWarning(from, participant);

            await this.sock.sendMessage(from, {
                text: `⚠️ *AVISO* ⚠️\n\n` +
                      `@${participant.split('@')[0]}, evite marcar o grupo nos seus status.\n\n` +
                      `⚠️ *Próxima vez você será removido do grupo!*\n\n` +
                      `📊 Avisos: ${warnings}/2\n` +
                      `💰 Créditos restantes: ${consumption.credits_remaining}`,
                mentions: [participant]
            });

            console.log(`✅ Primeiro aviso dado para ${participantName}`);

        } else if (warnings === 1) {
            // ❌ SEGUNDO AVISO = BAN
            this.dataManager.addStatusMentionWarning(from, participant);

            await this.sock.groupParticipantsUpdate(from, [participant], 'remove');

            await this.sock.sendMessage(from, {
                text: `❌ @${participant.split('@')[0]} foi removido por marcar o grupo no status repetidamente.\n\n` +
                      `🛡️ Proteção ativa!\n` +
                      `💰 Créditos restantes: ${consumption.credits_remaining}`,
                mentions: [participant]
            });

            console.log(`🚫 ${participantName} foi BANIDO`);

        } else {
            // Reincidente
            await this.sock.groupParticipantsUpdate(from, [participant], 'remove');

            await this.sock.sendMessage(from, {
                text: `❌ @${participant.split('@')[0]} foi removido novamente.\n\n` +
                      `⚠️ Usuário reincidente.\n` +
                      `💰 Créditos restantes: ${consumption.credits_remaining}`,
                mentions: [participant]
            });

            console.log(`🚫 ${participantName} BANIDO (reincidente)`);
        }

        console.log(`🎉 Operação concluída com sucesso!`);
        return true;
    }

    /**
     * Verificar anti-fake (apenas números de Moçambique +258)
     */
    async checkAntiFake(groupJid, participantJid) {
        try {
            const cfg = this.dataManager.getDonoData().groups?.[groupJid] || {};
            
            if (cfg.antifake !== true) return false;

            const num = participantJid.replace('@s.whatsapp.net', '');
            
            if (!num.startsWith('258')) {
                await this.sock.groupParticipantsUpdate(groupJid, [participantJid], 'remove');
                
                await this.sock.sendMessage(groupJid, {
                    text: `🚫 Número não permitido: @${num}\n\n` +
                          `⚠️ Apenas números de Moçambique (+258) são aceitos neste grupo.`,
                    mentions: [participantJid]
                });

                console.log(`🚫 Anti-fake: ${num} removido de ${groupJid}`);
                return true;
            }

            return false;
        } catch (error) {
            console.error('Erro no anti-fake:', error);
            return false;
        }
    }

    /**
     * Verificar anti-call (bloquear chamadas)
     */
    async checkAntiCall(callInfo) {
        try {
            const dono = this.dataManager.getDonoData();
            const anticallAtivo = Object.values(dono.groups || {}).some(g => g.anticall === true);

            if (!anticallAtivo) return false;

            const fromJid = callInfo.from || callInfo.id || null;
            if (!fromJid) return false;

            try {
                await this.sock.updateBlockStatus(fromJid, 'block');
                
                await this.sock.sendMessage(fromJid, {
                    text: '🚫 *CHAMADAS NÃO PERMITIDAS*\n\n' +
                          'Você foi bloqueado por tentar fazer uma chamada.\n\n' +
                          '⚠️ O bot não aceita ligações.'
                });

                const num = fromJid.replace('@s.whatsapp.net', '');
                console.log(`📵 Usuário ${num} bloqueado por ligação`);
                
                return true;
            } catch (e) {
                console.log('Falha ao bloquear chamador:', e?.message);
                return false;
            }
        } catch (e) {
            console.log('Erro no anti-call:', e?.message);
            return false;
        }
    }
}

module.exports = SecurityHandler;
