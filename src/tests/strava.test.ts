
import { describe, expect, test } from "bun:test"
import { Strava } from "../lib/strava"
import { calculateStats } from "../lib/math"
import fs from "fs"
import { config as dotenvConfig } from "dotenv"
dotenvConfig()

const CLIENT_ID = process.env.CLIENT_ID || ""
const CLIENT_SECRET = process.env.CLIENT_SECRET || ""
const REFRESH_TOKEN = process.env.REFRESH_TOKEN || ""

const strava = new Strava(
  CLIENT_ID,
  CLIENT_SECRET,
  REFRESH_TOKEN
)

describe("Strava API Integration", () => {
  test('loadActivities returns an array of activities', async () => {
    const activities = await strava.loadActivities()

    expect(Array.isArray(activities)).toBe(true)

    if (activities.length > 0) {
      expect(activities[0]).toHaveProperty('id')
      expect(activities[0]).toHaveProperty('sport_type')
      expect(activities[0]).toHaveProperty('start_date')
    }
  }, 60000)

  test('calculateStats computes statistics correctly', async () => {
    const activities = await strava.loadActivities()
    const athleteInfo = await strava.getAthleteInfo()
    const zones = await strava.getAthleteZones()
    const stats = calculateStats(
      activities, 
      athleteInfo?.ftp || 0, 
      athleteInfo?.weight || 0, 
      285,
      115,
      zones
    )
    fs.writeFileSync(`./cache/stats-${new Date().toISOString()}.json`, JSON.stringify(stats, null, 2))
    expect(stats).toHaveProperty('totalTSS')
    expect(stats).toHaveProperty('totalWorkoutTime')
    expect(stats).toHaveProperty('acwr')
    expect(stats).toHaveProperty('avgIF')
    expect(stats).toHaveProperty('lowIntensityPercent')
    expect(stats).toHaveProperty('mediumIntensityPercent')
    expect(stats).toHaveProperty('highIntensityPercent')
    expect(stats).toHaveProperty('avgEF')
  }, 60000)

  test('getAthleteInfo returns athlete information', async () => {
    const athleteInfo = await strava.getAthleteInfo()
    expect(athleteInfo).toHaveProperty('id')
    expect(athleteInfo).toHaveProperty('ftp')
    expect(athleteInfo).toHaveProperty('weight')
  })
})
