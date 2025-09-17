class StatsCommand {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;
    }

    async execute(jid) {
        const usersData = this.dataManager.getUsersData();
        const usuarios = usersData.users || [];

        // Estatísticas calculadas
        const totalUsuarios = usuarios.length;
        const totalCompras = usuarios.reduce((sum, u) => sum + (u.total_compras || 0), 0);
        const totalComprovantes = usersData.comprovantes_utilizados.length;

        // Maior comprador
        let maiorComprador = null;
        if (usuarios.length > 0) {
            maiorComprador = usuarios.reduce(
                (max, u) => (u.total_gb_acumulado > (max?.total_gb_acumulado || 0) ? u : max),
                null
            );
        }

        let mensagem = `📊 *ESTATÍSTICAS DO GRUPO*\n\n`;
        mensagem += `👥 Total de usuários: ${totalUsuarios}\n`;
        mensagem += `🛒 Total de compras: ${totalCompras}\n`;
        mensagem += `🧾 Comprovantes processados: ${totalComprovantes}\n\n`;

        if (maiorComprador) {
            mensagem += `🏆 *MAIOR COMPRADOR*\n`;
            mensagem += `📱 ${maiorComprador.nome}\n`;
            mensagem += `📊 ${maiorComprador.total_gb_acumulado.toFixed(2)}GB acumulados\n\n`;
        }

        // Top 5 compradores
        const topCompradores = usuarios
            .sort((a, b) => b.total_gb_acumulado - a.total_gb_acumulado)
            .slice(0, 5);

        if (topCompradores.length > 0) {
            mensagem += `🥇 *TOP 5 COMPRADORES*\n`;
            topCompradores.forEach((user, index) => {
                const emoji = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][index];
                mensagem += `${emoji} ${user.nome}: ${user.total_gb_acumulado.toFixed(2)}GB\n`;
            });
            mensagem += `\n`;
        }

        // Estatísticas de hoje
        const hoje = new Date().toISOString().split('T')[0];
        const comprasHoje = usuarios.reduce((total, user) => {
            return total + (user.ultima_compra === hoje ? (user.compras_hoje || 0) : 0);
        }, 0);

        const comprovantesHoje = usersData.comprovantes_utilizados.filter(comp => {
            const dataComp = new Date(comp.data_uso).toISOString().split('T')[0];
            return dataComp === hoje;
        }).length;

        mensagem += `📅 *ESTATÍSTICAS DE HOJE*\n`;
        mensagem += `🛒 Compras hoje: ${comprasHoje}\n`;
        mensagem += `🧾 Comprovantes hoje: ${comprovantesHoje}\n\n`;

        // Resumo de tipos de pacotes mais vendidos
        const tiposVendidos = this.calcularTiposMaisVendidos(usuarios);
        if (tiposVendidos.length > 0) {
            mensagem += `📈 *PACOTES MAIS VENDIDOS*\n`;
            tiposVendidos.slice(0, 3).forEach((tipo, index) => {
                const emoji = ['🔥', '⚡', '💫'][index];
                mensagem += `${emoji} ${tipo.tipo}: ${tipo.count} vendas\n`;
            });
            mensagem += `\n`;
        }

        mensagem += `🕐 *Última atualização:* ${new Date().toLocaleString('pt-BR', { hour12: false })}`;

        await this.sendMessage(jid, mensagem);
    }

    calcularTiposMaisVendidos(usuarios) {
        const contadorTipos = {};

        usuarios.forEach(user => {
            user.historico_compras?.forEach(compra => {
                const key = compra.pacote;
                contadorTipos[key] = (contadorTipos[key] || 0) + 1;
            });
        });

        return Object.entries(contadorTipos)
            .map(([tipo, count]) => ({ tipo, count }))
            .sort((a, b) => b.count - a.count);
    }

    async sendMessage(jid, text, options = {}) {
        try {
            await this.sock.sendMessage(jid, { text, ...options });
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
        }
    }
}

module.exports = StatsCommand;
