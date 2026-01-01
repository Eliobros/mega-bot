const fs = require("fs");
const path = require("path");

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
            return { Prefixo: '!', NumeroDono: '' };
        }
    }

    getPrefix() {
        const config = this.getConfig();
        return config.Prefixo || '!';
    }

    // Verificar se usuário é dono
    isDono(senderJid) {
        const donoData = this.dataManager.getDonoData();
        const donoNumber = donoData.NumeroDono.replace(/\D/g, '');
        const senderNumber = senderJid.replace(/\D/g, '').split('@')[0];
        
        return senderNumber === donoNumber ||
               senderNumber.includes(donoNumber) ||
               donoNumber.includes(senderNumber);
    }

    // Função para listar comandos de uma pasta
    listarComandos(diretorio, excluir = []) {
        try {
            if (!fs.existsSync(diretorio)) {
                console.log(`⚠️ Diretório não existe: ${diretorio}`);
                return [];
            }

            return fs.readdirSync(diretorio)
                .filter(file => file.endsWith(".js"))
                .map(file => path.basename(file, ".js"))
                .filter(cmd => !excluir.includes(cmd))
                .sort();
        } catch (err) {
            console.error(`❌ Erro ao ler comandos de ${diretorio}:`, err);
            return [];
        }
    }

    async execute(msg, args, from, senderJid) {
        console.log('\n========== MENU COMMAND ==========');
        console.log('📱 From:', from);
        console.log('👤 Sender:', senderJid);
        console.log('==================================\n');

        const prefix = this.getPrefix();
        const ehDono = this.isDono(senderJid);
        
        // Extrair pushname e número
        const pushname = msg.pushName || 'Usuário';
        const senderNumber = senderJid.replace(/@.*/, '');

        const dataAtual = new Date().toLocaleString("pt-BR", {
            timeZone: "Africa/Maputo"
        });

        let groupName = "Privado";
        let participantes = 1;
        let isGroup = false;

        // Obter informações do grupo
        if (from && from.endsWith("@g.us")) {
            isGroup = true;
            try {
                const metadata = await this.sock.groupMetadata(from);
                groupName = metadata.subject || "Grupo sem nome";
                participantes = metadata.participants.length;
            } catch (err) {
                console.error("❌ Erro ao obter metadados do grupo:", err);
                groupName = "Grupo";
            }
        }

        try {
            // Listar comandos
            const comandosMembros = this.listarComandos(
                path.join(__dirname, "../membros"),
                ["menu"] // Excluir o próprio menu
            );

            const comandosAdmin = this.listarComandos(
                path.join(__dirname, "../admin")
            );

            const comandosDono = this.listarComandos(
                path.join(__dirname, "../dono")
            );

            console.log(`📋 Comandos encontrados:`);
            console.log(`- Membros: ${comandosMembros.length}`);
            console.log(`- Admin: ${comandosAdmin.length}`);
            console.log(`- Dono: ${comandosDono.length}`);

            // ===== MONTAR MENU =====
            let menu = `╭━━━━━━━━━━━━━━━━━━━╮\n`;
            menu += `│   🤖 *TINA BOT MENU*\n`;
            menu += `╰━━━━━━━━━━━━━━━━━━━╯\n\n`;

            // Informações do usuário
            menu += `┏━━━ ⊱ 👤 *USUÁRIO* ⊰ ━━━┓\n`;
            menu += `│ 📛 Nome: ${pushname}\n`;
            menu += `│ 📱 Número: +${senderNumber}\n`;
            menu += `│ 👑 Status: ${ehDono ? 'DONO' : 'Membro'}\n`;
            menu += `┗━━━━━━━━━━━━━━━━━━━┛\n\n`;

            // Informações do grupo/chat
            menu += `┏━━━ ⊱ 💬 *LOCAL* ⊰ ━━━┓\n`;
            menu += `│ 📝 ${isGroup ? 'Grupo' : 'Chat'}: ${groupName}\n`;
            if (isGroup) {
                menu += `│ 👥 Membros: ${participantes}\n`;
            }
            menu += `│ 📅 Data: ${dataAtual}\n`;
            menu += `│ ⚙️ Prefixo: ${prefix}\n`;
            menu += `┗━━━━━━━━━━━━━━━━━━━┛\n\n`;

            // Comandos de MEMBROS
            if (comandosMembros.length > 0) {
                menu += `╭━━━ ⊱ 👥 *COMANDOS MEMBROS* ⊰ ━━━╮\n`;
                comandosMembros.forEach((cmd, index) => {
                    menu += `│ ${(index + 1).toString().padStart(2, '0')}. ${prefix}${cmd}\n`;
                });
                menu += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n`;
            }

            // Comandos de ADMIN (se houver)
            if (comandosAdmin.length > 0) {
                menu += `╭━━━ ⊱ 👮 *COMANDOS ADMIN* ⊰ ━━━╮\n`;
                comandosAdmin.forEach((cmd, index) => {
                    menu += `│ ${(index + 1).toString().padStart(2, '0')}. ${prefix}${cmd}\n`;
                });
                menu += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n`;
            }

            // Comandos de DONO (apenas se for dono)
            if (ehDono && comandosDono.length > 0) {
                menu += `╭━━━ ⊱ 👑 *COMANDOS DONO* ⊰ ━━━╮\n`;
                comandosDono.forEach((cmd, index) => {
                    menu += `│ ${(index + 1).toString().padStart(2, '0')}. ${prefix}${cmd}\n`;
                });
                menu += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n`;
            }

            // Rodapé
            const totalComandos = comandosMembros.length + 
                                 comandosAdmin.length + 
                                 (ehDono ? comandosDono.length : 0);

            menu += `╭━━━━━━━━━━━━━━━━━━━╮\n`;
            menu += `│ 💡 *DICA*\n`;
            menu += `│ Use ${prefix}ajuda <comando>\n`;
            menu += `│ para ver detalhes\n`;
            menu += `├━━━━━━━━━━━━━━━━━━━┤\n`;
            menu += `│ 📊 Total: ${totalComandos} comandos\n`;
            menu += `│ 🤖 Tina Bot v2.0\n`;
            menu += `╰━━━━━━━━━━━━━━━━━━━╯`;

            // Enviar menu
            await this.sock.sendMessage(from, {
                text: menu,
                mentions: [senderJid]
            }, {
                quoted: msg
            });

            console.log(`✅ Menu enviado para ${pushname} (${isGroup ? groupName : 'privado'})`);

        } catch (error) {
            console.error('❌ Erro ao gerar menu:', error);
            await this.sock.sendMessage(from, {
                text: '❌ Erro ao carregar o menu! Tente novamente.'
            });
        }
    }

    // Método para enviar mensagem (compatibilidade)
    async sendMessage(jid, text, options = {}) {
        try {
            await this.sock.sendMessage(jid, { text, ...options });
        } catch (err) {
            console.error("❌ Erro ao enviar mensagem:", err);
        }
    }
}

module.exports = MenuCommand;
