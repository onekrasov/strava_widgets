import { GeminiClient, Strava, calculateStats, Telegram } from "lib"
import { config as dotenvConfig } from "dotenv"
dotenvConfig({ override: false })

const CLIENT_ID = process.env.CLIENT_ID || ""
const CLIENT_SECRET = process.env.CLIENT_SECRET || ""
const REFRESH_TOKEN = process.env.REFRESH_TOKEN || ""
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ""
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ""
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || ""
const CONTEXT_TRAINING_GOAL = process.env.CONTEXT_TRAINING_GOAL || ""
const CONTEXT_WORK_STRESS = parseInt(process.env.CONTEXT_WORK_STRESS || "0", 10)
const CONTEXT_ADDITIONAL_INSTRUCTIONS = process.env.CONTEXT_ADDITIONAL_INSTRUCTIONS || ""

async function main() {
  const stravaClient = new Strava(
    CLIENT_ID,
    CLIENT_SECRET,
    REFRESH_TOKEN
  )
  const telegramClient = new Telegram(
    TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID
  )
  await stravaClient.getToken()

  const [activities, athleteInfo, zones] = await Promise.all([
    stravaClient.loadActivities(),
    stravaClient.getAthleteInfo(),
    stravaClient.getAthleteZones()
  ])
  const stravaInput = {
    athleteInfo,
    zones,
    stats: calculateStats(activities, athleteInfo?.ftp || 0, athleteInfo?.weight || 0, zones),
    workouts: activities
  }
  
  const geminiClient = new GeminiClient(GEMINI_API_KEY, CONTEXT_TRAINING_GOAL, CONTEXT_WORK_STRESS, CONTEXT_ADDITIONAL_INSTRUCTIONS, stravaInput, false)
  const report = await geminiClient.generateReport()
  
  await telegramClient.sendMessage(report)
}

main().catch(e => {
  console.error("Error in main():", e)
  // Exit with failure code
  process.exit(1)
})