import { openai } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { Client, Events, GatewayIntentBits } from 'discord.js'

if (
  !process.env.DISCORD_TOKEN ||
  !process.env.SERVER_ID ||
  !process.env.SVEN_ID ||
  !process.env.DAVID_ID ||
  !process.env.CHAMBER_ID ||
  !process.env.JUGE_ID
) {
  throw new Error('Missing env variables')
}

const discordToken = process.env.DISCORD_TOKEN
const serverId = process.env.SERVER_ID

const replaceMentions = (content: string) => {
  return content
    .replace(new RegExp(`<@${process.env.SVEN_ID}>`, 'g'), '@sven')
    .replace(new RegExp(`<@${process.env.DAVID_ID}>`, 'g'), '@david')
    .replace(new RegExp(`<@${process.env.CHAMBER_ID}>`, 'g'), '@chamber')
    .replace(new RegExp(`<@${process.env.JUGE_ID}>`, 'g'), '@juge')
}

export const connectDiscord = () => {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  })

  client.once(Events.ClientReady, () => console.log(`Logged in to Discord as ${client.user?.tag}`))

  client.on(Events.MessageCreate, async message => {
    if (message.author.bot) return

    const limit = 30

    if (message.content.includes(`<@${process.env.JUGE_ID}>`)) {
      const messages = await message.channel.messages.fetch({ limit })
      const messageHistory = Array.from(messages.values())
        .reverse()
        .map(msg => `${msg.author.username}: ${replaceMentions(msg.content)}`)
        .join('\n')

      console.log(messageHistory)

      const { text } = await generateText({
        model: openai('gpt-4o'),
        prompt: `
          Tu es un bot qui s'appelle @juge dans un serveur Discord privé entre 3 amis : @sven, @david, et @chamber. ${message.author.username} vient de te mentionner pour te demander ton avis sur quelque chose. Réponds en français, de façon détendue et concise. Si le ton de la conversation s'y prête, tu peux répondre de façon humouristique, être sarcastique, insulter, utiliser des emojis (1 ou 2 max par message), des mots grossiers. Voici l'historique des ${limit} derniers messages du canal.
          <history>
          ${messageHistory}
          </history>
          `,
      })
      message.reply(text)
    }
  })

  client.login(discordToken)

  return () => client.destroy()
}

Bun.serve({ fetch: () => new Response('ok') })

const disconnectDiscord = connectDiscord()

const cleanup = async () => {
  await disconnectDiscord()
  process.exit(0)
}

process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)
