import { calculateStats } from "./lib/math"
import { Strava } from "./lib/strava"
import type {
  AthleteInfo,
  AthleteZones,
  PerformanceStats,
  SummaryActivity,
} from "./types"

// Scriptable globals - no need to import, they're available globally in Scriptable
declare const ListWidget: any
declare const Color: any
declare const LinearGradient: any
declare const Font: any
declare const Size: any
declare const Script: any
declare const config: any
declare const Keychain: any
declare const Alert: any
declare const args: any

const CLIENT_ID = Keychain.get("STRAVA_CLIENT_ID")
const CLIENT_SECRET = Keychain.get("STRAVA_CLIENT_SECRET")
const REFRESH_TOKEN = Keychain.get("STRAVA_REFRESH_TOKEN")
const GEMINI_API_KEY = Keychain.get("GEMINI_API_KEY")
const GOAL = Keychain.get("TRAINING_GOAL")
const WORK_STRESS = parseInt(Keychain.get("WORK_STRESS_LEVEL") || "50", 10)

async function createWidget(stats: PerformanceStats): Promise<any> {
  const list = new ListWidget()

  // Set Colors
  let bg1 = new Color('#514e4eff')
  let bg2 = new Color('#282727ff')
  let textColor = new Color('#ffffff')
  let labelColor = new Color('#aaaaaa')
  let separatorColor = new Color('#555555')

  // Set gradient background
  let gradient = new LinearGradient()
  gradient.locations = [0, 1]
  gradient.colors = [bg1, bg2]
  list.backgroundGradient = gradient

  // Helper function to add a table row
  function addRow(label: string, value: string, valueColor = textColor, valueFontSize = 16) {
    let row = list.addStack()
    row.layoutHorizontally()
    row.centerAlignContent()

    let labelText = row.addText(label)
    labelText.font = Font.regularSystemFont(11)
    labelText.textColor = labelColor
    labelText.leftAlignText()

    row.addSpacer()

    let valueText = row.addText(value)
    valueText.font = Font.boldSystemFont(valueFontSize)
    valueText.textColor = valueColor
    valueText.rightAlignText()
  }

  function addSeparator() {
    list.addSpacer(2)
    let sep = list.addStack()
    sep.backgroundColor = separatorColor
    sep.size = new Size(0, 1)
    list.addSpacer(2)
  }

  // Main metrics section
  addRow("TSS", stats.totalTSS.toString(), textColor, 18)
  list.addSpacer(3)
  addRow("Time", formatTime(stats.totalWorkoutTime), textColor, 18)

  addSeparator()

  // Training load metrics
  if (stats.acwr > 0) {
    let acwrColor = textColor
    if (stats.acwr >= 0.8 && stats.acwr <= 1.3) {
      acwrColor = new Color('#00FF00') // Green - optimal
    } else if (stats.acwr > 1.5) {
      acwrColor = new Color('#FF4444') // Red - high injury risk
    } else {
      acwrColor = new Color('#FFD700') // Yellow - caution
    }
    addRow("ACWR", stats.acwr.toFixed(2), acwrColor, 14)
    list.addSpacer(3)
  }

  if (stats.avgIF > 0) {
    addRow("Intensity", stats.avgIF.toFixed(2), textColor, 14)
    list.addSpacer(3)
  }

  if (stats.avgEF > 0) {
    addRow("Efficiency", stats.avgEF.toFixed(2), textColor, 14)
    list.addSpacer(3)
  }

  // 80/20 Distribution
  if (stats.lowIntensityPercent > 0 || stats.highIntensityPercent > 0) {
    addSeparator()

    // Distribution label and percentages
    let distRow = list.addStack()
    distRow.layoutHorizontally()

    let distLabel = distRow.addText("Zone")
    distLabel.font = Font.regularSystemFont(11)
    distLabel.textColor = labelColor

    distRow.addSpacer()

    let percentText = distRow.addText(`${stats.lowIntensityPercent.toFixed(0)}% / ${stats.mediumIntensityPercent.toFixed(0)}% / ${stats.highIntensityPercent.toFixed(0)}%`)
    percentText.font = Font.boldSystemFont(11)
    percentText.textColor = textColor

    list.addSpacer(3)

    // Progress bar for 80/20
    let barStack = list.addStack()
    barStack.layoutHorizontally()
    barStack.size = new Size(0, 10)

    let lowBar = barStack.addStack()
    lowBar.backgroundColor = new Color('#4CAF50')
    lowBar.size = new Size(stats.lowIntensityPercent * 1.4, 10)
    lowBar.cornerRadius = 5

    // add stats.mediumIntensityPercent
    let mediumBar = barStack.addStack()
    mediumBar.backgroundColor = new Color('#666')
    mediumBar.size = new Size(stats.mediumIntensityPercent * 1.4, 10)
    mediumBar.cornerRadius = 5

    barStack.addSpacer(2)

    let highBar = barStack.addStack()
    highBar.backgroundColor = new Color('#FF5722')
    highBar.size = new Size(stats.highIntensityPercent * 1.4, 10)
    highBar.cornerRadius = 5
  }

  // Show notification with text summary when tapped
  list.url = "scriptable:///run?scriptName=ai_coach&action=showSummary"

  return list
}

async function main() {
  try {
    const strava = new Strava(CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN, true)
    
    // 1. Fetch data concurrently to avoid Widget timeouts
    await strava.getToken()

    const [activities, athleteInfo, zones] = await Promise.all([
      strava.loadActivities(),
      strava.getAthleteInfo(),
      strava.getAthleteZones()
    ])

    // 2. Calculate stats
    if (!athleteInfo) throw new Error("Athlete info missing")

    const { ftp, weight } = athleteInfo
    if (!ftp || !weight) throw new Error("FTP/Weight missing")

    const stats = calculateStats(activities, ftp, weight, zones)

    if (config.runsInWidget) {
      const widget = await createWidget(stats)
      Script.setWidget(widget)
    } else {
      console.log("Not running in widget mode")
    }
  } catch (error: any) {
    console.error(error)
    // Create simple error widget so the Home Screen isn't blank
    if (config.runsInWidget) {
      let w = new ListWidget()
      w.addText("Error: " + error.message)
      Script.setWidget(w)
    }
  } finally {
    Script.complete() // 3. Always complete the script
  }
}

main()

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}