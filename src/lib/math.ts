import {
  AthleteZones,
  PerformanceStats,
  SummaryActivity
} from '../types'

/**
 * Calculate Normalized Power (NP) from raw power stream data
 * Per project instructions:
 * 1. 30-second rolling average of watts
 * 2. Raise to 4th power
 * 3. Mean of powered values
 * 4. Take 4th root
 */
function calculateNormalizedPower(wattsData: number[], timeData: number[]): number {
  if (!wattsData || !timeData || wattsData.length === 0) return 0;
  
  // Create second-by-second interpolated data if needed
  const secondBySecond: number[] = [];
  for (let i = 0; i < wattsData.length; i++) {
    const watts = wattsData[i];
    const duration = i === 0 ? 1 : timeData[i] - timeData[i - 1];
    for (let j = 0; j < Math.min(duration, 15); j++) {
      secondBySecond.push(watts);
    }
  }
  
  if (secondBySecond.length < 30) return 0;
  
  // Calculate 30-second rolling average, then raise to 4th power
  const powered: number[] = [];
  for (let i = 29; i < secondBySecond.length; i++) {
    let sum = 0;
    for (let j = i - 29; j <= i; j++) {
      sum += secondBySecond[j];
    }
    const avg = sum / 30;
    powered.push(Math.pow(avg, 4));
  }
  
  // Mean of powered values
  const meanPowered = powered.reduce((a, b) => a + b, 0) / powered.length;
  
  // 4th root
  return Math.pow(meanPowered, 0.25);
}

/**
 * CORE MATH UTILITIES
 */
const calcCyclingData = (sec: number, np: number, ftp: number) => {
  const intensityFactor = ftp > 0 ? np / ftp : 0;
  const tss = ((sec * np * intensityFactor) / (ftp * 3600)) * 100;
  return { tss, intensityFactor };
};

const calcRunningData = (sec: number, avgPaceSecKm: number, runFtpSecKm: number) => {
  if (runFtpSecKm <= 0 || avgPaceSecKm <= 0) return { tss: 0, intensityFactor: 0 };
  const intensityFactor = runFtpSecKm / avgPaceSecKm;
  // rTSS formula accounts for the higher metabolic cost of running impact
  const tss = (sec * Math.pow(intensityFactor, 2) * 100) / 3600;
  return { tss, intensityFactor };
};

const calcSwimData = (sec: number, distanceM: number, cssSec100m: number) => {
  if (cssSec100m <= 0 || sec <= 0 || distanceM <= 0) return { tss: 0, intensityFactor: 0 };
  const avgPaceSec100m = (sec / distanceM) * 100;
  const intensityFactor = cssSec100m / avgPaceSec100m;
  const tss = (sec * intensityFactor * 100) / 3600;
  return { tss, intensityFactor };
};

const calcGymTSS = (sec: number, weight: number, isHeavy: boolean) => {
  const baseTssPerHour = isHeavy ? 65 : 35;
  // Weight Factor: Heavier athletes move more mass, increasing systemic load
  const weightFactor = 1 + (Math.max(0, weight - 70) / 500); 
  const tss = (sec / 3600) * baseTssPerHour * weightFactor;
  const intensityFactor = isHeavy ? 0.80 : 0.55;
  return { tss, intensityFactor };
};

/**
 * CALENDAR WEEK HELPER
 * Ensures week start is Monday (00:00:00)
 */
function getWeekIndex(ts: number, now: number): number {
  const getMonday = (dateObj: Date) => {
    const d = new Date(dateObj);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  };

  const currentMonday = getMonday(new Date(now * 1000));
  const activityMonday = getMonday(new Date(ts * 1000));

  const weeksDiff = Math.round((currentMonday.getTime() - activityMonday.getTime()) / (7 * 24 * 60 * 60 * 1000));

  // Index 3: Current Week | Index 0: 3 Weeks Ago
  if (weeksDiff >= 0 && weeksDiff < 4) {
    return 3 - weeksDiff;
  }
  return -1;
}

export function calculateStats(
  activities: SummaryActivity[], 
  userFtp: number,      
  userWeight: number,   
  runFtpSecKm: number,  
  cssSec100m: number,   
  zones: AthleteZones   
): PerformanceStats {
  
  const ftpZones = zones?.power?.zones?.map(z => z.max) || [];
  const hrZones = zones?.heart_rate?.zones || [];

  const BIKE_LOW = ftpZones[1] || userFtp * 0.75;
  const BIKE_MID = ftpZones[3] || userFtp * 0.95;
  const RUN_LOW = runFtpSecKm / 0.80; 
  const RUN_MID = runFtpSecKm / 1.00;
  const HR_LOW = hrZones[1]?.max || 140;
  const HR_MID = hrZones[3]?.max || 165;

  let totalTSS7d = 0, sumTSS28d = 0, totalWorkoutTime7d = 0;
  let lowTime = 0, midTime = 0, highTime = 0, totalIntTime = 0;
  let totalIF = 0, ifCount = 0, totalEF = 0, efCount = 0;
  
  const weeklyTSS = [0, 0, 0, 0];
  const now = Math.floor(Date.now() / 1000);
  const rolling7dLimit = now - (7 * 24 * 60 * 60);
  const rolling42dLimit = now - (42 * 24 * 60 * 60); // 42 days for chronic load per instructions
  
  // Get Monday of current week for totalWorkoutTime filtering
  const getMonday = (dateObj: Date) => {
    const d = new Date(dateObj);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  };
  const currentWeekMonday = getMonday(new Date(now * 1000));
  const currentWeekMondayTimestamp = currentWeekMonday.getTime() / 1000;

  activities.forEach((activity) => {
    const activityTime = new Date(activity.start_date).getTime() / 1000;
    const movingTime = activity.moving_time || 0;
    let activityTSS = 0;
    let activityIF = 0;

    // --- 1. MODALITY CALCULATIONS ---
    if (['Ride', 'VirtualRide'].includes(activity.sport_type)) {
      // Calculate NP from raw stream data per project instructions
      let np = 0;
      if (activity.watts?.data && activity.time?.data) {
        np = calculateNormalizedPower(activity.watts.data, activity.time.data);
      } else {
        // Fallback to Strava's weighted_average_watts if stream data unavailable
        np = activity.weighted_average_watts || activity.average_watts || 0;
      }
      
      // Validate FTP per instructions (though we don't throw error, we handle gracefully)
      if (userFtp <= 0) {
        console.warn('Missing or invalid FTP for cycling activity', activity.id);
      }
      
      const data = calcCyclingData(movingTime, np, userFtp);
      activityTSS = data.tss;
      activityIF = data.intensityFactor;

      if (activity.average_heartrate && np > 0 && activityIF < 0.88) {
        totalEF += (np / activity.average_heartrate);
        efCount++;
      }
    } 
    else if (activity.sport_type === 'Run' && activity.distance > 0) {
      const avgPace = movingTime / (activity.distance / 1000); 
      const data = calcRunningData(movingTime, avgPace, runFtpSecKm);
      activityTSS = data.tss;
      activityIF = data.intensityFactor;
    } 
    else if (activity.sport_type === 'Swim' && activity.distance > 0) {
      const data = calcSwimData(movingTime, activity.distance, cssSec100m);
      activityTSS = data.tss;
      activityIF = data.intensityFactor;
    } 
    else if (['WeightTraining', 'Workout', 'Crossfit'].includes(activity.sport_type)) {
      const isHeavy = (activity.suffer_score || 0) > 45 || activity.sport_type === 'WeightTraining';
      const data = calcGymTSS(movingTime, userWeight, isHeavy);
      activityTSS = data.tss;
      activityIF = data.intensityFactor;
    } 
    else {
      activityTSS = activity.suffer_score || (movingTime / 3600) * 25;
    }

    // --- 2. WEEKLY BUCKETING & AGGREGATION ---
    const wIdx = getWeekIndex(activityTime, now);
    if (wIdx >= 0 && wIdx < 4) {
      weeklyTSS[wIdx] += activityTSS;
    }

    // Acute Load (Trailing 7 Days)
    if (activityTime >= rolling7dLimit) {
      totalTSS7d += activityTSS;
      if (activityIF > 0) { totalIF += activityIF; ifCount++; }
    }
    
    // Total Workout Time (Current Week Only - Monday onwards)
    if (activityTime >= currentWeekMondayTimestamp) {
      totalWorkoutTime7d += movingTime;
    }

    // Chronic Load (Trailing 42 Days per instructions)
    if (activityTime >= rolling42dLimit) {
      sumTSS28d += activityTSS;
    }

    // --- 3. INTENSITY DISTRIBUTION (Rolling 7 Days) ---
    if (activityTime >= rolling7dLimit) {
      let val = 0;
      let limitLow = 0, limitMid = 0;
      let isPace = false;

      if (activity.sport_type === 'Run' && activity.distance > 0) {
        val = movingTime / (activity.distance / 1000);
        limitLow = RUN_LOW; limitMid = RUN_MID;
        isPace = true;
      } else if (activity.average_watts) {
        val = activity.average_watts;
        limitLow = BIKE_LOW; limitMid = BIKE_MID;
      } else if (activity.average_heartrate) {
        val = activity.average_heartrate;
        limitLow = HR_LOW; limitMid = HR_MID;
      }

      if (val > 0) {
        totalIntTime += movingTime;
        if (isPace) {
          if (val >= limitLow) lowTime += movingTime;
          else if (val >= limitMid) midTime += movingTime;
          else highTime += movingTime;
        } else {
          if (val <= limitLow) lowTime += movingTime;
          else if (val <= limitMid) midTime += movingTime;
          else highTime += movingTime;
        }
      }
    }
  });

  const chronicLoad = sumTSS28d / 6; // 42 days = 6 weeks
  const acwr = chronicLoad > 5 ? (totalTSS7d / chronicLoad) : 0;

  return {
    totalTSS7d: Math.round(totalTSS7d),
    totalWorkoutTime: totalWorkoutTime7d,
    acwr: parseFloat(acwr.toFixed(2)),
    avgIF: ifCount > 0 ? parseFloat((totalIF / ifCount).toFixed(2)) : 0,
    avgEF: efCount > 0 ? parseFloat((totalEF / efCount).toFixed(2)) : 0,
    lowIntensityPercent: totalIntTime > 0 ? Math.round((lowTime / totalIntTime) * 100) : 0,
    mediumIntensityPercent: totalIntTime > 0 ? Math.round((midTime / totalIntTime) * 100) : 0,
    highIntensityPercent: totalIntTime > 0 ? Math.round((highTime / totalIntTime) * 100) : 0,
    totalTss4Weeks: weeklyTSS.map(t => Math.round(t))
  };
}