import { GeminiClient, Strava, calculateStats, Telegram } from "lib"
import { config as dotenvConfig } from "dotenv"
dotenvConfig({ override: false })

const CLIENT_ID = process.env.CLIENT_ID || ""
const CLIENT_SECRET = process.env.CLIENT_SECRET || ""
const REFRESH_TOKEN = process.env.REFRESH_TOKEN || ""
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ""
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ""
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || ""

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
  const activities = await stravaClient.loadActivities()
  const athleteInfo = await stravaClient.getAthleteInfo()
  const zones = await stravaClient.getAthleteZones()
  const stats = calculateStats(activities, athleteInfo?.ftp || 0, athleteInfo?.weight || 0, zones)
  
  const geminiClient = new GeminiClient(GEMINI_API_KEY, athleteInfo, zones, stats, activities)
  const report = await geminiClient.generateReport("IM 70.3 Alghero in 5h 30min", 70)
  
  await telegramClient.sendMessage(report)
}

main().catch(e => {
  console.error("Error in main():", e)
  // Exit with failure code
  process.exit(1)
})