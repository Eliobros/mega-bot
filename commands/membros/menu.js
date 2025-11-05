const fs = require("fs");
const path = require("path");
const SetPrefixCommand = require("../dono/setprefix");

class MenuCommand {
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

    // Verificar se usuário é dono
    isDono(senderJid) {
        const config = this.getConfig();
        const donoNumber = config.NumeroDono;
        const senderNumber = senderJid.replace(/@.*/, '');
        return senderNumber === donoNumber;
    }

    // Função para listar comandos de uma pasta
    listarComandos(diretorio, excluir = []) {
        try {
            return fs.readdirSync(diretorio)
                .filter(file => file.endsWith(".js"))
                .map(file => path.basename(file, ".js"))
                .filter(cmd => !excluir.includes(cmd))
                .sort(); // Ordenar alfabeticamente
        } catch (err) {
            console.error(`❌ Erro ao ler comandos de ${diretorio}:`, err);
            return [];
        }
    }

    async execute(msg, args, from, sender, pushname) {
        const prefix = SetPrefixCommand.getCurrentPrefix();
        const ehDono = this.isDono(sender);
        const dataAtual = new Date().toLocaleString("pt-BR", { 
            timeZone: "Africa/Maputo" // Fuso horário de Moçambique
        });

        let groupName = "Privado";
        let participantes = 1;

        // Obter informações do grupo
        if (from && from.endsWith("@g.us")) {
            try {
                const metadata = await this.sock.groupMetadata(from);
                groupName = metadata.subject || "Grupo sem nome";
                participantes = metadata.participants.length;
            } catch (err) {
                console.error("❌ Erro ao obter metadados do grupo:", err);
            }
        }

        try {
            // Listar comandos
            const comandosMembros = this.listarComandos(
                path.join(__dirname, "../membros"), 
                ["menu"] // Excluir o próprio menu
            );
            
            const comandosDono = ehDono ? this.listarComandos(
                path.join(__dirname, "../dono"), 
                ["setprefix"] // Excluir setprefix se quiser
            ) : [];

            // Montar o menu
            let menu = `┏╼࡙ᷓ✿࡙╾ᷓ╼֡͜💙⃘໋ᩚ᳕֓╾╼࡙ᷓ✿࡙╾ᷓ┓
な ⃟̸̷᪺͓͡👤 Usuário: @${pushname}
👥 Grupo: ${groupName}
📅 Data: ${dataAtual}
👥 Participantes: ${participantes}
📌 Prefixo: ${prefix}
┗┮✿࡙╾ᷓ╼֡͜💙⃘໋ᩚ᳕֓╾╼࡙ᷓ✿࡙╼┛\n\n`;

            // Comandos de membros
            if (comandosMembros.length > 0) {
                menu += `╭╌❅̸╌═⊱≈『💙 COMANDOS MEMBROS』≈⊰═╌❅̸╌╮\n`;
                menu += `   ╭╌❅̸╌═⊱≈\n`;
                comandosMembros.forEach(cmd => {
                    menu += `╎║💙ꪾ〬ꩌ۪${prefix}${cmd}\n`;
                });
                menu += `   ╰╌❅̸╌═⊱≈\n`;
                menu += `╰╌❅̸╌═⊱≈『💙』≈⊰═╌❅̸╌╯\n\n`;
            }

            // Comandos de dono (apenas se for dono)
            if (ehDono && comandosDono.length > 0) {
                menu += `╭╌❅̸╌═⊱≈『👑 COMANDOS DONO』≈⊰═╌❅̸╌╮\n`;
                menu += `   ╭╌❅̸╌═⊱≈\n`;
                comandosDono.forEach(cmd => {
                    menu += `╎║👑ꪾ〬ꩌ۪${prefix}${cmd}\n`;
                });
                menu += `   ╰╌❅̸╌═⊱≈\n`;
                menu += `╰╌❅̸╌═⊱≈『👑』≈⊰═╌❅̸╌╯\n\n`;
            }

            // Rodapé
            menu += `━━━━━━━━━━━━━━━━\n`;
            menu += `💡 Use ${prefix}ajuda <comando> para detalhes\n`;
            menu += `📊 Total: ${comandosMembros.length + (ehDono ? comandosDono.length : 0)} comandos`;

            // Enviar menu citando a mensagem original e mencionando o usuário
            await this.sock.sendMessage(from, { 
                text: menu,
                mentions: [sender]
            }, { 
                quoted: msg 
            });

            console.log(`📋 Menu enviado para ${pushname} no grupo ${groupName}`);

        } catch (error) {
            console.error('❌ Erro ao gerar menu:', error);
            await this.sock.sendMessage(from, { 
                text: '❌ Erro ao carregar o menu! Tente novamente.' 
            });
        }
    }
}

module.exports = MenuCommand;
