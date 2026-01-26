
import { describe, test, beforeAll } from "bun:test"
import { Strava, GeminiClient, calculateStats } from "../lib"
import fs from "fs"
import { config as dotenvConfig } from "dotenv"
dotenvConfig()

const CLIENT_ID = process.env.CLIENT_ID || ""
const CLIENT_SECRET = process.env.CLIENT_SECRET || ""
const REFRESH_TOKEN = process.env.REFRESH_TOKEN || ""
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ""
const WORK_STRESS = parseInt(process.env.CONTEXT_WORK_STRESS || "50", 10)
const TRAININT_GOAL = process.env.CONTEXT_TRAINING_GOAL || "Improve cycling endurance for a century ride."
const ADDITIONAL_INSTRUCTIONS = process.env.CONTEXT_ADDITIONAL_INSTRUCTIONS || ""

const strava = new Strava(
  CLIENT_ID,
  CLIENT_SECRET,
  REFRESH_TOKEN
)

let gemini: GeminiClient
let prompt: string

describe("Strava API Integration", () => {
  beforeAll(async () => {
    await strava.getToken()
    const [activities, athleteInfo, zones] = await Promise.all([
      strava.loadActivities(),
      strava.getAthleteInfo(),
      strava.getAthleteZones()
    ])
    const stats = calculateStats(activities, athleteInfo?.ftp || 0, athleteInfo?.weight || 0, zones)
    const stravaInput = {
      athleteInfo,
      zones,
      stats,
      workouts: activities
    }
    gemini = new GeminiClient(
      GEMINI_API_KEY,
      TRAININT_GOAL,
      WORK_STRESS,
      ADDITIONAL_INSTRUCTIONS,
      stravaInput,
      false
    )
  }, 60000)

  test('Get prompt', async () => {
    prompt = await gemini.buildContext()

    fs.writeFileSync(`./cache/gemini-prompt-${new Date().toISOString()}.txt`, prompt)
  }, 60000)
  // Disable test
  test.skip('Generate report', async () => {
    const report = await gemini.generateReport()

    fs.writeFileSync(`./cache/gemini-report-${new Date().toISOString()}.txt`, report)
  }, 60000)
})
