const { jidNormalizedUser } = require('@whiskeysockets/baileys');

class DescGpCommand {
    constructor(sock) {
        this.sock = sock;
        this.name = 'descgp';
        this.aliases = ['setdesc', 'mudardesc', 'mudardescricao'];
        this.description = 'Muda a descrição do grupo.';
        this.usage = '!descgp <nova descrição>';
        this.category = 'dono';
    }

    async execute(msg, args, groupJid, sender) {
        if (!msg.key.fromMe && !sender.isDono && !sender.isAdmin) {
            return this.sendMessage(groupJid, '❌ Apenas o dono do bot pode usar este comando.');
        }

        if (!msg.key.remoteJid.endsWith('@g.us')) {
            return this.sendMessage(groupJid, '❌ Este comando só pode ser usado em grupos.');
        }

        const newDesc = args.join(' ');
        if (!newDesc) {
            return this.sendMessage(groupJid, '❌ Por favor, forneça uma nova descrição para o grupo.');
        }

        try {
            const groupMetadata = await this.sock.groupMetadata(groupJid);
            const botJid = jidNormalizedUser(this.sock.user.id);
            const botParticipant = groupMetadata.participants.find(p => p.id === botJid);
            const botIsAdmin = ['admin', 'superadmin'].includes(botParticipant?.admin);

            if (!botIsAdmin) {
                return this.sendMessage(groupJid, '❌ Eu preciso ser administrador para mudar a descrição do grupo!');
            }

            await this.sock.groupUpdateDescription(groupJid, newDesc);
            await this.sendMessage(groupJid, `✅ A descrição do grupo foi alterada para: ${newDesc}`);
        } catch (error) {
            console.error('Erro ao mudar a descrição do grupo:', error);
            await this.sendMessage(groupJid, `❌ Ocorreu um erro ao tentar mudar a descrição. (${error.message})`);
        }
    }

    async sendMessage(jid, text) {
        await this.sock.sendMessage(jid, { text });
    }
}

module.exports = DescGpCommand;
