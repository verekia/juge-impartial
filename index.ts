import { openai } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { Client, Events, GatewayIntentBits } from 'discord.js'

if (
  !process.env.DISCORD_TOKEN ||
  !process.env.USER_A_ID ||
  !process.env.USER_B_ID ||
  !process.env.USER_C_ID ||
  !process.env.USER_A_USERNAME ||
  !process.env.USER_B_USERNAME ||
  !process.env.USER_C_USERNAME ||
  !process.env.BOT_USERNAME ||
  !process.env.USER_A_FRIENDLY_NAME ||
  !process.env.USER_B_FRIENDLY_NAME ||
  !process.env.USER_C_FRIENDLY_NAME ||
  !process.env.BOT_ID
) {
  throw new Error('Missing env variables')
}

const discordToken = process.env.DISCORD_TOKEN

const replaceMentions = (content: string) =>
  content
    .replace(new RegExp(`<@${process.env.USER_A_ID}>`, 'g'), 'USER_A')
    .replace(new RegExp(`<@${process.env.USER_B_ID}>`, 'g'), 'USER_B')
    .replace(new RegExp(`<@${process.env.USER_C_ID}>`, 'g'), 'USER_C')
    .replace(new RegExp(`<@${process.env.BOT_ID}>`, 'g'), 'BOT')
    .replace(new RegExp(process.env.USER_A_USERNAME!, 'g'), 'USER_A')
    .replace(new RegExp(process.env.USER_B_USERNAME!, 'g'), 'USER_B')
    .replace(new RegExp(process.env.USER_C_USERNAME!, 'g'), 'USER_C')
    .replace(new RegExp(process.env.USER_A_FRIENDLY_NAME!, 'g'), 'USER_A')
    .replace(new RegExp(process.env.USER_B_FRIENDLY_NAME!, 'g'), 'USER_B')
    .replace(new RegExp(process.env.USER_C_FRIENDLY_NAME!, 'g'), 'USER_C')
    .replace(new RegExp(process.env.BOT_USERNAME!, 'g'), 'BOT')

const getAnonymousName = (nick: string) =>
  ({
    [process.env.USER_A_USERNAME!]: 'USER_A',
    [process.env.USER_B_USERNAME!]: 'USER_B',
    [process.env.USER_C_USERNAME!]: 'USER_C',
    [process.env.BOT_USERNAME!]: 'BOT',
  }[nick])

const getFriendlyName = (anonymousName: string) =>
  ({
    USER_A: process.env.USER_A_FRIENDLY_NAME,
    USER_B: process.env.USER_B_FRIENDLY_NAME,
    USER_C: process.env.USER_C_FRIENDLY_NAME,
    BOT: process.env.BOT_USERNAME,
  }[anonymousName] ?? '??')

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

    const limit = 20

    if (message.content.includes(`<@${process.env.BOT_ID}>`)) {
      const messages = await message.channel.messages.fetch({ limit })
      const messageHistory = Array.from(messages.values())
        .reverse()
        .map(msg => {
          const anonAuthor = getAnonymousName(msg.author.username)
          const msgWithMentions = replaceMentions(msg.content)
          return `${anonAuthor}: ${msgWithMentions}`
        })
        .join('\n')

      const mentioner = getAnonymousName(message.author.username)

      const prompt = `
          Tu es un bot nommé BOT dans un serveur Discord privé entre 3 amis : USER_A, USER_B, et USER_C. ${mentioner} vient de te mentionner pour te demander ton avis sur quelque chose, ou juste pour papoter. Réponds en français, de façon détendue et concise. Si le ton de la conversation s'y prête, tu peux répondre de façon humouristique, être sarcastique, insulter, utiliser des emojis (1 max par message), des mots grossiers. Si tu cherches à t'adresser à l'un d'entre eux directement, utiliser exactement "USER_A", "USER_B", ou "USER_C" dans ta réponse. Voici l'historique des ${limit} derniers messages du canal.
          <history>
          ${messageHistory}
          </history>
          `

      const { text } = await generateText({ model: openai('gpt-4o'), prompt })

      console.log(prompt)

      message.reply(text.replace(/USER_A|USER_B|USER_C/g, match => `${getFriendlyName(match)}`))
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
