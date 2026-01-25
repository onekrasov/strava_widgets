import { AthleteInfo, AthleteZones, PerformanceStats, SummaryActivity } from "types";
import { fetchAsync } from "./http";

export class GeminiClient {
  private stats: PerformanceStats;
  private athleteInfo: AthleteInfo;
  private zones: AthleteZones;
  private workoutsContext: string[];
  private apiKey: string;
  private model: string = "gemini-2.5-pro";
  private GEMINI_API_BASE_URL: string = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
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

    const prompt = `Act as a professional endurance coach. 
    
      Create a 7-day training plan based on the following profile:

      ### Athlete Profile & Goal
      - **Goal:** ${goal}
      - **Metrics:** FTP: ${this.athleteInfo.ftp}W | Weight: ${this.athleteInfo.weight}kg
      - **Current Load:** TSS: ${totalTSS} | ACWR: ${acwr} | Avg EF: ${avgEF}
      - **Intensity Mix:** Low: ${lowIntensityPercent}% | Med: ${mediumIntensityPercent}% | High: ${highIntensityPercent}%

      ### Life Constraints
      - **Work Stress:** ${workStress}/100 (Adjust intensity/recovery if this is high).
      - **Maintenance:** 4x1h dog walks and 1 gym session (Incorporate these into the schedule).

      ### Guidelines
      1. **Target ACWR:** Maintain between 0.8 and 1.3.
      2. **Distribution:** High-volume/Long rides and runs must be on Saturday/Sunday.
      3. **Context:** Use the recent 10 workouts to ensure progression: ${workouts}.
      4. **Zones:** Reference these zones for all prescriptions: ${JSON.stringify(this.zones)}.
      5. **Schedule Constrains** gym session is possible on Monday. Swimming sessions on Tuesday evening, Wednesday evening, Saturday morning or Sunday morning

      ### Output Requirement
      Do not use a table. Provide the response as a clean, structured list using the following format:
      - **[Day Name]**: [Emoji] [Workout Name] | [Duration] | [Target Intensity] | [Predicted TSS]
      - *Coach's Note*: [A brief 1-sentence tip based on workStress or ACWR]

      Use these emojis: 🚴‍♂️ (Bike), 🏃‍♂️ (Run), 🧘‍♂️ (Recovery/Walk), 🏋️‍♂️ (Gym).`

    const response = await fetchAsync(this.GEMINI_API_URL, 'POST', this.isScriptable, {
      contents: [{ parts: [{ text: prompt }] }]
    })

    const report = response.candidates[0].content.parts[0].text.trim()

    return report
  }
}