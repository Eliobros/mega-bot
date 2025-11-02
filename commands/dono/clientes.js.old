const fs = require('fs');
const path = require('path');

class ClientesCommand {
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

    async execute(msg, args, from, sender) {
        const config = this.getConfig();
        const prefixo = config.Prefixo || '/';

        if (!from.endsWith('@g.us')) {
            await this.sendMessage(from, '❌ Este comando só funciona em grupos!');
            return;
        }

        try {
            // Obter dados dos usuários
            const usersData = this.dataManager.getUsersData();
            
            if (!usersData.usuarios || Object.keys(usersData.usuarios).length === 0) {
                await this.sendMessage(from, '📊 *Ranking de Clientes*\n\n❌ Ainda não há compradores neste grupo.\n\n💡 Faça sua primeira compra usando o comando `' + prefixo + 'comprar`!');
                return;
            }

            // Processar argumentos para diferentes visualizações
            const argumento = args[0]?.toLowerCase();
            let limite = 10;
            let tipoRanking = 'geral';

            if (argumento === 'top5') {
                limite = 5;
            } else if (argumento === 'top20') {
                limite = 20;
            } else if (argumento === 'hoje') {
                tipoRanking = 'hoje';
            } else if (argumento === 'mes') {
                tipoRanking = 'mes';
            }

            let ranking = [];
            const hoje = new Date().toISOString().split('T')[0];
            const inicioMes = new Date().toISOString().substring(0, 7); // YYYY-MM

            // Criar ranking baseado no tipo solicitado
            if (tipoRanking === 'hoje') {
                ranking = this.getRankingHoje(usersData, hoje);
            } else if (tipoRanking === 'mes') {
                ranking = this.getRankingMes(usersData, inicioMes);
            } else {
                ranking = this.getRankingGeral(usersData);
            }

            // Limitar resultados
            ranking = ranking.slice(0, limite);

            if (ranking.length === 0) {
                let mensagemVazia = '📊 *Ranking de Clientes*\n\n';
                if (tipoRanking === 'hoje') {
                    mensagemVazia += '❌ Nenhuma compra foi feita hoje ainda.';
                } else if (tipoRanking === 'mes') {
                    mensagemVazia += '❌ Nenhuma compra foi feita este mês ainda.';
                } else {
                    mensagemVazia += '❌ Ainda não há compradores cadastrados.';
                }
                await this.sendMessage(from, mensagemVazia);
                return;
            }

            // Montar mensagem do ranking
            const mensagem = this.montarMensagemRanking(ranking, tipoRanking, limite, usersData.estatisticas_grupo, prefixo);
            await this.sendMessage(from, mensagem);

            console.log(`📊 Ranking solicitado: ${tipoRanking} (top ${limite}) - ${ranking.length} resultados`);

        } catch (error) {
            console.error('Erro ao gerar ranking de clientes:', error);
            await this.sendMessage(from, '❌ Erro ao gerar ranking! Tente novamente mais tarde.');
        }
    }

    getRankingGeral(usersData) {
        return Object.entries(usersData.usuarios)
            .map(([jid, userData]) => {
                // CORREÇÃO: Tentar obter o nome real do usuário
                let nomeExibir = userData.nome || userData.numero;
                
                // Se o nome é igual ao número, tentar buscar nome real
                if (nomeExibir === userData.numero || !isNaN(nomeExibir)) {
                    // Tentar usar pushName se disponível
                    if (userData.pushName && userData.pushName !== userData.numero) {
                        nomeExibir = userData.pushName;
                    } else {
                        // Manter só o número se não tiver nome
                        nomeExibir = userData.numero;
                    }
                }

                return {
                    jid,
                    nome: nomeExibir,
                    numero: userData.numero,
                    totalGB: parseFloat(userData.total_gb_acumulado) || 0,
                    totalCompras: userData.total_compras || 0,
                    ultimaCompra: userData.ultima_compra,
                    primeiraCompra: userData.primeira_compra
                };
            })
            .filter(user => user.totalCompras > 0)
            .sort((a, b) => b.totalGB - a.totalGB);
    }

    getRankingHoje(usersData, hoje) {
        return Object.entries(usersData.usuarios)
            .map(([jid, userData]) => {
                const comprasHoje = userData.historico_compras?.filter(compra => 
                    compra.data === hoje
                ) || [];

                const gbHoje = comprasHoje.reduce((total, compra) => 
                    total + (compra.gb || 0), 0
                );

                // CORREÇÃO: Usar mesmo sistema para obter nome
                let nomeExibir = userData.nome || userData.numero;
                if (nomeExibir === userData.numero || !isNaN(nomeExibir)) {
                    if (userData.pushName && userData.pushName !== userData.numero) {
                        nomeExibir = userData.pushName;
                    } else {
                        nomeExibir = userData.numero;
                    }
                }

                return {
                    jid,
                    nome: nomeExibir,
                    numero: userData.numero,
                    totalGB: gbHoje,
                    totalCompras: comprasHoje.length,
                    comprasHoje: comprasHoje.length,
                    ultimaCompra: userData.ultima_compra
                };
            })
            .filter(user => user.totalCompras > 0)
            .sort((a, b) => b.totalGB - a.totalGB);
    }

    getRankingMes(usersData, inicioMes) {
        return Object.entries(usersData.usuarios)
            .map(([jid, userData]) => {
                const comprasMes = userData.historico_compras?.filter(compra => 
                    compra.data.startsWith(inicioMes)
                ) || [];

                const gbMes = comprasMes.reduce((total, compra) => 
                    total + (compra.gb || 0), 0
                );

                // CORREÇÃO: Usar mesmo sistema para obter nome
                let nomeExibir = userData.nome || userData.numero;
                if (nomeExibir === userData.numero || !isNaN(nomeExibir)) {
                    if (userData.pushName && userData.pushName !== userData.numero) {
                        nomeExibir = userData.pushName;
                    } else {
                        nomeExibir = userData.numero;
                    }
                }

                return {
                    jid,
                    nome: nomeExibir,
                    numero: userData.numero,
                    totalGB: gbMes,
                    totalCompras: comprasMes.length,
                    comprasMes: comprasMes.length,
                    ultimaCompra: userData.ultima_compra
                };
            })
            .filter(user => user.totalCompras > 0)
            .sort((a, b) => b.totalGB - a.totalGB);
    }

    montarMensagemRanking(ranking, tipo, limite, estatisticas, prefixo) {
        let mensagem = '';

        // Cabeçalho baseado no tipo
        if (tipo === 'hoje') {
            mensagem += `📊 *RANKING DO DIA*\n`;
            mensagem += `📅 ${new Date().toLocaleDateString('pt-BR')}\n\n`;
        } else if (tipo === 'mes') {
            const nomeMes = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
            mensagem += `📊 *RANKING DO MÊS*\n`;
            mensagem += `📅 ${nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)}\n\n`;
        } else {
            mensagem += `📊 *RANKING GERAL DE CLIENTES*\n`;
            mensagem += `🏆 Top ${Math.min(limite, ranking.length)} Compradores\n\n`;
        }

        // Lista do ranking
        ranking.forEach((cliente, index) => {
            const posicao = index + 1;
            let emoji = '';

            // Emojis para as posições
            if (posicao === 1) emoji = '👑';
            else if (posicao === 2) emoji = '🥈';
            else if (posicao === 3) emoji = '🥉';
            else if (posicao <= 5) emoji = '🏅';
            else emoji = '📍';

            mensagem += `${emoji} *${posicao}º Lugar*\n`;
            mensagem += `👤 ${cliente.nome}\n`;
            mensagem += `📊 ${cliente.totalGB.toFixed(2)}GB`;

            if (tipo === 'hoje') {
                mensagem += ` (${cliente.comprasHoje} compra${cliente.comprasHoje !== 1 ? 's' : ''})`;
            } else if (tipo === 'mes') {
                mensagem += ` (${cliente.comprasMes} compra${cliente.comprasMes !== 1 ? 's' : ''})`;
            } else {
                mensagem += ` (${cliente.totalCompras} compra${cliente.totalCompras !== 1 ? 's' : ''})`;
            }

            mensagem += `\n\n`;
        });

        // Estatísticas do grupo (apenas no ranking geral)
        if (tipo === 'geral' && estatisticas) {
            mensagem += `━━━━━━━━━━━━━━━━\n`;
            mensagem += `📈 *ESTATÍSTICAS DO GRUPO*\n\n`;
            mensagem += `👥 Total de clientes: ${estatisticas.total_usuarios || 0}\n`;
            mensagem += `🛒 Compras realizadas: ${estatisticas.total_compras_realizadas || 0}\n`;
            
            if (estatisticas.maior_comprador) {
                mensagem += `👑 Maior comprador: ${estatisticas.maior_comprador.nome} (${estatisticas.maior_comprador.total_gb}GB)\n`;
            }
            
            mensagem += `📅 Última atualização: ${estatisticas.ultima_atualizacao || 'N/A'}\n\n`;
        }

        // Opções de visualização
        mensagem += `━━━━━━━━━━━━━━━━\n`;
        mensagem += `💡 *Outras opções:*\n`;
        mensagem += `• \`${prefixo}clientes\` - Ranking geral (top 10)\n`;
        mensagem += `• \`${prefixo}clientes top5\` - Top 5 geral\n`;
        mensagem += `• \`${prefixo}clientes top20\` - Top 20 geral\n`;
        mensagem += `• \`${prefixo}clientes hoje\` - Ranking do dia\n`;
        mensagem += `• \`${prefixo}clientes mes\` - Ranking do mês`;

        return mensagem;
    }

    async sendMessage(jid, text, options = {}) {
        try {
            await this.sock.sendMessage(jid, { text, ...options });
        } catch (err) {
            console.error("❌ Erro ao enviar mensagem:", err);
        }
    }
}

module.exports = ClientesCommand;
