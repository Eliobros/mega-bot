const fs = require('fs');
const path = require('path');

class PaymentHandler {
    constructor(sock, dataManager) {
        this.sock = sock;
        this.dataManager = dataManager;
    }

    async handle(messageText, from) {
        if (!from.endsWith('@g.us')) return false;

        const text = messageText.toLowerCase();
        const filePath = path.join(__dirname, '..', 'data', 'pagamentos.json');

        let pagamentosData = {};
        if (fs.existsSync(filePath)) {
            pagamentosData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }

        const pagamentos = pagamentosData[from] || [];
        if (pagamentos.length === 0) return false;

        // Comando "pagamento"
        if (text === 'pagamento') {
            if (pagamentos.length === 1) {
                await this.showSinglePayment(from, pagamentos[0]);
            } else {
                await this.showPaymentMenu(from, pagamentos);
            }
            return true;
        }

        // Comandos "pagamento1", "pagamento2", etc
        const match = text.match(/^pagamento(\d+)$/);
        if (match) {
            const index = parseInt(match[1], 10) - 1;
            const p = pagamentos[index];

            if (!p) {
                await this.sock.sendMessage(from, {
                    text: '⚠️ Esta opção não existe neste grupo.'
                });
                return true;
            }

            await this.showSinglePayment(from, p, index + 1);
            return true;
        }

        return false;
    }

    async showSinglePayment(from, payment, optionNum = null) {
        const title = optionNum ? `PAGAMENTO OPÇÃO ${optionNum}` : 'PAGAMENTO DISPONÍVEL';
        
        const msgText = `
🏦 *${title}* 💳

━━━━━━━━━━━━━━━━━━━━━━━
*👤 ADM:* ${payment.nome}
*📞 Número:* ${payment.numero}

*💳 FORMAS DE PAGAMENTO:*
🔹 M-PESA: ${payment.mpesa || 'N/A'}
🔹 E-MOLA: ${payment.emola || 'N/A'}

━━━━━━━━━━━━━━━━━━━━━━━
📋 *INSTRUÇÕES:*
1️⃣ Faça o pagamento usando os dados acima
2️⃣ Envie o comprovativo neste grupo
3️⃣ Inclua o número que vai receber o pacote

⚠️ Guarde seu comprovativo até a confirmação!
🤖 *Tina Bot* 💎
        `;

        await this.sock.sendMessage(from, { text: msgText });
    }

    async showPaymentMenu(from, pagamentos) {
        let menu = `🏦 *FORMAS DE PAGAMENTO DISPONÍVEIS* 💸\n\n━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        
        pagamentos.forEach((p, i) => {
            menu += `📱 *OPÇÃO ${i + 1} - ${p.nome}*\nDigite: pagamento${i + 1}\n\n`;
        });
        
        menu += `━━━━━━━━━━━━━━━━━━━━━━━\n💡 *Como usar:*\n• Digite pagamento1, pagamento2, etc.\n• Escolha a forma de pagamento\n• Envie o comprovativo no grupo\n\n🤖 Tina Bot 💎`;

        await this.sock.sendMessage(from, { text: menu });
    }
}

module.exports = PaymentHandler;
