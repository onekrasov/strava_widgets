import {
  AthleteZones,
  PerformanceStats,
  SummaryActivity
} from '../types'

/**
 * TSS = [(sec * NP * IF) / (FTP * 3600)] * 100
 * We use moving_time to reflect actual work performed.
 */
function calculateCyclingTSS(movingTime: number, np: number, ftp: number): number {
  if (ftp <= 0) return 0
  const intensityFactor = np / ftp
  return ((movingTime * np * intensityFactor) / (ftp * 3600)) * 100
}

export function calculateStats(activities: SummaryActivity[], userFtp: number, userWeight: number, zones: AthleteZones): PerformanceStats {
  const hrZones = zones.heart_rate?.zones || [];
  const ftpZones = zones.power?.zones?.map(z => z.max) || []; // Using Max to define boundaries

  // 1. DYNAMIC ZONE BOUNDARIES
  // Low: Up to end of Z2 | Mid: Z3 to end of Z4 | High: Z5+
  const ZLOW_END = ftpZones[1] || userFtp * 0.75;
  const ZMID_END = ftpZones[3] || userFtp * 0.95;

  // HR Boundaries (using actual user zones if available, fallback to Max HR % logic)
  const HR_LOW_END = hrZones[1]?.max || getMaxHeartRate(zones) * 0.80;
  const HR_MID_END = hrZones[3]?.max || getMaxHeartRate(zones) * 0.90;

  let totalTSS7d = 0
  let sumTSS28d = 0
  let totalWorkoutTime7d = 0

  let lowIntensityTime = 0
  let mediumIntensityTime = 0
  let highIntensityTime = 0
  let totalIntensityTime = 0

  let totalIF = 0
  let ifCount = 0

  let totalEF = 0
  let efCount = 0

  const now = Math.floor(Date.now() / 1000)
  const sevenDaysAgo = now - (7 * 24 * 60 * 60)
  const twentyEightDaysAgo = now - (28 * 24 * 60 * 60)

  if (!activities || activities.length === 0) {
    return { totalTSS: 0, totalWorkoutTime: 0, acwr: 0, avgIF: 0, lowIntensityPercent: 0, mediumIntensityPercent: 0, highIntensityPercent: 0, avgEF: 0 }
  }

  activities.forEach((activity) => {
    const activityTime = new Date(activity.start_date).getTime() / 1000
    const movingTime = activity.moving_time || 0
    const isCycling = ['Ride', 'VirtualRide', 'EBikeRide'].includes(activity.sport_type)

    // Normalized Power (Strava's weighted_average_watts)
    const np = activity.weighted_average_watts || activity.average_watts || 0

    let activityTSS = 0

    // 1. TSS CALCULATION
    if (isCycling && np > 0 && userFtp > 0) {
      activityTSS = calculateCyclingTSS(movingTime, np, userFtp)
      const intensityFactor = np / userFtp
      if (activityTime >= sevenDaysAgo) {
        totalIF += intensityFactor
        ifCount++
      }
    } else if (activity.suffer_score) {
      activityTSS = activity.suffer_score // Fallback to HR-based stress
    }

    // 2. AGGREGATE LOAD (Chronic vs Acute)
    if (activityTime >= twentyEightDaysAgo) {
      sumTSS28d += activityTSS
      if (activityTime >= sevenDaysAgo) {
        totalTSS7d += activityTSS
        totalWorkoutTime7d += movingTime
      }
    }

    // 3. INTENSITY DISTRIBUTION (Last 7 Days)
    if (activityTime >= sevenDaysAgo) {
      const hasPowerStream = activity.watts?.data && activity.time?.data;
      const hasHRStream = activity.heartrate?.data && activity.time?.data;

      if (isCycling && hasPowerStream) {
        const powerData = activity.watts.data;
        const timeData = activity.time.data;

        for (let i = 0; i < powerData.length; i++) {
          const duration = i === 0 ? 1 : timeData[i] - timeData[i - 1];
          if (duration > 15 || duration <= 0) continue;

          const watts = powerData[i];
          totalIntensityTime += duration;
          if (watts <= ZLOW_END) lowIntensityTime += duration;
          else if (watts <= ZMID_END) mediumIntensityTime += duration;
          else highIntensityTime += duration;
        }
      }
      else if (hasHRStream) {
        const hrData = activity.heartrate.data;
        const timeData = activity.time.data;

        for (let i = 0; i < hrData.length; i++) {
          const duration = i === 0 ? 1 : timeData[i] - timeData[i - 1];
          if (duration > 15 || duration <= 0) continue;

          const hrVal = hrData[i];
          totalIntensityTime += duration;
          if (hrVal <= HR_LOW_END) lowIntensityTime += duration;
          else if (hrVal <= HR_MID_END) mediumIntensityTime += duration;
          else highIntensityTime += duration;
        }
      }
    }

    // 4. EFFICIENCY FACTOR (Aerobic Rides Only: IF < 0.85)
    if (isCycling && activity.average_heartrate && np > 0) {
      const currentIF = np / userFtp;
      if (currentIF < 0.85) {
        totalEF += (np / activity.average_heartrate)
        efCount++
      }
    }
  })

  /**
   * ACWR Logic: 
   * Acute (7d sum) / Chronic (Average weekly sum over 28 days)
   */
  const acuteLoad = totalTSS7d
  const chronicLoad = sumTSS28d / 4
  const acwr = (chronicLoad > 10) ? (acuteLoad / chronicLoad) : 0

  return {
    totalTSS: Math.round(totalTSS7d),
    totalWorkoutTime: totalWorkoutTime7d,
    acwr: parseFloat(acwr.toFixed(2)),
    avgIF: ifCount > 0 ? parseFloat((totalIF / ifCount).toFixed(2)) : 0,
    lowIntensityPercent: totalIntensityTime > 0 ? Math.round((lowIntensityTime / totalIntensityTime) * 100) : 0,
    mediumIntensityPercent: totalIntensityTime > 0 ? Math.round((mediumIntensityTime / totalIntensityTime) * 100) : 0,
    highIntensityPercent: totalIntensityTime > 0 ? Math.round((highIntensityTime / totalIntensityTime) * 100) : 0,
    avgEF: efCount > 0 ? parseFloat((totalEF / efCount).toFixed(2)) : 0
  }
}

function getMaxHeartRate(zones: AthleteZones): number {
  if (zones.heart_rate?.zones) {
    const max = Math.max(...zones.heart_rate.zones.map(z => z.max));
    if (max > 0) return max;
  }
  return 185;
}