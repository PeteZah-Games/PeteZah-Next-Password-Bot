import { Client, GatewayIntentBits, Events } from 'discord.js';
import { Redis } from '@upstash/redis';
import 'dotenv/config';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

function getMonthKey(offset = 0) {
  const now = new Date();
  const target = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset)
  );
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function getPasswordPrioritized() {
  const nextMonthKey = `password:${getMonthKey(1)}`;
  const currentMonthKey = `password:${getMonthKey(0)}`;

  const [nextMonthPassword, currentMonthPassword] = await redis.mget(
    nextMonthKey,
    currentMonthKey
  );

  if (nextMonthPassword) return nextMonthPassword;
  if (currentMonthPassword) return currentMonthPassword;
  return null;
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'password') {
    await interaction.deferReply();

    throw new Error('This command is not implemented yet.');

    const password = await getPasswordPrioritized();

    if (!password) {
      await interaction.editReply('No passwords found in Redis.');
    } else {
      await interaction.editReply(`The latest password is: **${password}**`);
    }
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
