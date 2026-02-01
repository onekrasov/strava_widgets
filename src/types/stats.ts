/**
 * Represents the performance and load metrics calculated from 
 * a collection of Strava activities.
 */
export interface PerformanceStats {
  /** Total Training Stress Score accumulated over the last 7 days */
  totalTSS7d: number;

  /** Total moving time in seconds for activities in the last 7 days */
  totalWorkoutTime: number;

  /** * Acute:Chronic Workload Ratio. 
   * < 0.8: Underloading
   * 0.8 - 1.3: Optimal Training Zone (The "Sweet Spot")
   * > 1.5: Danger Zone (Increased injury risk)
   */
  acwr: number;

  /** * Average Intensity Factor (NP / FTP). 
   * Measures how hard the average session was relative to threshold.
   */
  avgIF: number;

  /** Percentage of total time spent in Low Intensity (Zone 1-2) */
  lowIntensityPercent: number;

  /** Percentage of total time spent in Medium Intensity (Zone 3) */
  mediumIntensityPercent: number;

  /** Percentage of total time spent in High Intensity (Zone 4-5) */
  highIntensityPercent: number;

  /** * Average Efficiency Factor. 
   * Ratio of output (Watts or Speed) to input (Heart Rate).
   */
  avgEF: number;


  /** TSS for each of the last 4 weeks (Monday to Sunday), oldest to newest */
  totalTss4Weeks: number[];
}