const fs = require('fs'); const path = require('path'); const { exec } = require('child_process'); const { promisify } = require('util'); const fetch = require('node-fetch');

const execAsync = promisify(exec);

class PlayCommand { constructor(sock, dataManager) { this.sock = sock; this.dataManager = dataManager; this.tempDir = path.join(__dirname, '../../temp'); this.maxDuration = 600; // 10 minutos em segundos this.maxFileSize = 50 * 1024 * 1024; // 50MB

if (!fs.existsSync(this.tempDir)) {
        fs.mkdirSync(this.tempDir, { recursive: true });
    }
}

async execute(msg, args, from, sender) {
    try {
        if (!args.length) {
            await this.sendHelpMessage(from);
            return;
        }

        const query = args.join(' ');
        const isYouTubeUrl = this.isValidYouTubeUrl(query);

        if (!isYouTubeUrl && query.includes('http')) {
            await this.sendMessage(from, '❌ *URL não suportada!*\n\n🔗 Apenas URLs do YouTube são aceitas.');
            return;
        }

        await this.sendMessage(from, '⏳ *Processando...*');

        let videoInfo;
        let audioPath;

        if (isYouTubeUrl) {
            videoInfo = await this.getVideoInfo(query);
            await this.sendVideoPreview(from, videoInfo);
            audioPath = await this.downloadAudio(query);
        } else {
            const searchResult = await this.searchYouTube(query);
            if (!searchResult) {
                await this.sendMessage(from, `❌ *Música não encontrada!*\n\n🔍 Não foi possível encontrar: "${query}"`);
                return;
            }
            videoInfo = searchResult;
            await this.sendVideoPreview(from, videoInfo);
            audioPath = await this.downloadAudio(searchResult.url);
        }

        if (videoInfo.duration > this.maxDuration) {
            this.cleanupFiles([audioPath]);
            await this.sendMessage(from, `❌ *Música muito longa!*\n\n⏱️ Duração: ${this.formatDuration(videoInfo.duration)}\n📏 Limite máximo: ${this.formatDuration(this.maxDuration)}`);
            return;
        }

        const fileStats = fs.statSync(audioPath);
        if (fileStats.size > this.maxFileSize) {
            this.cleanupFiles([audioPath]);
            await this.sendMessage(from, `❌ *Arquivo muito grande!*\n\n📊 Tamanho: ${(fileStats.size / 1024 / 1024).toFixed(1)}MB\n📏 Limite: ${this.maxFileSize / 1024 / 1024}MB`);
            return;
        }

        await this.sendAudio(from, audioPath, videoInfo);
        this.cleanupFiles([audioPath]);
        console.log(`🎵 Música enviada: ${videoInfo.title} para ${sender.replace('@s.whatsapp.net', '')}`);

    } catch (error) {
        console.error('Erro no comando play:', error);
        await this.handleError(from, error);
    }
}

isValidYouTubeUrl(url) {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|m\.youtube\.com)\/.+$/;
    return youtubeRegex.test(url);
}

async searchYouTube(query) {
    try {
        const searchCommand = `yt-dlp -j "ytsearch1:${query}"`;
        const { stdout } = await execAsync(searchCommand);
        const info = JSON.parse(stdout);

        return {
            title: info.title,
            duration: info.duration,
            url: info.webpage_url,
            id: info.id,
            channel: info.channel,
            channelUrl: info.channel_url,
            views: info.view_count,
            description: (info.description || '').slice(0, 45)
        };
    } catch (error) {
        console.error('Erro ao buscar no YouTube:', error);
        return null;
    }
}

async getVideoInfo(url) {
    try {
        const infoCommand = `yt-dlp -j "${url}"`;
        const { stdout } = await execAsync(infoCommand);
        const info = JSON.parse(stdout);

        return {
            title: info.title || 'Título não disponível',
            duration: info.duration || 0,
            url: info.webpage_url || url,
            id: info.id || 'unknown',
            channel: info.channel || 'Desconhecido',
            channelUrl: info.channel_url || '',
            views: info.view_count || 0,
            description: (info.description || '').slice(0, 45)
        };
    } catch (error) {
        console.error('Erro ao obter info do vídeo:', error);
        throw new Error('Não foi possível obter informações do vídeo');
    }
}

async downloadAudio(url) {
    const timestamp = Date.now();
    const outputPath = path.join(this.tempDir, `audio_${timestamp}_${Math.random().toString(36).slice(2)}.mp3`);

    try {
        const downloadCommand = `yt-dlp "${url}" -f "bestaudio/best" --extract-audio --audio-format mp3 --audio-quality 128K --no-playlist -o "${outputPath.replace('.mp3', '.%(ext)s')}"`;

        await execAsync(downloadCommand, { timeout: 300000 });

        if (fs.existsSync(outputPath)) return outputPath;

        const files = fs.readdirSync(this.tempDir).filter(f => f.startsWith(path.basename(outputPath, '.mp3')));
        if (files.length > 0) return path.join(this.tempDir, files[0]);

        throw new Error('Arquivo de áudio não foi criado');
    } catch (error) {
        console.error('Erro no download:', error);
        throw new Error('Falha no download do áudio');
    }
}

async sendAudio(jid, audioPath, videoInfo) {
    try {
        const audioBuffer = await fs.promises.readFile(audioPath);

        await this.sock.sendMessage(jid, {
            audio: audioBuffer,
            mimetype: 'audio/mpeg',
            ptt: false,
            contextInfo: {
                externalAdReply: {
                    title: videoInfo.title,
                    body: `⏱️ ${this.formatDuration(videoInfo.duration)} • 🎵 Tina Bot`,
                    thumbnail: await this.getYouTubeThumbnail(videoInfo.id),
                    sourceUrl: videoInfo.url,
                    mediaType: 2,
                    mediaUrl: videoInfo.url
                }
            }
        });
    } catch (error) {
        console.error('Erro ao enviar áudio:', error);
        throw new Error('Falha ao enviar áudio');
    }
}

async sendVideoPreview(jid, videoInfo) {
    try {
        const textMsg = `🎵 *Prévia da Música*\n\n` +
            `📌 *Título:* ${videoInfo.title}\n` +
            `📺 *Canal:* ${videoInfo.channel}\n` +
            `🆔 *ID:* ${videoInfo.id}\n` +
            `🔗 *Canal:* ${videoInfo.channelUrl}\n` +
            `👀 *Views:* ${videoInfo.views.toLocaleString()}\n` +
            `⏱️ *Duração:* ${this.formatDuration(videoInfo.duration)}\n\n` +
            `📝 *Descrição:* ${videoInfo.description}\n\n` +
            `By: Tina Bot`;

        const thumbUrl = `https://img.youtube.com/vi/${videoInfo.id}/maxresdefault.jpg`;
        const response = await fetch(thumbUrl);
        const thumbnail = response.ok ? await response.buffer() : null;

        await this.sock.sendMessage(jid, { image: thumbnail, caption: textMsg });
    } catch (error) {
        console.error('Erro ao enviar prévia do vídeo:', error);
    }
}

async getYouTubeThumbnail(videoId) {
    try {
        const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        const response = await fetch(thumbnailUrl);
        if (response.ok) return await response.buffer();
    } catch (error) {
        console.error('Erro ao obter thumbnail:', error);
    }
    return null;
}

parseDuration(durationStr) {
    try {
        if (!durationStr) return 0;
        const parts = durationStr.split(':');
        let seconds = 0;
        if (parts.length === 3) seconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
        else if (parts.length === 2) seconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
        else seconds = parseInt(parts[0]);
        return seconds;
    } catch {
        return 0;
    }
}

formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

cleanupFiles(filePaths) {
    filePaths.forEach(filePath => {
        try {
            if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (error) {
            console.error('Erro ao limpar arquivo:', filePath, error);
        }
    });
}

async handleError(jid, error) {
    let errorMsg = '❌ *Erro ao processar música!*\n\n';
    if (error.message.includes('download')) errorMsg += '📡 Falha no download.';
    else if (error.message.includes('not found') || error.message.includes('404')) errorMsg += '🔍 Vídeo não encontrado.';
    else if (error.message.includes('timeout')) errorMsg += '⏱️ Timeout no download.';
    else if (error.message.includes('age')) errorMsg += '🔞 Vídeo com restrição de idade.';
    else errorMsg += '⚠️ Erro interno.';
    await this.sendMessage(jid, errorMsg);
}

async sendHelpMessage(from) {
    const config = this.dataManager?.getDonoData?.() || {};
    const prefix = config.Prefixo || '!';

    const helpMsg = `🎵 *Comando Play*\n\n` +
        `📝 *Como usar:*\n• \`${prefix}play nome da música\`\n• \`${prefix}play URL do YouTube\`\n\n` +
        `📋 *Limitações:*\n• Duração máxima: 10 minutos\n• Tamanho máximo: 50MB\n• Apenas YouTube suportado`;

    await this.sendMessage(from, helpMsg);
}

async sendMessage(jid, text, options = {}) {
    try {
        await this.sock.sendMessage(jid, { text, ...options });
    } catch (err) {
        console.error("Erro ao enviar mensagem:", err);
    }
}

}

module.exports = PlayCommand;


