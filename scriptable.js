const clientID = "" // your client id here
const clientSecret = "" // your secret here
const refreshToken = "" // your refresh token here
// User metrics
const USER_FTP = 277                // Your Functional Threshold Power (watts) for cycling
const MAX_HR = 170                  // Estimated maximum heart rate
const LOW_INTENSITY_THRESHOLD = 75  // HR % below this is Zone 1-2 (easy)
const HIGH_INTENSITY_THRESHOLD = 85 // HR % above this is Zone 4-5 (hard)
const MIN_CHRONIC_LOAD = 5          // Minimum avg daily TSS to calculate ACWR

const callActivities = "https://www.strava.com/api/v3/athlete/activities?access_token="
const apiURL = (clientID, clientSecret, refreshToken) => `https://www.strava.com/oauth/token?client_id=${clientID}&client_secret=${clientSecret}&refresh_token=${refreshToken}&grant_type=refresh_token`

const saveActivitiesData = (data) => {
  let fm = FileManager.iCloud();
  let path = fm.joinPath(fm.documentsDirectory(), 'activities-widget-data.json');
  fm.writeString(path, JSON.stringify(data));
};

const getSavedActivitiesData = () => {
  let fm = FileManager.iCloud();
  let path = fm.joinPath(fm.documentsDirectory(), 'activities-widget-data.json');
  if (fm.fileExists(path)) {
    let data = fm.readString(path);
    return JSON.parse(data);
  }
  return null;
};

async function loadActivities(clientID, clientSecret, refreshToken) {
  try {
    const req = new Request(apiURL(clientID, clientSecret, refreshToken))
    req.method = "POST"
    let response = await req.loadJSON()
    const accessToken = response.access_token

    // Get activities from past 28 days for ACWR calculation
    const twentyEightDaysAgo = Math.floor(Date.now() / 1000) - (28 * 24 * 60 * 60)
    const activities = await new Request(callActivities + accessToken + "&after=" + twentyEightDaysAgo + "&per_page=200").loadJSON()

    // Save to local storage
    saveActivitiesData(activities)
    console.log('Using online data - fetched ' + activities.length + ' activities from past 28 days')

    return activities

  } catch (e) {
    // If API is offline, use local data
    console.log('API error, using saved data: ' + e.message)
    const savedData = getSavedActivitiesData()
    if (savedData) {
      return savedData
    }
    throw new Error('No saved data available')
  }
}

function calculateStats(activities) {
  let totalTSS = 0
  let totalWorkoutTime = 0 // in seconds
  
  // For ACWR calculation
  let tss7days = []
  let tss28days = []
  
  // For 80/20 distribution
  let lowIntensityTime = 0
  let highIntensityTime = 0
  
  // For Intensity Factor
  let totalIF = 0
  let ifCount = 0
  
  // For Efficiency Factor
  let totalEF = 0
  let efCount = 0
  
  const now = Math.floor(Date.now() / 1000)
  const sevenDaysAgo = now - (7 * 24 * 60 * 60)
  const twentyEightDaysAgo = now - (28 * 24 * 60 * 60)

  activities.forEach(activity => {
    // Only include cycling, swimming, and running activities
    const allowedTypes = [
      'Run', 'VirtualRun', 'Treadmill',
      'Ride', 'VirtualRide', 'EBikeRide', 
      'Swim', 'Pool Swim', 'Open Water Swim'
    ]
    
    if (!allowedTypes.includes(activity.type) && !allowedTypes.includes(activity.sport_type)) {
      return // Skip this activity
    }
    
    const activityTime = new Date(activity.start_date).getTime() / 1000
    const isLast7Days = activityTime >= sevenDaysAgo
    
    // Add TSS (suffer_score) - ONLY for last 7 days
    if (activity.suffer_score && isLast7Days) {
      totalTSS += activity.suffer_score
    }
    
    // Collect TSS for ACWR (uses full 28 days)
    if (activity.suffer_score) {
      if (activityTime >= sevenDaysAgo) {
        tss7days.push(activity.suffer_score)
      }
      if (activityTime >= twentyEightDaysAgo) {
        tss28days.push(activity.suffer_score)
      }
    }
    
    // Add workout time - ONLY for last 7 days
    if (activity.moving_time && isLast7Days) {
      totalWorkoutTime += activity.moving_time
    }
    
    // 80/20 Distribution - uses full 28 days for better average
    if (activity.moving_time) {
      // For cycling: use power-based zones if available, otherwise heart rate
      // For running/swimming: use heart rate zones
      const isCycling = ['Ride', 'VirtualRide', 'EBikeRide'].includes(activity.type) || 
                        ['Ride', 'VirtualRide', 'EBikeRide'].includes(activity.sport_type)
      
      if (isCycling && activity.weighted_average_watts) {
        // Use power zones for cycling
        // Zone 1-2 (Easy): < LOW_INTENSITY_THRESHOLD% FTP
        // Zone 4-5 (Hard): > HIGH_INTENSITY_THRESHOLD% FTP
        const powerPercent = (activity.weighted_average_watts / USER_FTP) * 100
        
        if (powerPercent < LOW_INTENSITY_THRESHOLD) {
          lowIntensityTime += activity.moving_time
        } else if (powerPercent > HIGH_INTENSITY_THRESHOLD) {
          highIntensityTime += activity.moving_time
        }
      } else if (activity.has_heartrate && activity.average_heartrate) {
        // Use heart rate zones for running/swimming or cycling without power
        // Zone 1-2 (Easy): < LOW_INTENSITY_THRESHOLD% max HR
        // Zone 4-5 (Hard): > HIGH_INTENSITY_THRESHOLD% max HR
        const hrPercent = (activity.average_heartrate / MAX_HR) * 100
        
        if (hrPercent < LOW_INTENSITY_THRESHOLD) {
          lowIntensityTime += activity.moving_time
        } else if (hrPercent > HIGH_INTENSITY_THRESHOLD) {
          highIntensityTime += activity.moving_time
        }
      }
      // Note: Zone 3 is intentionally NOT counted - it's the gray zone
    }
    
    // Intensity Factor (IF) - calculated from weighted_average_watts / FTP
    // For cycling: IF = NP / FTP
    if (activity.weighted_average_watts) {
      const intensityFactor = activity.weighted_average_watts / USER_FTP
      totalIF += intensityFactor
      ifCount++
    }
    
    // Efficiency Factor (EF) - NP / Avg HR or Pace / Avg HR
    if (activity.has_heartrate && activity.average_heartrate) {
      if (activity.weighted_average_watts) {
        // For cycling: Watts / HR
        const ef = activity.weighted_average_watts / activity.average_heartrate
        totalEF += ef
        efCount++
      } else if (activity.average_speed) {
        // For running: Speed / HR
        const ef = activity.average_speed / activity.average_heartrate
        totalEF += ef
        efCount++
      }
    }
  })
  
  // Calculate ACWR (Acute:Chronic Workload Ratio)
  // Acute = average daily TSS over last 7 days
  // Chronic = average daily TSS over last 28 days
  const sumTSS7 = tss7days.length > 0 ? tss7days.reduce((a, b) => a + b, 0) : 0
  const sumTSS28 = tss28days.length > 0 ? tss28days.reduce((a, b) => a + b, 0) : 0
  
  const avgTSS7 = sumTSS7 / 7  // Average per day over 7 days
  const avgTSS28 = sumTSS28 / 28  // Average per day over 28 days
  
  // ACWR should only be calculated if we have sufficient chronic load
  // If avgTSS28 is too low, it means not enough training history
  const acwr = (avgTSS28 > MIN_CHRONIC_LOAD) ? avgTSS7 / avgTSS28 : 0
  
  console.log(`ACWR Debug: 7-day sum=${sumTSS7}, 28-day sum=${sumTSS28}, avg7=${avgTSS7.toFixed(1)}, avg28=${avgTSS28.toFixed(1)}, ACWR=${acwr.toFixed(2)}`)
  
  // Calculate average IF
  const avgIF = ifCount > 0 ? totalIF / ifCount : 0
  
  // Calculate 80/20 percentage
  const totalIntensityTime = lowIntensityTime + highIntensityTime
  const lowIntensityPercent = totalIntensityTime > 0 ? (lowIntensityTime / totalIntensityTime) * 100 : 0
  const highIntensityPercent = totalIntensityTime > 0 ? (highIntensityTime / totalIntensityTime) * 100 : 0
  
  // Calculate average EF
  const avgEF = efCount > 0 ? totalEF / efCount : 0

  return {
    totalTSS,
    totalWorkoutTime,
    acwr,
    avgIF,
    lowIntensityPercent,
    highIntensityPercent,
    avgEF
  }
}

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

async function createWidget(activities) {
  const list = new ListWidget()

  // Calculate stats
  const stats = calculateStats(activities)

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
  function addRow(label, value, valueColor = textColor, valueFontSize = 16) {
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
    
    let percentText = distRow.addText(`${stats.lowIntensityPercent.toFixed(0)}% / ${stats.highIntensityPercent.toFixed(0)}%`)
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
    
    barStack.addSpacer(2)
    
    let highBar = barStack.addStack()
    highBar.backgroundColor = new Color('#FF5722')
    highBar.size = new Size(stats.highIntensityPercent * 1.4, 10)
    highBar.cornerRadius = 5
  }

  // Set URL to open Strava app
  list.url = "strava://feed"

  return list
}

let activities = await loadActivities(clientID, clientSecret, refreshToken)
let widget = await createWidget(activities)

if (!config.runsInWidget) {
  await widget.presentSmall()
}

Script.setWidget(widget)
Script.complete()
