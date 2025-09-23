//comado pra mudar nome do grupo
const { jidNormalizedUser } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const donoData = require('../../database/dono.json');
const prefixo = donoData.prefixo || '!';
const NumeroDono = donoData.NumeroDono || '558598871155';
class NomeGpCommand {
    constructor(sock) {
        this.sock = sock;
        this.name = 'nomegp';
        this.aliases = ['setname', 'mudarname', 'mudarnome'];
        this.description = 'Muda o nome do grupo.';
        this.usage = '!nomegp <novo nome>';
        this.category = 'dono';
    }

//    const isDono = NumeroDono.includes(sender.id.replace(/:\d+/, ''));

    async execute(msg, args, groupJid, sender) {
        if (!msg.key.fromMe && !sender.isDono && !sender.isAdmin) {
            await this.sendMessage(groupJid, '❌ Apenas o dono do bot pode usar este comando.');
            return;
        }

        if (!msg.key.remoteJid.endsWith('@g.us')) {
            await this.sendMessage(groupJid, '❌ Este comando só pode ser usado em grupos.');
            return;
        }

        const newName = args.join(' ');
        if (!newName) {
            await this.sendMessage(groupJid, '❌ Por favor, forneça um novo nome para o grupo.');
            return;
        }

        try {
            const groupMetadata = await this.sock.groupMetadata(groupJid);

            // Verifica se o bot é administrador do grupo
            const botJid = jidNormalizedUser(this.sock.user.id);
            const botParticipant = groupMetadata.participants.find(p => p.id === botJid);
            const botIsAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';
            const isAdmin = sender.isAdmin || sender.isDono;
            if (!botIsAdmin) {
                await this.sendMessage(groupJid, '❌ Eu preciso ser administrador para mudar o nome do grupo!');
                return;
            }

            await this.sock.groupUpdateSubject(groupJid, newName);
            await this.sendMessage(groupJid, `✅ O nome do grupo foi alterado para: ${newName}`);
        } catch (error) {
            console.error('Erro ao mudar o nome do grupo:', error);
            await this.sendMessage(groupJid, '❌ Ocorreu um erro ao tentar mudar o nome do grupo.');
        }
    }

    async sendMessage(jid, text) {
        await this.sock.sendMessage(jid, { text });
    }
}

module.exports = NomeGpCommand;
