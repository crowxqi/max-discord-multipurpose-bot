# 🤖 Max (Multipurpose Discord Bot)

![Node.js](https://img.shields.io/badge/Node.js-v24-green?style=for-the-badge&logo=node.js)
![Discord.js](https://img.shields.io/badge/Discord.js-v14-blue?style=for-the-badge&logo=discord)
[![Discord Support](https://img.shields.io/badge/Discord-Support-7289DA?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/586Ejd8M5Z)
![License](https://img.shields.io/badge/License-ISC-orange?style=for-the-badge)

> **Max** is the ultimate all-in-one Discord bot featuring Advanced Tickets, Temporary Voice Channels, Voice Recording, and Robust Moderation.
>
> 🚀 **Powered by [ArcticNodes.io](https://arcticnodes.io/)** - High Performance Game & Bot Hosting.

---

## ✨ Credits
- **Developer**: **[Raze](https://github.com/yourusername)**
- **Hosting Partner**: **[ArcticNodes](https://arcticnodes.io/)**
- **Support Server**: **[Join Community](https://discord.gg/586Ejd8M5Z)**

---

## ✨ Key Features

### 🎫 **Advanced Ticket System**
- **Multi-Category Panels**: Create ticket panels with multiple options (Support, Billing, Report, etc.).
- **HTML Transcripts**: Automatically generates and saves chat transcripts when tickets are closed.
- **Claim System**: Staff can claim tickets to handle them exclusively.
- **Custom Buttons**: Close, Close with Reason, and Claim buttons with emoji support.

### 🔊 **Temporary Voice Channels (TempVC)**
- **Join-to-Create**: Users join a hub channel to create their own private voice channel.
- **Full Control Interface**: A control panel (embed + buttons) allows owners to:
  - 🔒 **Lock/Unlock** the channel.
  - 🚫 **Ban/Kick** users from the channel.
  - 👑 **Transfer Ownership**.
  - ✏️ **Rename** the channel.
  - 🙈 **Hide/Unhide** the channel.

### 🎙️ **Voice Recording**
- **High-Quality Recording**: Record voice channels into WAV format.
- **Auto-Upload**: Automatically uploads the recording file to the channel when stopped.
- **Privacy Focus**: Clearly notifies users when recording starts/stops.
- **Error Handling**: Robust stream management ensures no audio is lost even if the bot is stopped abruptly.

### 🛡️ **Advanced Moderation**
- **Complete Suite**: `ban`, `kick`, `mute` (timeout), `warn`, `unban`, `unmute`.
- **Modlogs**: detailed logging of all moderation actions.
- **Voice Moderation**: `vcban`, `vcmute`, `vcunban` specific to voice channels.
- **Sticky Messages**: Pin messages to the bottom of channels.
- **Lockdown**: Lock specific channels or the entire server (`lockall`).

### 🤖 **Automation & Utility**
- **Autoresponder**: Set up custom triggers and responses.
- **Autoreact**: Automatically react to specific words with emojis.
- **Automod**: Built-in protection against:
  - anti-link
  - anti-spam
  - anti-mass-mention
  - anti-invite
- **Ticket Panel Setup**: Easy interactive setup command.

---

## 🛠️ Commands List

### 👮 Admin & Configuration
| Command | Description |
| :--- | :--- |
| `/automod` | Configure auto-moderation filters (links, spam, etc.). |
| `/autoresponder` | Add/Remove custom text responses. |
| `/autoreact` | Add/Remove custom emoji reactions. |
| `/autorolebot` | Set role to give bots upon join. |
| `/autoroleuser` | Set role to give users upon join. |
| `/securechannel` | Configure channel security settings. |
| `/setstaff` | Configure staff roles and permissions. |
| `/sticky` | Create sticky messages that stay at the bottom. |
| `/prefix` | Change the bot's prefix for non-slash commands. |
| `/blacklist` | Manage blacklisted words. |

### 🛡️ Moderation
| Command | Description |
| :--- | :--- |
| `/ban` / `/unban` | Ban or Unban a user. |
| `/kick` | Kick a user. |
| `/mute` / `/unmute` | Timeout a user. |
| `/warn` | Warn a user (dm + database log). |
| `/warnlist` | View warnings for a user. |
| `/modlog` | View moderation logs for a user. |
| `/purge` | Bulk delete messages. |
| `/lock` / `/unlock` | Lock/Unlock current channel. |
| `/lockall` / `/unlockall` | Lockdown the entire server. |
| `/slowmode` | Set channel slowmode. |
| `/nuke` | Clone and delete a channel (clear all messages). |
| `/vcban` / `/vcunban` | Ban/Unban user from ALL voice channels. |

### 🔧 Utility & Systems
| Command | Description |
| :--- | :--- |
| `/ticketsetup` | Interactive setup for ticket system. |
| `/ticketpanel` | Create a fancy ticket panel message. |
| `/tempvcsetup` | Setup the Join-to-Create voice system. |
| `/invite` | Get bot invite link. |
| `/help` | View all commands. |

### 🎙️ Voice
| Command | Description |
| :--- | :--- |
| `/record start` | Start recording audio in your voice channel. |
| `/record stop` | Stop recording and upload the file. |

---

## 🚀 Installation Guide

### Prerequisites
- Node.js v16.9.0 or newer (v24 recommended).
- A Discord Bot Token (from [Discord Developer Portal](https://discord.com/developers/applications)).

### Setup Steps
1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/garb-by-raze.git
   cd garb-by-raze
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   - Rename `.env.example` to `.env`.
   - Edit `.env` and fill in your details:
     ```ini
     DISCORD_TOKEN=your_token
     OWNER_ID=your_id
     DEFAULT_PREFIX=!
     ```

4. **Start the Bot**
   ```bash
   npm start
   ```

## 📂 Project Structure
```
garb-by-raze/
├── src/
│   ├── commands/     # Slash commands
│   ├── events/       # Event listeners
│   ├── handlers/     # Core logic (tickets, tempvc)
│   ├── database/     # JSON-based Database Shim
│   └── index.js      # Entry point
├── data/             # Database storage
├── recordings/       # Audio recordings
├── .env              # Configuration secrets
└── package.json      # Dependencies
```

## 📜 License
Values protected under the **ISC License**.
**Coded with ❤️ by Raze.**

---
<div align="center">
  <a href="https://arcticnodes.io/">
    <h3>🚀 Sponsored by ArcticNodes.io</h3>
  </a>
  <p>Premium Hosting for Games, Bots, and Web.</p>
</div>