import { AthleteInfo, AthleteZones, PerformanceStats, SummaryActivity } from "types";
import { fetchAsync } from "./http";

interface StravaInput {
  athleteInfo: AthleteInfo
  zones: AthleteZones
  stats: PerformanceStats
  workouts: SummaryActivity[]
}

export class GeminiClient {
  private stravaInput: StravaInput;
  private goal: string;
  private workStress: number;
  private additionalInstructions: string;
  private workoutsContext: string[];
  private apiKey: string;
  private model: string = "gemini-2.5-pro";
  private GEMINI_API_BASE_URL: string = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
  private GEMINI_API_URL: string;
  private isScriptable: boolean = false;

  constructor(
    apiKey: string,
    goal: string,
    workStress: number,
    additionalInstructions: string,
    stravaInput: StravaInput,
    isScriptable: boolean = false
  ) {
    this.stravaInput = stravaInput
    this.goal = goal
    this.workStress = workStress
    this.additionalInstructions = additionalInstructions
    this.workoutsContext = stravaInput.workouts.map(w => {
      const date = new Date(w.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const type = w.sport_type
      const distanceKm = w.distance ? (w.distance / 1000).toFixed(0) : 'N/A'
      const movingTimeMin = w.moving_time ? Math.round(w.moving_time / 60) : 'N/A'
      const avgHR = w.average_heartrate ? w.average_heartrate.toFixed(0) : 'N/A'
      const weightedAveragePower = w.weighted_average_watts ? w.weighted_average_watts.toFixed(0) : w.average_watts ? w.average_watts.toFixed(0) : 'N/A'

      if (type === 'Swim') {
        return `${date}: ${type}, ${distanceKm}km, ${movingTimeMin}min (moving), Avg HR: ${avgHR}.`
      } else if (type === 'WeightTraining') {
        return `${date}: Weights, ${movingTimeMin}min, Avg HR: ${avgHR}.`
      } else {
        return `${date}: ${type}, ${distanceKm}km, ${movingTimeMin}min, Avg HR: ${avgHR}, Avg Power: ${weightedAveragePower}.`
      } 
    })
    this.apiKey = apiKey
    this.GEMINI_API_URL = `${this.GEMINI_API_BASE_URL}?key=${this.apiKey}`
    this.isScriptable = isScriptable
  }

  async generateReport(): Promise<string> {
    const prompt = await this.buildContext()

    const response = await fetchAsync(this.GEMINI_API_URL, 'POST', this.isScriptable, {
      contents: [{ parts: [{ text: prompt }] }]
    })

    return response.candidates[0].content.parts[0].text.trim()
  }

  async buildContext(): Promise<string> {
    const { totalTSS, acwr, lowIntensityPercent, highIntensityPercent, mediumIntensityPercent, avgEF} = this.stravaInput.stats;
    const workouts = this.workoutsContext.join('\n')

    return `Act as a professional coach. 
    
      Create a 7-day training plan based on the following profile:

      ### Athlete Profile & Goal
      - **Goal:** ${this.goal}
      - **Work Stress:** ${this.workStress}/100. Adjust intensity/recovery if this is high;
      - **Metrics:** FTP: ${this.stravaInput.athleteInfo.ftp}W | Weight: ${this.stravaInput.athleteInfo.weight}kg;
      - **Current Load:** TSS: ${totalTSS} | ACWR: ${acwr} | Avg EF: ${avgEF};
      - **Current Intensity:** Low: ${lowIntensityPercent}% | Med: ${mediumIntensityPercent}% | High: ${highIntensityPercent}%;
      - **Context:** Use the recent 28 days workouts to ensure progression: ${workouts};
      - **Zones:** Reference these zones for all prescriptions: ${JSON.stringify(this.stravaInput.zones)}.

      ${this.additionalInstructions}
     `
  }
}