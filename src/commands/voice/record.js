const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection, EndBehaviorType, VoiceConnectionStatus } = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');
const prism = require('prism-media');
const { pipeline } = require('stream');

module.exports = {
    permission: 1, // STAFF only
    data: new SlashCommandBuilder()
        .setName('record')
        .setDescription('Record voice channel audio')
        .addSubcommand(s => s.setName('start').setDescription('Start recording'))
        .addSubcommand(s => s.setName('stop').setDescription('Stop recording and upload')),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const member = interaction.member;
        const guild = interaction.guild;

        // Module-level manager for recording sessions to prevent duplicate listeners
        if (!global.recordingSessions) global.recordingSessions = new Map();

        if (sub === 'start') {
            if (global.recordingSessions.has(guild.id)) {
                return interaction.reply({ content: '❌ Already recording in this server! Stop the current recording first.', ephemeral: true });
            }

            if (!member.voice.channel) return interaction.reply({ content: '❌ You must be in a voice channel!', ephemeral: true });

            const connection = joinVoiceChannel({
                channelId: member.voice.channel.id,
                guildId: guild.id,
                adapterCreator: guild.voiceAdapterCreator,
                selfDeaf: false,
                selfMute: false
            });

            // State for this session
            const sessionState = {
                activeUsers: new Set(),
                listener: null
            };

            // Define listener function reference for removal later
            const speakingListener = (userId) => {
                if (sessionState.activeUsers.has(userId)) return;

                console.log(`🗣️ User ${userId} started speaking.`);

                // Subscribe to the audio stream
                const opusStream = connection.receiver.subscribe(userId, {
                    end: {
                        behavior: EndBehaviorType.AfterSilence,
                        duration: 1000,
                    },
                });

                sessionState.activeUsers.add(userId);

                const recPath = path.join(__dirname, '..', '..', '..', 'recordings');
                if (!fs.existsSync(recPath)) fs.mkdirSync(recPath, { recursive: true });

                const rawStream = new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 });
                const filename = path.join(recPath, `${userId}-${Date.now()}.pcm`);
                const out = fs.createWriteStream(filename);

                console.log(`🎙️ Recording to ${filename}`);

                pipeline(opusStream, rawStream, out, (err) => {
                    sessionState.activeUsers.delete(userId);
                    if (err) {
                        if (err.code === 'ERR_STREAM_PREMATURE_CLOSE') {
                            // Expected interaction
                        } else {
                            console.error(`❌ Error recording ${userId}:`, err);
                        }
                    } else {
                        console.log(`✅ Segment saved: ${filename}`);
                    }
                });
            };

            sessionState.listener = speakingListener;
            connection.receiver.speaking.on('start', speakingListener);

            // Save session
            global.recordingSessions.set(guild.id, sessionState);

            // Log clean end
            connection.receiver.speaking.on('end', (userId) => {
                // console.log(`🤫 User ${userId} stopped speaking.`);
            });

            return interaction.reply({ content: `🎙️ Started recording in <#${member.voice.channel.id}>. \n**Note:** Audio is split by silence. You may receive multiple files.` });

        } else if (sub === 'stop') {
            const connection = getVoiceConnection(guild.id);
            if (!connection) {
                global.recordingSessions.delete(guild.id);
                return interaction.reply({ content: '❌ Not recording!', ephemeral: true });
            }

            await interaction.reply({ content: '✅ Stopping recording... processing files.' });

            // Cleanup listener to prevent leaks
            const session = global.recordingSessions.get(guild.id);
            if (session && session.listener) {
                connection.receiver.speaking.off('start', session.listener);
            }
            global.recordingSessions.delete(guild.id);

            // Give streams a moment to close
            await new Promise(r => setTimeout(r, 1000));

            const recPath = path.join(__dirname, '..', '..', '..', 'recordings');
            connection.destroy();

            // Wait for locks
            await new Promise(r => setTimeout(r, 500));

            try {
                if (!fs.existsSync(recPath)) return interaction.followUp('No recordings found.');

                const files = fs.readdirSync(recPath).filter(f => f.endsWith('.pcm'));
                if (files.length === 0) return interaction.followUp('No audio captured.');

                const uploadedFiles = [];
                let totalSize = 0;
                const MAX_SIZE = 8 * 1024 * 1024; // 8MB safety limit for standard discord

                for (const file of files) {
                    const pcmPath = path.join(recPath, file);
                    const wavPath = pcmPath.replace('.pcm', '.wav');

                    try {
                        const pcmData = fs.readFileSync(pcmPath);
                        if (pcmData.length === 0) {
                            fs.unlinkSync(pcmPath);
                            continue;
                        }

                        const wavHeader = getWavHeader(pcmData.length, 48000, 2, 16);
                        const wavData = Buffer.concat([wavHeader, pcmData]);
                        fs.writeFileSync(wavPath, wavData);

                        const stat = fs.statSync(wavPath);
                        if ((totalSize + stat.size) < MAX_SIZE) {
                            uploadedFiles.push(wavPath);
                            totalSize += stat.size;
                        } else {
                            // Too big to upload all
                            fs.unlinkSync(wavPath); // Delete if we can't upload to save space (or keep it?) - let's delete to be clean
                        }

                        fs.unlinkSync(pcmPath);
                    } catch (err) {
                        console.error(`Error processing ${file}:`, err);
                    }
                }

                if (uploadedFiles.length > 0) {
                    await interaction.channel.send({
                        content: `📁 **Voice Recordings** (${uploadedFiles.length})\n*Some files may be omitted if total size exceeds Discord limits.*`,
                        files: uploadedFiles
                    });

                    // Cleanup
                    uploadedFiles.forEach(f => {
                        try { fs.unlinkSync(f); } catch (e) { }
                    });
                } else {
                    interaction.followUp('No audio files (or files too large/empty).');
                }

            } catch (e) {
                console.error(e);
                interaction.followUp('❌ Error uploading files.');
            }
        }
    }
};

// Helper: Create WAV Header
function getWavHeader(dataLength, sampleRate, channels, bitDepth) {
    const blockAlign = (channels * bitDepth) / 8;
    const byteRate = sampleRate * blockAlign;
    const buffer = Buffer.alloc(44);

    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataLength, 4); // ChunkSize
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // Subchunk1Size
    buffer.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
    buffer.writeUInt16LE(channels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitDepth, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataLength, 40);

    return buffer;
}
