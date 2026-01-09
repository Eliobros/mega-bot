class CommandRouter {
    constructor(sock, dataManager, commands) {
        this.sock = sock;
        this.dataManager = dataManager;
        this.commands = commands;
    }

    async routePublicCommand(msg, messageText, from, sender) {
        const donoData = this.dataManager.getDonoData();
        const PREFIX = donoData.Prefixo || '!';

        let cmdText = messageText.trim();

        // Remove prefixo
        if (cmdText.startsWith(PREFIX)) {
            cmdText = cmdText.slice(PREFIX.length).trim();
        } else if (cmdText.startsWith('/')) {
            cmdText = cmdText.slice(1).trim();
        } else {
            return false; // Não é comando
        }

        const parts = cmdText.split(/\s+/);
        const cmd = parts[0].toLowerCase();
        const args = parts.slice(1);

        console.log('📍 Comando público:', cmd);

        switch (cmd) {
            case 'menu':
            case 'ajuda':
            case 'help':
                await this.commands.menuCommand.execute(msg, args, from, sender);
                return true;

            case 'ping':
                await this.commands.pingCommand.execute(from);
                return true;

            case 'tabela':
                await this.commands.tabelaCommand.execute(msg, from, sender);
                return true;

            case 'tiktok':
                await this.commands.tiktokCommand.execute(msg, args, from, sender);
                return true;

            case 'me':
                await this.commands.infoCommand.execute(msg, [], from, sender, false);
                return true;

            case 'dono':
                const dono = this.dataManager.getDonoData();
                await this.sock.sendMessage(from, {
                    text: `👨‍💼 Dono: ${dono.NickDono}\n📞 Número: +${dono.NumeroDono}`
                });
                return true;

            default:
                await this.sock.sendMessage(from, {
                    text: `❌ Comando não reconhecido. Digite ${PREFIX}help para ver os comandos.`
                });
                return true;
        }
    }

    async routeDonoCommand(msg, messageText, from, sender) {
        // TODO: Implementar roteamento de comandos de dono
        // (Mover a lógica do handleDonoCommand pra cá)
        return false;
    }
}

module.exports = CommandRouter;
