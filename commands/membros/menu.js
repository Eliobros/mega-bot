const fs = require("fs");
const path = require("path");
const SetPrefixCommand = require("../dono/setprefix");

class MenuCommand {
    constructor(sock) {
        this.sock = sock;
    }

    async execute(msg, args) {
        const sender = msg.pushName || "Usuário";
        const prefix = SetPrefixCommand.getCurrentPrefix();

        const dataAtual = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

        let groupName = "Privado";
        let participantes = 1;

        if (msg.key.remoteJid && msg.key.remoteJid.endsWith("@g.us")) {
            try {
                const metadata = await this.sock.groupMetadata(msg.key.remoteJid);
                groupName = metadata.subject || "Grupo sem nome";
                participantes = metadata.participants.length;
            } catch (err) {
                console.error("Erro ao obter metadados do grupo:", err);
            }
        }

        // Função para listar comandos de uma pasta
        function listarComandos(diretorio, excluir = []) {
            try {
                return fs.readdirSync(diretorio)
                    .filter(file => file.endsWith(".js"))
                    .map(file => path.basename(file, ".js"))
                    .filter(cmd => !excluir.includes(cmd));
            } catch {
                return [];
            }
        }

        const comandosDono = listarComandos(path.join(__dirname, "../dono"), ["setprefix"]);
        const comandosMembros = listarComandos(path.join(__dirname, "../membros"), ["menu"]);

        // Monta o menu
        let menu = `
┏━╌❅『💙』❅╌━┓
👤 Usuário: @${sender}
👥 Grupo: ${groupName}
📅 Data: ${dataAtual}
👥 Participantes: ${participantes}
📌 Prefixo atual: ${prefix}
┗━╌❅『💙』❅╌━┛

╭╌❅╌═⊱『MENU DONO』⊰═╌❅╌╮
${comandosDono.map(cmd => `╎💙 ${prefix}${cmd}`).join("\n")}
╰╌❅╌═══════════════╌❅╌╯

╭╌❅╌═⊱『MENU MEMBROS』⊰═╌❅╌╮
${comandosMembros.map(cmd => `╎💙 ${prefix}${cmd}`).join("\n")}
╰╌❅╌═══════════════╌❅╌╯
`;

        try {
            // Envia citando a mensagem original
            await this.sock.sendMessage(
                msg.key.remoteJid || msg.from,
                { text: menu },
                { quoted: msg }
            );
        } catch (err) {
            console.error("Erro ao enviar menu:", err);
            // fallback: envia sem citar
            await this.sock.sendMessage(msg.key.remoteJid || msg.from, { text: menu });
        }
    }
}

module.exports = MenuCommand;
