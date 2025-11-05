const fs = require('fs');
const path = require('path');

class MigrarGrupoCommand {
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

    isDono(senderJid) {
        const config = this.getConfig();
        const donoNumber = config.NumeroDono;
        const senderNumber = senderJid.replace(/@.*/, '');
        return senderNumber === donoNumber;
    }

    async execute(msg, args, from, sender) {
        // Só o dono pode usar
        if (!this.isDono(sender)) {
            await this.sock.sendMessage(from, { 
                text: '❌ Apenas o dono pode usar este comando!' 
            });
            return;
        }

        try {
            // Pega ID do grupo de origem
            const grupoOrigemId = args[0];

            if (!grupoOrigemId || !grupoOrigemId.endsWith('@g.us')) {
                await this.sock.sendMessage(from, { 
                    text: `❌ *Como usar:*\n\n1. Entre no grupo ANTIGO\n2. Digite !grupoId e copie o ID\n3. Volte pro grupo NOVO\n4. Digite: !migrargrupo [ID_copiado]\n\n*Exemplo:*\n!migrargrupo 120363422120220952@g.us` 
                });
                return;
            }

            await this.sock.sendMessage(from, { 
                text: '⏳ Buscando membros do grupo antigo...' 
            });

            // Pega metadata do grupo antigo
            const grupoAntigo = await this.sock.groupMetadata(grupoOrigemId);
            
            // Filtra membros (remove bots e você mesmo)
            const botNumber = this.sock.user.id.split(':')[0] + '@s.whatsapp.net';
            const membros = grupoAntigo.participants
                .map(p => p.id)
                .filter(id => id !== botNumber && id !== sender); // Remove bot e dono

            if (membros.length === 0) {
                await this.sock.sendMessage(from, { 
                    text: '❌ Nenhum membro encontrado no grupo antigo!' 
                });
                return;
            }

            await this.sock.sendMessage(from, { 
                text: `📊 *Encontrados ${membros.length} membros!*\n\n⏳ Iniciando migração...\n\n⚠️ Isso pode levar alguns minutos.` 
            });

            // Adiciona em lotes de 15 (mais seguro)
            const lotes = [];
            for (let i = 0; i < membros.length; i += 15) {
                lotes.push(membros.slice(i, i + 15));
            }

            let adicionados = 0;
            let erros = 0;
            let errorDetails = [];

            for (let i = 0; i < lotes.length; i++) {
                const lote = lotes[i];
                
                try {
                    const resultado = await this.sock.groupParticipantsUpdate(
                        from, // Grupo atual (novo)
                        lote,
                        'add'
                    );

                    // Conta sucessos e erros
                    resultado.forEach(r => {
                        if (r.status === '200') {
                            adicionados++;
                        } else {
                            erros++;
                            errorDetails.push(r);
                        }
                    });
                    
                    // Atualiza progresso
                    await this.sock.sendMessage(from, { 
                        text: `✅ Lote ${i + 1}/${lotes.length} processado\n📊 ${adicionados} adicionados, ${erros} erros` 
                    });

                    // Delay entre lotes (evitar ban do WhatsApp)
                    if (i < lotes.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 4000));
                    }

                } catch (err) {
                    console.error('❌ Erro ao adicionar lote:', err);
                    erros += lote.length;
                }
            }

            // Relatório final
            let relatorio = `
🎉 *MIGRAÇÃO CONCLUÍDA!*

━━━━━━━━━━━━━━━━
📊 *ESTATÍSTICAS:*

✅ Adicionados: ${adicionados}
❌ Erros: ${erros}
📋 Total processados: ${membros.length}
━━━━━━━━━━━━━━━━
`;

            if (erros > 0) {
                relatorio += `\n⚠️ *Motivos dos erros:*\n`;
                relatorio += `- Configurações de privacidade\n`;
                relatorio += `- Usuário bloqueou o número\n`;
                relatorio += `- Número inválido/desativado\n\n`;
                relatorio += `💡 Esses membros devem entrar manualmente.`;
            } else {
                relatorio += `\n✅ Todos os membros foram adicionados com sucesso!`;
            }

            await this.sock.sendMessage(from, { text: relatorio });

            console.log(`✅ Migração concluída: ${adicionados} adicionados, ${erros} erros`);

        } catch (error) {
            console.error('❌ Erro na migração:', error);
            await this.sock.sendMessage(from, { 
                text: `❌ *Erro ao migrar grupo!*\n\n${error.message}\n\nVerifique os logs para mais detalhes.` 
            });
        }
    }
}

module.exports = MigrarGrupoCommand;
