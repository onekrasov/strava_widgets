
import { describe, expect, test, beforeAll } from "bun:test"
import { GeminiClient } from "../lib/gemini"
import { calculateStats } from "../lib/math"
import { Strava } from "../lib/strava"
import { config as dotenvConfig } from "dotenv"
dotenvConfig()
const CLIENT_ID = process.env.CLIENT_ID || ""
const CLIENT_SECRET = process.env.CLIENT_SECRET || ""
const REFRESH_TOKEN = process.env.REFRESH_TOKEN || ""
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ""

const strava = new Strava(
  CLIENT_ID,
  CLIENT_SECRET,
  REFRESH_TOKEN
)

let geminiClient: GeminiClient

describe("Gemini API Integration", () => {
  beforeAll(async () => {
    const activities = await strava.loadActivities()
    const athleteInfo = await strava.getAtheleteInfo()
    const zones = await strava.getAthleteZones()
    const stats = calculateStats(activities, athleteInfo?.ftp || 0, athleteInfo?.weight || 0, zones)
    geminiClient = new GeminiClient(GEMINI_API_KEY, athleteInfo, zones, stats, activities)
  }, 60000)
  // Set timeout for this test to 60 seconds
  test('generateReport', async () => {
    const report = await geminiClient.generateReport("IM 70.3 Alghero in 5h 30min", 70)
    expect(typeof report).toBe("string")
    expect(report.length).toBeGreaterThan(0)

    console.log("Generated Report:\n", report)
  }, 60000)
})
