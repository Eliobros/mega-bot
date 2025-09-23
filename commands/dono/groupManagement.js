const fs = require('fs');
const path = require('path');

class GroupManagementCommands {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;
        this.donoFile = path.join(__dirname, '../../database/dono.json');
    }

    getConfig() {
        try {
            return JSON.parse(fs.readFileSync(this.donoFile));
        } catch (error) {
            return { Prefixo: '/', NumeroDono: '' };
        }
    }

    // Verificar se bot é admin
    async isBotAdmin(groupJid) {
        try {
            const groupMetadata = await this.sock.groupMetadata(groupJid);
            
            let botNumber = null;
            if (this.sock.user.lid) {
                botNumber = this.sock.user.lid.replace(/:.*/, '');
            } else {
                botNumber = this.sock.user.id.replace(/:.*/, '');
            }
            
            const botParticipant = groupMetadata.participants.find(p => p.id.includes(botNumber));
            return botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';
        } catch (error) {
            return false;
        }
    }

    // Verificar se usuário é admin ou dono
    async isUserAdmin(groupJid, senderJid) {
        try {
            const config = this.getConfig();
            const donoNumber = config.NumeroDono;
            const senderNumber = senderJid.replace(/@.*/, '');
            
            // Se for o dono
            if (senderNumber === donoNumber) {
                return true;
            }
            
            // Verificar se é admin do grupo
            const groupMetadata = await this.sock.groupMetadata(groupJid);
            const participant = groupMetadata.participants.find(p => p.id === senderJid);
            return participant?.admin === 'admin' || participant?.admin === 'superadmin';
        } catch (error) {
            return false;
        }
    }

    // COMANDO NOMEGP - Alterar nome do grupo
    async nomeGp(msg, args, from, sender) {
        const config = this.getConfig();
        const prefixo = config.Prefixo || '/';

        if (!from.endsWith('@g.us')) {
            await this.sendMessage(from, '❌ Este comando só funciona em grupos!');
            return;
        }

        try {
            // Verificar permissões
            const isUserAdminResult = await this.isUserAdmin(from, sender);
            if (!isUserAdminResult) {
                await this.sendMessage(from, '❌ *Acesso Negado!*\n\n🔒 Apenas administradores podem alterar o nome do grupo.');
                return;
            }

            // Verificar se bot é admin
            const isBotAdminResult = await this.isBotAdmin(from);
            if (!isBotAdminResult) {
                await this.sendMessage(from, '❌ *Bot sem permissão!*\n\n🤖 O bot precisa ser administrador para alterar o nome do grupo.');
                return;
            }

            if (!args.length) {
                const groupMetadata = await this.sock.groupMetadata(from);
                let helpMsg = `📝 *Alterar Nome do Grupo*\n\n`;
                helpMsg += `📌 *Nome atual:* ${groupMetadata.subject}\n\n`;
                helpMsg += `📝 *Como usar:*\n`;
                helpMsg += `\`${prefixo}nomegp Novo Nome do Grupo\`\n\n`;
                helpMsg += `💡 *Exemplo:*\n`;
                helpMsg += `\`${prefixo}nomegp Amigos da Programação\`\n\n`;
                helpMsg += `⚠️ *Limite:* Máximo 25 caracteres`;
                
                await this.sendMessage(from, helpMsg);
                return;
            }

            const novoNome = args.join(' ');

            // Validações
            if (novoNome.length > 25) {
                await this.sendMessage(from, `❌ *Nome muito longo!*\n\n📏 Limite: 25 caracteres\n📊 Seu nome: ${novoNome.length} caracteres\n\n✂️ Reduza o tamanho e tente novamente.`);
                return;
            }

            if (novoNome.length < 3) {
                await this.sendMessage(from, '❌ *Nome muito curto!*\n\n📏 Mínimo: 3 caracteres');
                return;
            }

            // Obter nome atual
            const groupMetadata = await this.sock.groupMetadata(from);
            const nomeAntigo = groupMetadata.subject;

            if (novoNome === nomeAntigo) {
                await this.sendMessage(from, `⚠️ *Nenhuma alteração necessária*\n\n📌 O nome "${novoNome}" já está sendo usado.`);
                return;
            }

            // Alterar nome
            await this.sock.groupUpdateSubject(from, novoNome);

            const senderNumber = sender.replace(/@.*/, '');
            let successMsg = `✅ *Nome do grupo alterado!*\n\n`;
            successMsg += `📝 *Mudança:*\n`;
            successMsg += `   Anterior: "${nomeAntigo}"\n`;
            successMsg += `   Novo: "${novoNome}"\n\n`;
            successMsg += `👤 *Alterado por:* @${senderNumber}\n`;
            successMsg += `📅 *Data:* ${new Date().toLocaleString('pt-BR')}`;

            await this.sendMessage(from, successMsg, { mentions: [sender] });

            console.log(`📝 Nome do grupo alterado: "${nomeAntigo}" → "${novoNome}" por ${senderNumber}`);

        } catch (error) {
            console.error("Erro ao alterar nome do grupo:", error);
            await this.sendMessage(from, '❌ *Erro ao alterar nome!*\n\nVerifique se o bot tem permissões de administrador.');
        }
    }

    // COMANDO DESCGP - Alterar descrição do grupo
    async descGp(msg, args, from, sender) {
        const config = this.getConfig();
        const prefixo = config.Prefixo || '/';

        if (!from.endsWith('@g.us')) {
            await this.sendMessage(from, '❌ Este comando só funciona em grupos!');
            return;
        }

        try {
            // Verificar permissões
            const isUserAdminResult = await this.isUserAdmin(from, sender);
            if (!isUserAdminResult) {
                await this.sendMessage(from, '❌ *Acesso Negado!*\n\n🔒 Apenas administradores podem alterar a descrição do grupo.');
                return;
            }

            // Verificar se bot é admin
            const isBotAdminResult = await this.isBotAdmin(from);
            if (!isBotAdminResult) {
                await this.sendMessage(from, '❌ *Bot sem permissão!*\n\n🤖 O bot precisa ser administrador para alterar a descrição do grupo.');
                return;
            }

            if (!args.length) {
                const groupMetadata = await this.sock.groupMetadata(from);
                const descAtual = groupMetadata.desc || 'Sem descrição';
                
                let helpMsg = `📄 *Alterar Descrição do Grupo*\n\n`;
                helpMsg += `📌 *Descrição atual:*\n${descAtual}\n\n`;
                helpMsg += `📝 *Como usar:*\n`;
                helpMsg += `\`${prefixo}descgp Nova descrição aqui\`\n\n`;
                helpMsg += `💡 *Exemplo:*\n`;
                helpMsg += `\`${prefixo}descgp Grupo para discussões sobre tecnologia e programação\`\n\n`;
                helpMsg += `⚠️ *Limite:* Máximo 512 caracteres\n`;
                helpMsg += `🗑️ *Para limpar:* \`${prefixo}descgp limpar\``;
                
                await this.sendMessage(from, helpMsg);
                return;
            }

            let novaDesc = args.join(' ');

            // Comando especial para limpar descrição
            if (novaDesc.toLowerCase() === 'limpar' || novaDesc.toLowerCase() === 'remover') {
                novaDesc = '';
            }

            // Validações
            if (novaDesc.length > 512) {
                await this.sendMessage(from, `❌ *Descrição muito longa!*\n\n📏 Limite: 512 caracteres\n📊 Sua descrição: ${novaDesc.length} caracteres\n\n✂️ Reduza o tamanho e tente novamente.`);
                return;
            }

            // Obter descrição atual
            const groupMetadata = await this.sock.groupMetadata(from);
            const descAntiga = groupMetadata.desc || '';

            if (novaDesc === descAntiga) {
                await this.sendMessage(from, '⚠️ *Nenhuma alteração necessária*\n\nA descrição informada é igual à atual.');
                return;
            }

            // Alterar descrição
            await this.sock.groupUpdateDescription(from, novaDesc);

            const senderNumber = sender.replace(/@.*/, '');
            let successMsg = `✅ *Descrição do grupo alterada!*\n\n`;
            
            if (novaDesc === '') {
                successMsg += `🗑️ *Ação:* Descrição removida\n`;
            } else {
                successMsg += `📄 *Nova descrição:*\n"${novaDesc}"\n\n`;
            }
            
            successMsg += `👤 *Alterado por:* @${senderNumber}\n`;
            successMsg += `📅 *Data:* ${new Date().toLocaleString('pt-BR')}`;

            await this.sendMessage(from, successMsg, { mentions: [sender] });

            console.log(`📄 Descrição do grupo alterada por ${senderNumber}`);

        } catch (error) {
            console.error("Erro ao alterar descrição do grupo:", error);
            await this.sendMessage(from, '❌ *Erro ao alterar descrição!*\n\nVerifique se o bot tem permissões de administrador.');
        }
    }

    // COMANDO FOTOGP - Alterar foto do grupo
    async fotoGp(msg, args, from, sender) {
        const config = this.getConfig();
        const prefixo = config.Prefixo || '/';

        if (!from.endsWith('@g.us')) {
            await this.sendMessage(from, '❌ Este comando só funciona em grupos!');
            return;
        }

        try {
            // Verificar permissões
            const isUserAdminResult = await this.isUserAdmin(from, sender);
            if (!isUserAdminResult) {
                await this.sendMessage(from, '❌ *Acesso Negado!*\n\n🔒 Apenas administradores podem alterar a foto do grupo.');
                return;
            }

            // Verificar se bot é admin
            const isBotAdminResult = await this.isBotAdmin(from);
            if (!isBotAdminResult) {
                await this.sendMessage(from, '❌ *Bot sem permissão!*\n\n🤖 O bot precisa ser administrador para alterar a foto do grupo.');
                return;
            }

            // Verificar se enviou imagem
            const hasImage = msg.message?.imageMessage || 
                            msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;

            if (!hasImage) {
                let helpMsg = `📸 *Alterar Foto do Grupo*\n\n`;
                helpMsg += `📝 *Como usar:*\n`;
                helpMsg += `1. Envie uma imagem com a legenda \`${prefixo}fotogp\`\n`;
                helpMsg += `2. Ou responda uma imagem com \`${prefixo}fotogp\`\n\n`;
                helpMsg += `💡 *Dicas:*\n`;
                helpMsg += `• Use imagens quadradas para melhor resultado\n`;
                helpMsg += `• Resolução recomendada: 640x640 ou maior\n`;
                helpMsg += `• Formatos aceitos: JPG, PNG\n\n`;
                helpMsg += `🗑️ *Para remover foto:* \`${prefixo}fotogp remover\``;
                
                await this.sendMessage(from, helpMsg);
                return;
            }

            // Comando especial para remover foto
            if (args.length && (args[0].toLowerCase() === 'remover' || args[0].toLowerCase() === 'limpar')) {
                await this.sock.groupUpdatePicture(from, null);
                
                const senderNumber = sender.replace(/@.*/, '');
                let successMsg = `✅ *Foto do grupo removida!*\n\n`;
                successMsg += `🗑️ *Ação:* Foto removida com sucesso\n`;
                successMsg += `👤 *Removido por:* @${senderNumber}\n`;
                successMsg += `📅 *Data:* ${new Date().toLocaleString('pt-BR')}`;

                await this.sendMessage(from, successMsg, { mentions: [sender] });
                return;
            }

            // Obter buffer da imagem
            let imageBuffer;
            if (msg.message?.imageMessage) {
                // Imagem enviada diretamente
                imageBuffer = await this.sock.downloadMediaMessage(msg);
            } else if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage) {
                // Imagem respondida
                const quotedMessage = {
                    key: {
                        remoteJid: from,
                        id: msg.message.extendedTextMessage.contextInfo.stanzaId
                    },
                    message: msg.message.extendedTextMessage.contextInfo.quotedMessage
                };
                imageBuffer = await this.sock.downloadMediaMessage(quotedMessage);
            }

            if (!imageBuffer) {
                await this.sendMessage(from, '❌ *Erro ao processar imagem!*\n\nTente enviar novamente.');
                return;
            }

            // Verificar tamanho da imagem (máximo 5MB)
            if (imageBuffer.length > 5 * 1024 * 1024) {
                await this.sendMessage(from, '❌ *Imagem muito grande!*\n\n📏 Tamanho máximo: 5MB\n🔧 Comprima a imagem e tente novamente.');
                return;
            }

            // Alterar foto do grupo
            await this.sock.groupUpdatePicture(from, imageBuffer);

            const senderNumber = sender.replace(/@.*/, '');
            let successMsg = `✅ *Foto do grupo alterada!*\n\n`;
            successMsg += `📸 *Nova foto definida com sucesso*\n`;
            successMsg += `👤 *Alterado por:* @${senderNumber}\n`;
            successMsg += `📅 *Data:* ${new Date().toLocaleString('pt-BR')}\n`;
            successMsg += `💾 *Tamanho:* ${(imageBuffer.length / 1024).toFixed(1)} KB`;

            await this.sendMessage(from, successMsg, { mentions: [sender] });

            console.log(`📸 Foto do grupo alterada por ${senderNumber}`);

        } catch (error) {
            console.error("Erro ao alterar foto do grupo:", error);
            
            let errorMsg = '❌ *Erro ao alterar foto!*\n\n';
            if (error.output?.statusCode === 413) {
                errorMsg += '📏 Imagem muito grande. Use uma imagem menor.';
            } else if (error.output?.statusCode === 415) {
                errorMsg += '🖼️ Formato não suportado. Use JPG ou PNG.';
            } else {
                errorMsg += '🔧 Verifique se o bot tem permissões de administrador.';
            }
            
            await this.sendMessage(from, errorMsg);
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

module.exports = GroupManagementCommands;
