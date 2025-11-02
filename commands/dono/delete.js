const fs = require('fs');
const path = require('path');

class DeleteCommand {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;
        this.donoFile = path.join(__dirname, '../../database/dono.json');
    }

    getConfig() {
        try {
            return JSON.parse(fs.readFileSync(this.donoFile));
        } catch (error) {
            return { groups: {}, Prefixo: '!', NumeroDono: '' };
        }
    }

    // Pegar prefixo do dono.json
    getPrefix() {
        const config = this.getConfig();
        return config.Prefixo || '!';
    }

    // Método centralizado para obter dados do dono
    getDonoInfo() {
        const donoData = this.dataManager.getDonoData();
        return {
            jid: donoData.NumeroDono + '@s.whatsapp.net',
            number: donoData.NumeroDono
        };
    }

    // 🔧 NOVO: Normalizar número (só dígitos)
    normalizarNumero(jid) {
        return jid.replace(/\D/g, '');
    }

    // Verificar permissões do usuário - ATUALIZADO COM LOGS
    async checkUserPermissions(groupJid, senderJid) {
        const dono = this.getDonoInfo();
        
        // Extrai apenas números para comparação
        const senderNumber = this.normalizarNumero(senderJid.split('@')[0]);
        const donoNumber = this.normalizarNumero(dono.number);
        
        // Verifica se é dono (múltiplas formas de comparação)
        const isDono = senderNumber === donoNumber || 
                       senderNumber.includes(donoNumber) ||
                       donoNumber.includes(senderNumber);
        
        // 🐛 LOGS DETALHADOS
        console.log('\n============ VERIFICAÇÃO DE PERMISSÕES ============');
        console.log('📱 Sender JID completo:', senderJid);
        console.log('🔢 Sender Number (extraído):', senderNumber);
        console.log('👑 Dono JID completo:', dono.jid);
        console.log('🔢 Dono Number (config):', donoNumber);
        console.log('✅ É Dono?:', isDono ? '✅ SIM' : '❌ NÃO');
        console.log('🏪 Grupo JID:', groupJid);
        
        try {
            const groupMetadata = await this.sock.groupMetadata(groupJid);
            const participant = groupMetadata.participants.find(p => p.id === senderJid);
            const isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
            
            console.log('👮 É Admin?:', isAdmin ? '✅ SIM' : '❌ NÃO');
            console.log('🔐 Permissão Final:', (isDono || isAdmin) ? '✅ AUTORIZADO' : '❌ NEGADO');
            console.log('===================================================\n');
            
            return {
                isDono,
                isAdmin,
                groupMetadata,
                participant
            };
        } catch (error) {
            console.error("❌ Erro ao verificar permissões:", error);
            console.log('===================================================\n');
            return { isDono, isAdmin: false, groupMetadata: null, participant: null };
        }
    }

    // Enviar log para o dono
    async sendLogToDono(message) {
        const dono = this.getDonoInfo();
        await this.sendMessage(dono.jid, message);
    }

    async execute(msg, args, groupJid, senderJid) {
        console.log('\n========== DELETE COMMAND INICIADO ==========');
        console.log('🔍 DEBUG DELETE COMMAND:');
        console.log('- GroupJid:', groupJid);
        console.log('- SenderJid:', senderJid);
        console.log('- Args:', JSON.stringify(args));
        console.log('- Mensagem citada existe:', !!msg.message?.extendedTextMessage?.contextInfo?.quotedMessage);
        console.log('- StanzaId:', msg.message?.extendedTextMessage?.contextInfo?.stanzaId);
        console.log('- Participant:', msg.message?.extendedTextMessage?.contextInfo?.participant);
        console.log('=============================================\n');

        const prefix = this.getPrefix();

        // Verificar se é um grupo
        if (!groupJid.endsWith('@g.us')) {
            await this.sendMessage(groupJid, '❌ Este comando só funciona em grupos!');
            return;
        }

        // Verificar permissões
        const permissions = await this.checkUserPermissions(groupJid, senderJid);
        
        if (!permissions.groupMetadata) {
            await this.sendMessage(groupJid, '❌ Erro ao acessar informações do grupo!');
            return;
        }

        if (!permissions.isAdmin && !permissions.isDono) {
            console.log('⛔ ACESSO NEGADO: Usuário não é admin nem dono');
            await this.sendMessage(groupJid, '❌ Apenas admins podem usar este comando!');
            return;
        }

        console.log('✅ PERMISSÃO CONCEDIDA: Prosseguindo com delete...\n');

        // Verificar se há uma mensagem citada/marcada
        const quotedMessage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const stanzaId = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
        const participant = msg.message?.extendedTextMessage?.contextInfo?.participant;

        if (!quotedMessage || !stanzaId) {
            console.log('⚠️ Nenhuma mensagem marcada para deletar');
            await this.sendMessage(groupJid, `❌ *Nenhuma mensagem marcada!*\n\n💡 *Como usar:*\n• Responda/marque a mensagem que quer apagar\n• Digite \`${prefix}delete\` ou \`${prefix}del\``);
            return;
        }

        try {
            const groupName = permissions.groupMetadata.subject;

            // Informações da mensagem a ser deletada
            const targetUser = participant || senderJid;
            const targetUserNumber = targetUser.replace('@s.whatsapp.net', '');

            console.log('🗑️ Tentando deletar mensagem:');
            console.log('- ID da mensagem:', stanzaId);
            console.log('- Autor da mensagem:', targetUserNumber);
            console.log('- Grupo:', groupName);

            // Apagar a mensagem marcada
            await this.sock.sendMessage(groupJid, {
                delete: {
                    remoteJid: groupJid,
                    id: stanzaId,
                    participant: participant || senderJid
                }
            });

            console.log('✅ Mensagem deletada com sucesso!');

            // Pequena pausa para garantir que a mensagem foi deletada
            await new Promise(resolve => setTimeout(resolve, 500));

            // Opcional: Apagar também o comando delete (para deixar mais limpo)
            if (args[0] !== 'keep' && args[0] !== 'manter') {
                try {
                    console.log('🧹 Tentando apagar o comando delete também...');
                    await this.sock.sendMessage(groupJid, {
                        delete: {
                            remoteJid: groupJid,
                            id: msg.key.id,
                            participant: msg.key.participant || senderJid
                        }
                    });
                    console.log('✅ Comando delete também foi apagado');
                } catch (e) {
                    console.log('⚠️ Não foi possível apagar o comando delete:', e.message);
                }
            }

            // Log para o dono (se não for o próprio dono executando)
            if (!permissions.isDono) {
                const adminNumber = senderJid.replace('@s.whatsapp.net', '');
                let log = `🗑️ *MENSAGEM DELETADA*\n\n`;
                log += `🏪 *Grupo:* ${groupName}\n`;
                log += `👤 *Mensagem de:* +${targetUserNumber}\n`;
                log += `🛡️ *Deletada por:* +${adminNumber} (Admin)\n`;
                log += `📅 *Data/Hora:* ${new Date().toLocaleString('pt-BR')}\n`;
                log += `🆔 *ID do Grupo:* ${groupJid}`;
                
                console.log('📤 Enviando log para o dono...');
                await this.sendLogToDono(log);
                console.log('✅ Log enviado para o dono');
            }

            console.log('🎉 Operação de delete concluída com sucesso!\n');

        } catch (error) {
            console.error('\n❌ ========== ERRO AO DELETAR MENSAGEM ==========');
            console.error('Erro completo:', error);
            console.error('Status Code:', error.output?.statusCode);
            console.error('Mensagem de erro:', error.message);
            console.error('================================================\n');
            
            if (error.output?.statusCode === 403) {
                await this.sendMessage(groupJid, '❌ Bot não tem permissão para deletar mensagens!\n💡 Verifique se o bot é admin do grupo.');
            } else if (error.output?.statusCode === 404) {
                await this.sendMessage(groupJid, '❌ Mensagem não encontrada ou já foi deletada!');
            } else {
                await this.sendMessage(groupJid, `❌ Erro ao deletar mensagem!\n🔧 Erro: ${error.message || 'Desconhecido'}`);
            }
        }
    }

    // Método alternativo para deletar múltiplas mensagens (para uso futuro)
    async deleteMultiple(messageIds, groupJid, senderJid) {
        console.log('\n🗑️ Iniciando deleção múltipla de mensagens...');
        console.log('Quantidade de mensagens:', messageIds.length);
        
        const permissions = await this.checkUserPermissions(groupJid, senderJid);
        
        if (!permissions.isAdmin && !permissions.isDono) {
            console.log('⛔ Permissão negada para deleção múltipla');
            return false;
        }

        try {
            for (let i = 0; i < messageIds.length; i++) {
                console.log(`Deletando mensagem ${i + 1}/${messageIds.length}...`);
                
                await this.sock.sendMessage(groupJid, {
                    delete: {
                        remoteJid: groupJid,
                        id: messageIds[i].id,
                        participant: messageIds[i].participant
                    }
                });
                
                // Pausa entre as deleções
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            console.log('✅ Todas as mensagens foram deletadas com sucesso!\n');
            return true;
        } catch (error) {
            console.error("❌ Erro ao deletar múltiplas mensagens:", error);
            return false;
        }
    }

    // Mostrar ajuda do comando
    async showHelp(groupJid) {
        const prefix = this.getPrefix();
        
        let helpMsg = `🗑️ *Comando Delete*\n\n`;
        helpMsg += `📝 *Como usar:*\n`;
        helpMsg += `• Responda/marque a mensagem indesejada\n`;
        helpMsg += `• Digite \`${prefix}delete\` ou \`${prefix}del\`\n\n`;
        helpMsg += `⚙️ *Opções:*\n`;
        helpMsg += `• \`${prefix}delete\` - Apaga msg + comando\n`;
        helpMsg += `• \`${prefix}delete keep\` - Apaga só a msg marcada\n\n`;
        helpMsg += `⚠️ *Requisitos:*\n`;
        helpMsg += `• Apenas admins podem usar\n`;
        helpMsg += `• Bot precisa ser admin do grupo\n`;
        helpMsg += `• Mensagem deve estar marcada/citada\n\n`;
        helpMsg += `💡 *Dicas:*\n`;
        helpMsg += `• Use para remover spam/conteúdo inadequado\n`;
        helpMsg += `• Todas as ações são registradas`;

        await this.sendMessage(groupJid, helpMsg);
    }

    async sendMessage(jid, text, options = {}) {
        try {
            await this.sock.sendMessage(jid, { text, ...options });
        } catch (err) {
            console.error("❌ Erro ao enviar mensagem:", err);
        }
    }
}

module.exports = DeleteCommand;
