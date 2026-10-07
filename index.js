const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, PermissionFlagsBits } = require('discord.js');
const express = require('express');
require('dotenv').config();

// Express web server (Render keep-alive & Uptime/Cron ping ke liye)
const app = express();
app.get('/', (req, res) => res.send('Xeon Police is active and guarding the server!'));
app.listen(process.env.PORT || 3000, () => console.log('Web server is running.'));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Config Settings
const FLAGS_CHANNEL_ID = '123456789012345678'; // ⚠️ APNE FLAGS CHANNEL KI ID SE REPLACE KARO
const GIST_ID = process.env.GIST_ID;
const GH_TOKEN = process.env.GH_TOKEN;

let botData = {
    badWords: ['gaali', 'spamword'],
    timeoutSeconds: 60
};

// Gist se saved data load karne ka function
async function loadGistData() {
    if (!GIST_ID || !GH_TOKEN) return console.log("⚠️ GIST_ID ya GH_TOKEN environment variables me missing hai!");
    try {
        const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
            headers: { 'Authorization': `token ${GH_TOKEN}`, 'User-Agent': 'XeonPolice' }
        });
        const data = await res.json();
        if (data.files && data.files['data.json']) {
            botData = JSON.parse(data.files['data.json'].content);
            console.log('✅ Gist se saved data load ho gaya!', botData);
        }
    } catch (err) {
        console.error('Data load karne me error:', err);
    }
}

// Gist me data save karne ka function
async function saveGistData() {
    if (!GIST_ID || !GH_TOKEN) return;
    try {
        await fetch(`https://api.github.com/gists/${GIST_ID}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `token ${GH_TOKEN}`,
                'Content-Type': 'application/json',
                'User-Agent': 'XeonPolice'
            },
            body: JSON.stringify({
                files: {
                    'data.json': {
                        content: JSON.stringify(botData, null, 2)
                    }
                }
            })
        });
        console.log('✅ Data GitHub Gist par auto-save ho gaya!');
    } catch (err) {
        console.error('Data save karne me error:', err);
    }
}

// Slash Commands Definition
const commands = [
    new SlashCommandBuilder()
        .setName('bwords')
        .setDescription('Naya bad word add karo (Admins/Mods only)')
        .addStringOption(option => 
            option.setName('word')
            .setDescription('Wo word jo block karna hai')
            .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    
    new SlashCommandBuilder()
        .setName('bword_timeout')
        .setDescription('Timeout ka time set karo seconds me (Admins/Mods only)')
        .addIntegerOption(option => 
            option.setName('seconds')
            .setDescription('Time in seconds (e.g., 60, 120)')
            .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
];

client.on('ready', async () => {
    console.log(`🚨 Xeon Police is online! Logged in as ${client.user.tag}`);
    await loadGistData();
    
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('Slash commands loaded successfully!');
    } catch (error) {
        console.error("Commands load karne me error:", error);
    }
});

// Slash Commands Handler
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'bwords') {
        const newWord = interaction.options.getString('word').toLowerCase();
        if (!botData.badWords.includes(newWord)) {
            botData.badWords.push(newWord);
            await saveGistData();
            await interaction.reply({ content: `✅ **${newWord}** blocklist me add and permanently save ho gaya hai.`, ephemeral: true });
        } else {
            await interaction.reply({ content: `⚠️ Ye word pehle se list me hai!`, ephemeral: true });
        }
    }

    if (interaction.commandName === 'bword_timeout') {
        const secs = interaction.options.getInteger('seconds');
        botData.timeoutSeconds = secs;
        await saveGistData();
        await interaction.reply({ content: `⏱️ Timeout time update karke **${secs} seconds** save kar diya gaya hai.`, ephemeral: true });
    }
});

// Message Moderation Handler
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const content = message.content.toLowerCase();
    const containsBadWord = botData.badWords.some(word => content.includes(word));

    if (containsBadWord) {
        try {
            await message.delete();
            await message.member.timeout(botData.timeoutSeconds * 1000, 'Using bad words or spamming');

            const flagsChannel = client.channels.cache.get(FLAGS_CHANNEL_ID);
            if (flagsChannel) {
                flagsChannel.send(`🚨 **Xeon Police Action**\nMaine isko <@${message.author.id}> ko ban ya **${botData.timeoutSeconds}sec** ka timeout diya ha.\n**Reason:** Spamming or bad words typing.`);
            }

            const warningMsg = await message.channel.send(`<@${message.author.id}>, ye words allowed nahi hain! Tumhe ${botData.timeoutSeconds} seconds ka timeout mila hai.`);
            setTimeout(() => warningMsg.delete().catch(() => {}), 5000);

        } catch (error) {
            console.error("Action lene me error aaya (Check bot permissions & role position):", error);
        }
    }
});

// Login Error Catching
if (!process.env.TOKEN) {
    console.error("❌ ERROR: TOKEN environment variable missing hai!");
} else {
    client.login(process.env.TOKEN).catch(err => {
        console.error("❌ Discord Login Error:", err.message);
    });
              }
        
