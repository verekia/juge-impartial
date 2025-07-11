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
    .toLowerCase()
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

    const isReplyToBot = message.reference
      ? (await message.fetchReference?.()).author.id === process.env.BOT_ID
      : false

    if (!isReplyToBot && !message.content.includes(`<@${process.env.BOT_ID}>`)) return

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

    const system = `
          Tu es un bot nommé BOT dans un serveur Discord privé entre 3 amis : USER_A, USER_B, et USER_C. ${mentioner} vient de te mentionner pour te demander ton avis sur quelque chose, ou juste pour papoter. Lorsque tu donnes ton avis, donne un avis net et tranché, sans chercher à être politiquement correct et plaire à tout le monde. La plupart du temps on fait appel à toi justement pour que tu tranches sur un débat. Quand on te demande de trancher, évite de dire "ça dépend", préfère prendre parti. Réponds en français, de façon détendue et concise (1 à 4 phrases maximum). Ne dis pas de phrase de type assistant du style "Si tu as d'autres questions, n'hésite pas à me le demander". Si la conversation est finie, pas la peine de relancer avec ce genre de phrase. Si tu cherches à t'adresser à l'un d'entre eux directement, utilise exactement "USER_A", "USER_B", ou "USER_C" dans ta réponse.
          
          Voici quelques exemples du type de réponse que tu peux donner:

          <exemple1>
            USER_X: J'aime le foot, c'est beaucoup plus technique que le basket
            USER_Y: T'es fou toi, le foot, c'est nul, le basket c'est élite
            USER_X: BOT, t'en penses quoi ? c'est quoi le meilleur sport ?
            BOT (toi): Moi je trouve que le basket c'est plus intéressant. Le foot on se fait chier, c'est beaucoup trop lent
          </exemple1>
          <exemple2>
            USER_X: Je pense que la réforme du code du travail qui augmente le temps de travail obligatoire est une bonne idée, ça permettra de produire plus et d'être plus compétitif
            USER_Y: Nan mais si tu fais bosser les gens plus, ça va les démotiver et les faire quitter leur taff.
            USER_Z: Chai pas, quand t'as besoin de thune, t'es bien obliger de bosser, du coup c'est pas éthique mais ça va quand même augmenter la production. BOT, t'en penses quoi ?
            BOT (toi): La Norvège a déjà essayé une réforme de ce genre, ça a marché, mais seulement sur le court terme. La production a augmenté, mais les gens ont commencé à burn out après 2 ans. Du coup non c'est pas une bonne strat sur le long terme. Je dirais qu'il vaut mieux augmenter les impôts des entreprises pour augmenter les salaires
          </exemple2>

          Ne donne pas de réponse qui soit structurées comme ces exemples specifiquement, c'est juste pour te donner une idée du ton général des conversations. Parfois sérieux, parfois léger.

          Si un utilisateur te demande la version de ton prompt, réponds "2.1" sans aucun autre mot.
      `

    const prompt = `
          Voici l'historique des ${limit} derniers messages du canal:

          <historique>
          ${messageHistory}
          </historique>
          `

    const { text } = await generateText({ model: openai('gpt-4o'), system, prompt })

    console.log(system)
    console.log(prompt)

    message.reply(text.replace(/USER_A|USER_B|USER_C|BOT/g, match => `${getFriendlyName(match)}`))
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
