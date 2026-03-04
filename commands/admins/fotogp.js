const { jidNormalizedUser, MessageType } = require('baileys');
const fs = require('fs');

class FotoGpCommand {
    constructor(sock) {
        this.sock = sock;
        this.name = 'fotogp';
        this.aliases = ['setfoto', 'mudarfoto', 'fotogrupo'];
        this.description = 'Muda a foto do grupo.';
        this.usage = '!fotogp (responder a imagem ou enviar uma imagem)';
        this.category = 'dono';
    }

    async execute(msg, args, groupJid, sender) {
        if (!msg.key.fromMe && !sender.isDono && !sender.isAdmin) {
            return this.sendMessage(groupJid, '❌ Apenas o dono do bot pode usar este comando.');
        }

        if (!msg.key.remoteJid.endsWith('@g.us')) {
            return this.sendMessage(groupJid, '❌ Este comando só pode ser usado em grupos.');
        }

        try {
            const groupMetadata = await this.sock.groupMetadata(groupJid);
            const botJid = jidNormalizedUser(this.sock.user.id);
            const botParticipant = groupMetadata.participants.find(p => p.id === botJid);
            const botIsAdmin = ['admin', 'superadmin'].includes(botParticipant?.admin);

            if (!botIsAdmin) {
                return this.sendMessage(groupJid, '❌ Eu preciso ser administrador para mudar a foto do grupo!');
            }

            let buffer;
            if (msg.message.imageMessage) {
                // Se a mensagem é uma imagem enviada
                buffer = await this.sock.downloadMediaMessage(msg);
            } else if (msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage) {
                // Se a mensagem é resposta a uma imagem
                const quoted = msg.message.extendedTextMessage.contextInfo.quotedMessage;
                buffer = await this.sock.downloadMediaMessage({ message: quoted });
            } else {
                return this.sendMessage(groupJid, '❌ Por favor, envie ou responda uma imagem para definir como foto do grupo.');
            }

            await this.sock.groupUpdateProfilePicture(groupJid, buffer);
            await this.sendMessage(groupJid, '✅ A foto do grupo foi atualizada com sucesso!');
        } catch (error) {
            console.error('Erro ao mudar a foto do grupo:', error);
            await this.sendMessage(groupJid, `❌ Ocorreu um erro ao tentar mudar a foto. (${error.message})`);
        }
    }

    async sendMessage(jid, text) {
        await this.sock.sendMessage(jid, { text });
    }
}

module.exports = FotoGpCommand;
