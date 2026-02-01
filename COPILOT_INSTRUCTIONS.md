# Copilot Project Instructions: Strava Analytics Engine

## 1. Project Context
This project processes raw Strava activity streams (time, watts, heartrate, velocity_smooth) to calculate physiological training load metrics. 
**CRITICAL:** All calculations must adhere strictly to the formulas defined below to maintain data integrity across the application.

## 2. Domain Logic & Formulas (The "Golden Rules")

### A. Normalized Power (NP)
**Constraint:** Do not use simple averages for power.
1.  **Resample/Interpolate:** Ensure data is on a second-by-second basis.
2.  **Rolling Average:** Calculate a 30-second rolling average of the `watts` stream.
3.  **Power:** Raise values to the 4th power.
4.  **Average:** Mean of the powered values.
5.  **Root:** Take the 4th root.
   $$NP = \sqrt[4]{\text{mean}(\text{rolling\_30s}(\text{watts})^4)}$$

### B. Intensity Factor (IF)
*Ratio of session intensity to threshold.*
   $$IF = \frac{NP}{FTP}$$
   * **FTP Default:** If user FTP is missing, raise a `MissingBioDataError`.

### C. Training Stress Score (TSS)
*Total metabolic cost.*
   $$TSS = \left( \frac{\text{duration\_sec} \times NP \times IF}{FTP \times 3600} \right) \times 100$$
   * **Input:** `duration_sec` must be "Moving Time" (exclude pauses), not "Elapsed Time".

### D. Acute:Chronic Workload Ratio (ACWR)
*Fatigue vs. Fitness balance.*
1.  **Acute Load (ATL):** Exponentially Weighted Moving Average (EWMA) or simple rolling average of TSS over **7 days**.
2.  **Chronic Load (CTL):** Rolling average of TSS over **42 days** (preferred) or 28 days.
3.  **Ratio:** $ACWR = ATL / CTL$.

## 3. Data Schema & Input Handling
The system ingests Strava Activity Streams.
**Expected JSON Structure:**
```json
{
  "time": [0, 1, 2, ...],        // Seconds
  "watts": [100, 120, ...],      // Power (nullable)
  "heartrate": [140, 145, ...],  // BPM (nullable)
  "velocity_smooth": [8.5, ...]  // Meters/second
}
```