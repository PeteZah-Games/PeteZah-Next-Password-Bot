import { ActivityType, Client, GatewayIntentBits, Events } from 'discord.js';
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

const pr = new Intl.PluralRules("en-US", { type: "ordinal" });

const suffixes = new Map([
  ["one", "st"],
  ["two", "nd"],
  ["few", "rd"],
  ["other", "th"],
]);

const formatOrdinals = (n) => {
  const rule = pr.select(n);
  const suffix = suffixes.get(rule);
  return `${n}${suffix}`;
};

async function getPasswordPrioritized() {
  const nextMonthKey = `password:${getMonthKey(1)}`;
  const currentMonthKey = `password:${getMonthKey(0)}`;

  const [nextMonthPassword, currentMonthPassword] = await redis.mget(
    nextMonthKey,
    currentMonthKey
  );

  const pwdRedCount = await redis.incr("pwdRedCount");

  if (nextMonthPassword) return { pwd: nextMonthPassword, ct: pwdRedCount };
  if (currentMonthPassword) return { pwd: currentMonthPassword, ct: pwdRedCount };
  
  return null;
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user?.setActivity("/password", {
    type: ActivityType.Watching,
  });
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'password') {
    await interaction.deferReply();

    const { pwd, ct } = await getPasswordPrioritized();

    if (!pwd) {
      await interaction.editReply('No passwords found in Redis.');
    } else {
      await interaction.editReply(`The latest password is: **${pwd}**, this is the ${formatOrdinals(ct)} time someone has requested it.`);
    }
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
