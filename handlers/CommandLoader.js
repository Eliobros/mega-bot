const fs = require('fs');
const path = require('path');

/**
 * CommandLoader - Sistema de carregamento automático de comandos
 * 
 * Estrutura:
 * commands/
 *   ├── dono/      → Comandos apenas para o dono
 *   ├── membros/   → Comandos para todos os usuários
 *   └── vips/      → Comandos para usuários VIP
 */
class CommandLoader {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;
        this.commands = new Map();
        this.aliases = new Map();
        
        // Diretório de comandos
        this.commandsDir = path.join(__dirname, '..',  'commands');
        
        // Carregar todos os comandos
        this.loadAllCommands();
        
        console.log(`✅ CommandLoader: ${this.commands.size} comandos carregados`);
    }

    /**
     * Carrega comandos das pastas: dono, membros, vips
     */
    loadAllCommands() {
        try {
            if (!fs.existsSync(this.commandsDir)) {
                console.warn('⚠️ Pasta commands/ não encontrada');
                return;
            }

            const categories = ['dono', 'admins', 'membros', 'vips'];

            for (const category of categories) {
                const categoryPath = path.join(this.commandsDir, category);
                
                if (fs.existsSync(categoryPath)) {
                    this.loadCommandsFromCategory(category);
                }
            }

        } catch (error) {
            console.error('❌ Erro ao carregar comandos:', error);
        }
    }

    /**
     * Carrega comandos de uma categoria
     */

    loadCommandsFromCategory(category) {
        const categoryPath = path.join(this.commandsDir, category);
        
        try {
            const files = fs.readdirSync(categoryPath)
                .filter(file => file.endsWith('.js'));

            console.log(`📂 ${category}/: ${files.length} arquivos`);

            for (const file of files) {
                this.loadCommand(category, file);
            }

        } catch (error) {
            console.error(`❌ Erro ao carregar ${category}:`, error);
        }
    }

   /**
 * Carrega um comando específico
 */
/*
loadCommand(category, filename) {
    try {
        const filePath = path.join(this.commandsDir, category, filename);
        
        // Limpar cache
        delete require.cache[require.resolve(filePath)];
        
        const CommandModule = require(filePath);
        let command;

        // ========== SUPORTE PARA DOIS FORMATOS ==========
        
        // FORMATO NOVO (Classe)
        if (typeof CommandModule === 'function' && CommandModule.prototype.execute) {
            command = new CommandModule(this.sock, this.dataManager);
        }
        // FORMATO ANTIGO (Função direta)
        else if (typeof CommandModule === 'function') {
            // Criar um wrapper para comandos antigos
            const commandName = filename.replace('.js', '');
            command = {
                name: commandName,
                description: 'Comando legado',
                aliases: [],
                execute: async (msg, args, from, sender) => {
                    // Executar função antiga
                    await CommandModule(this.sock, msg, args);
                }
            };
        }
        // FORMATO OBJETO (exportação direta)
        else if (typeof CommandModule === 'object' && CommandModule.execute) {
            command = CommandModule;
            command.sock = this.sock;
            command.dataManager = this.dataManager;
        }
        else {
            console.warn(`⚠️ ${filename} em formato não reconhecido`);
            return;
        }

        // Validar
        if (!command.name || typeof command.execute !== 'function') {
            console.warn(`⚠️ ${filename} inválido (sem name ou execute)`);
            return;
        }

        // Registrar comando
        this.commands.set(command.name.toLowerCase(), {
            command,
            category,
            filename
        });

        // Registrar aliases
        if (command.aliases && Array.isArray(command.aliases)) {
            for (const alias of command.aliases) {
                this.aliases.set(alias.toLowerCase(), command.name.toLowerCase());
            }
        }

        console.log(`  ✅ ${command.name}`);

    } catch (error) {
        console.error(`❌ ${category}/${filename}:`, error.message);
    }
}
*/


    /**
 * Carrega um comando específico
 */
loadCommand(category, filename) {
    try {
        const filePath = path.join(this.commandsDir, category, filename);
        
        // Limpar cache
        delete require.cache[require.resolve(filePath)];
        
        const CommandModule = require(filePath);
        let command;

        // ========== SUPORTE PARA DOIS FORMATOS ==========
        
        // FORMATO NOVO (Classe)
        if (typeof CommandModule === 'function' && CommandModule.prototype.execute) {
            command = new CommandModule(this.sock, this.dataManager);
            
            // 🆕 Se não tiver name, extrair do nome do arquivo
            if (!command.name) {
                command.name = filename.replace('.js', '');
            }
            
            // 🆕 Se não tiver description, usar padrão
            if (!command.description) {
                command.description = 'Sem descrição';
            }
            
            // 🆕 Se não tiver aliases, criar array vazio
            if (!command.aliases) {
                command.aliases = [];
            }
        }
        // FORMATO ANTIGO (Função direta)
        else if (typeof CommandModule === 'function') {
            // Criar um wrapper para comandos antigos
            const commandName = filename.replace('.js', '');
            command = {
                name: commandName,
                description: 'Comando legado',
                aliases: [],
                execute: async (msg, args, from, sender) => {
                    // Executar função antiga
                    await CommandModule(this.sock, msg, args);
                }
            };
        }
        // FORMATO OBJETO (exportação direta)
        else if (typeof CommandModule === 'object' && CommandModule.execute) {
            command = CommandModule;
            command.sock = this.sock;
            command.dataManager = this.dataManager;
            
            // 🆕 Se não tiver name, extrair do nome do arquivo
            if (!command.name) {
                command.name = filename.replace('.js', '');
            }
        }
        else {
            console.warn(`⚠️ ${filename} em formato não reconhecido`);
            return;
        }

        // Validar
        if (!command.name || typeof command.execute !== 'function') {
            console.warn(`⚠️ ${filename} inválido (sem name ou execute)`);
            return;
        }

        // Registrar comando
        this.commands.set(command.name.toLowerCase(), {
            command,
            category,
            filename
        });

        // Registrar aliases
        if (command.aliases && Array.isArray(command.aliases)) {
            for (const alias of command.aliases) {
                this.aliases.set(alias.toLowerCase(), command.name.toLowerCase());
            }
        }

        console.log(`  ✅ ${command.name}`);

    } catch (error) {
        console.error(`❌ ${category}/${filename}:`, error.message);
    }
}
    /**
     * Executa um comando
     */
    async executeCommand(commandName, msg, args, from, sender) {
        try {
            const normalizedName = commandName.toLowerCase();
            const actualName = this.aliases.get(normalizedName) || normalizedName;
            const commandData = this.commands.get(actualName);

            if (!commandData) {
                return false; // Comando não encontrado
            }

            const { command, category } = commandData;

            console.log(`🎮 ${command.name} (${category})`);

            // ========== VERIFICAR PERMISSÕES ==========

            // ========== VERIFICAÇÃO DONO (AUTOMÁTICA POR PASTA) ==========
            // Se o comando está na pasta dono/, verificar dono automaticamente
            if (category === 'dono' && !this.isDono(sender)) {
                await this.sock.sendMessage(from, {
                    text: '👑 *COMANDO DO DONO* 👑\n\n' +
                          '⛔ Apenas o dono do bot pode usar este comando.\n\n' +
                          '💡 Este é um comando administrativo exclusivo.'
                });
                return true;
            }

            // Apenas DONO (verificação manual caso comando tenha onlyDono)
            if (command.onlyDono && !this.isDono(sender)) {
                await this.sock.sendMessage(from, {
                    text: '⛔ Apenas o dono pode usar este comando.'
                });
                return true;
            }

            // Apenas ADMIN
            if (command.onlyAdmin && !await this.isAdmin(from, sender)) {
                await this.sock.sendMessage(from, {
                    text: '⛔ Apenas administradores podem usar este comando.'
                });
                return true;
            }

            // Apenas GRUPO
            if (command.onlyGroup && !from.endsWith('@g.us')) {
                await this.sock.sendMessage(from, {
                    text: '⛔ Este comando só funciona em grupos.'
                });
                return true;
            }

            // ========== VERIFICAÇÃO VIP (AUTOMÁTICA POR PASTA) ==========
            // Se o comando está na pasta vips/, verificar VIP automaticamente
            if (category === 'vips' && !this.isVip(sender)) {
                const vipData = this.dataManager.getVipData(sender);
                
                let message = '⭐ *COMANDO VIP* ⭐\n\n';
                message += '❌ Este comando é exclusivo para usuários VIP.\n\n';
                
                if (vipData && !vipData.active) {
                    // VIP expirado
                    const endDate = new Date(vipData.endDate).toLocaleDateString('pt-BR');
                    message += `⚠️ Seu VIP expirou em ${endDate}.\n\n`;
                }
                
                message += '💡 *Como se tornar VIP:*\n';
                message += '• Entre em contato com o dono\n';
                message += '• Acesso a comandos exclusivos\n';
                message += '• Prioridade no atendimento\n\n';
                message += '📞 Use *!dono* para contato';

                await this.sock.sendMessage(from, { text: message });
                return true;
            }

            // ========== EXECUTAR COMANDO ==========
            await command.execute(msg, args, from, sender);

            return true;

        } catch (error) {
            console.error(`❌ Erro ao executar ${commandName}:`, error);
            
            try {
                await this.sock.sendMessage(from, {
                    text: `⚠️ Erro ao executar comando: ${error.message}`
                });
            } catch (e) {
                // Silencioso
            }

            return true;
        }
    }

    /**
     * Verifica se é dono
     */
    isDono(sender) {
        const donoData = this.dataManager.getDonoData();
        const senderNumber = sender.replace(/(@s\.whatsapp\.net|@lid|@c\.us)/g, '').split('@')[0];
        const donoNumber = donoData.NumeroDono.replace(/\D/g, '');
        
        return senderNumber === donoNumber;
    }

    /**
     * Verifica se é admin do grupo
     */
    async isAdmin(groupJid, userJid) {
        try {
            if (!groupJid.endsWith('@g.us')) return false;

            const groupMetadata = await this.sock.groupMetadata(groupJid);
            const participant = groupMetadata.participants.find(p => p.id === userJid);

            return participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
        } catch (error) {
            return false;
        }
    }

    /**
     * Verifica se é VIP
     * 🆕 Atualizado para usar o DataManager
     */
    isVip(sender) {
        return this.dataManager.isVip(sender);
    }

    /**
     * Lista todos os comandos
     */
    getCommands() {
        return Array.from(this.commands.entries()).map(([name, data]) => ({
            name,
            category: data.category,
            description: data.command.description || 'Sem descrição',
            aliases: data.command.aliases || []
        }));
    }

    /**
     * Lista comandos por categoria
     */
    getCommandsByCategory() {
        const categorized = {
            dono: [],
            membros: [],
            vips: []
        };

        for (const [name, data] of this.commands.entries()) {
            categorized[data.category].push({
                name,
                description: data.command.description || 'Sem descrição',
                aliases: data.command.aliases || []
            });
        }

        return categorized;
    }

    /**
     * Lista comandos disponíveis para um usuário específico
     * 🆕 Novo método
     */
    getCommandsForUser(sender) {
        const isDono = this.isDono(sender);
        const isVip = this.isVip(sender);
        
        const available = {
            membros: [],
            vips: [],
            dono: []
        };

        for (const [name, data] of this.commands.entries()) {
            const cmd = {
                name,
                description: data.command.description || 'Sem descrição',
                usage: data.command.usage || `!${name}`,
                aliases: data.command.aliases || []
            };

            // Comandos de membros (todos podem ver)
            if (data.category === 'membros') {
                available.membros.push(cmd);
            }

            // Comandos VIP (só VIPs e dono podem ver)
            if (data.category === 'vips' && (isVip || isDono)) {
                available.vips.push(cmd);
            }

            // Comandos dono (só dono pode ver)
            if (data.category === 'dono' && isDono) {
                available.dono.push(cmd);
            }
        }

        return available;
    }

    /**
     * Gera mensagem de help personalizada
     * 🆕 Novo método
     */
    getHelpMessage(sender, prefix = '!') {
        const isDono = this.isDono(sender);
        const isVip = this.isVip(sender);
        const commands = this.getCommandsForUser(sender);

        let message = '📚 *MENU DE COMANDOS* 📚\n\n';

        // Comandos para Membros
        if (commands.membros.length > 0) {
            message += '👥 *COMANDOS GERAIS:*\n';
            commands.membros.forEach(cmd => {
                message += `• ${prefix}${cmd.name}`;
                if (cmd.aliases.length > 0) {
                    message += ` (${cmd.aliases.map(a => prefix + a).join(', ')})`;
                }
                message += `\n  ↳ ${cmd.description}\n`;
            });
            message += '\n';
        }

        // Comandos VIP
        if (commands.vips.length > 0) {
            message += '⭐ *COMANDOS VIP:*\n';
            commands.vips.forEach(cmd => {
                message += `• ${prefix}${cmd.name}`;
                if (cmd.aliases.length > 0) {
                    message += ` (${cmd.aliases.map(a => prefix + a).join(', ')})`;
                }
                message += `\n  ↳ ${cmd.description}\n`;
            });
            message += '\n';
        }

        // Comandos do Dono
        if (commands.dono.length > 0) {
            message += '👑 *COMANDOS DO DONO:*\n';
            commands.dono.forEach(cmd => {
                message += `• ${prefix}${cmd.name}`;
                if (cmd.aliases.length > 0) {
                    message += ` (${cmd.aliases.map(a => prefix + a).join(', ')})`;
                }
                message += `\n  ↳ ${cmd.description}\n`;
            });
            message += '\n';
        }

        // Rodapé
        message += '━━━━━━━━━━━━━━━\n';
        message += `📊 Total: ${commands.membros.length + commands.vips.length + commands.dono.length} comandos\n`;
        
        if (!isVip && !isDono) {
            message += '\n⭐ Quer acesso VIP? Use *!dono*';
        }

        return message;
    }

    /**
     * Recarrega comandos (útil em desenvolvimento)
     */
    reload() {
        console.log('🔄 Recarregando comandos...');
        this.commands.clear();
        this.aliases.clear();
        this.loadAllCommands();
        console.log(`✅ ${this.commands.size} comandos recarregados`);
    }

    /**
     * Obtém informações de um comando específico
     * 🆕 Novo método
     */
    getCommandInfo(commandName) {
        const normalizedName = commandName.toLowerCase();
        const actualName = this.aliases.get(normalizedName) || normalizedName;
        const commandData = this.commands.get(actualName);

        if (!commandData) {
            return null;
        }

        const { command, category } = commandData;

        return {
            name: command.name,
            aliases: command.aliases || [],
            description: command.description || 'Sem descrição',
            usage: command.usage || `!${command.name}`,
            category: category,
            onlyDono: command.onlyDono || false,
            onlyAdmin: command.onlyAdmin || false,
            onlyGroup: command.onlyGroup || false,
            onlyVip: category === 'vips'
        };
    }
}

module.exports = CommandLoader;

