import { AthleteInfo, AthleteZones, PerformanceStats, SummaryActivity } from "types";
import { fetchAsync } from "./http";

export class GeminiClient {
  private stats: PerformanceStats;
  private athleteInfo: AthleteInfo;
  private zones: AthleteZones;
  private workoutsContext: string[];
  private apiKey: string;
  private GEMINI_API_BASE_URL: string = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
  private GEMINI_API_URL: string;
  private isScriptable: boolean = false;

  constructor(apiKey: string, athleteInfo: AthleteInfo, zones: AthleteZones, stats: PerformanceStats, workouts: SummaryActivity[], isScriptable: boolean = false) {
    this.athleteInfo = athleteInfo
    this.zones = zones
    this.stats = stats
    // remove velocity_smooth, watts, heartrate, time, distance_stream
    // simplifu workouts for prompt size limits
    // Jan 14: Ride, 32km, 1h 06m, Avg Watts: 231, Avg HR: 142.
    // Jan 13: Swim, 2275m, 45m (moving), Avg HR: 126.
    // Jan 12: Weights, 1h 08m, Avg HR: 94
    this.workoutsContext = workouts.map(w => {
      const date = new Date(w.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const type = w.sport_type
      const distanceKm = w.distance ? (w.distance / 1000).toFixed(0) : 'N/A'
      const movingTimeMin = w.moving_time ? Math.round(w.moving_time / 60) : 'N/A'
      const avgWatts = w.average_watts ? w.average_watts.toFixed(0) : 'N/A'
      const avgHR = w.average_heartrate ? w.average_heartrate.toFixed(0) : 'N/A'

      if (type === 'Swim') {
        return `${date}: ${type}, ${distanceKm}m, ${movingTimeMin}m (moving), Avg HR: ${avgHR}.`
      } else if (type === 'WeightTraining') {
        return `${date}: Weights, ${movingTimeMin}m, Avg HR: ${avgHR}.`
      } else {
        return `${date}: ${type}, ${distanceKm}km, ${movingTimeMin}m, Avg Watts: ${avgWatts}, Avg HR: ${avgHR}.`
      } 
    })
    this.apiKey = apiKey
    this.GEMINI_API_URL = `${this.GEMINI_API_BASE_URL}?key=${this.apiKey}`
    this.isScriptable = isScriptable
  }
  // Work stress % from 0 to 100
  async generateReport(goal: string, workStress: number): Promise<string> {
    const { totalTSS, acwr, lowIntensityPercent, highIntensityPercent, mediumIntensityPercent, avgEF} = this.stats;
    const workouts = this.workoutsContext.slice(0, 10).join(' ')

    const prompt = `I am training ${goal}. 
      My profile: FTP: ${this.athleteInfo.ftp}W, Weight: ${this.athleteInfo.weight}kg, ${this.athleteInfo}.
      Training Zones: ${JSON.stringify(this.zones)}.
      Current Week Stats: TSS: ${totalTSS}, ACWR: ${acwr}, Low Intensity: ${lowIntensityPercent}%, Medium Intensity: ${mediumIntensityPercent}%, High Intensity: ${highIntensityPercent}%, Avg EF: ${avgEF}. 
      My recent 10 workouts: ${workouts}.
      I have 4x1h dog walks and 1 gym session weekly. 
      My work stress level is at ${workStress} out of 100.
      Suggest specific workouts for the next 3 days to keep my ACWR in the 0.8-1.3 range.`

    const response = await fetchAsync(this.GEMINI_API_URL, 'POST', this.isScriptable, {
      contents: [{ parts: [{ text: prompt }] }]
    })

    const report = response.candidates[0].content.parts[0].text.trim()

    return report
  }
}