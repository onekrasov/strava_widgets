import type {
  ActivityStreamResponse,
  AthleteInfo,
  AthleteZones,
  StravaTokenResponse,
  SummaryActivity
} from '../types/strava-api'

declare const FileManager: any
declare const Request: any
declare const Timer: any

export class Strava {
  private token = ""
  private clientId: string
  private clientSecret: string
  private refreshToken: string
  private isScriptable: boolean = false
  private fs: any

  private TOKEN_API: string = `https://www.strava.com/oauth/token`
  private STRAVA_API_BASE_URL: string = "https://www.strava.com/api/v3"
  private EXCLUDED_TYPES = [
    'Walk',
    'EBikeRide'
  ]
  private CACHE_FOLDER = './cache'

  constructor(clientId: string, clientSecret: string, refreshToken: string, isScriptable: boolean = false) {
    this.clientId = clientId
    this.clientSecret = clientSecret
    this.refreshToken = refreshToken
    this.isScriptable = isScriptable
    if (!isScriptable && typeof require !== 'undefined') {
      try {
        this.fs = require('fs')
      } catch (e) {
        // fs not available in this environment (e.g., Scriptable)
      }
    }
  }

  private async getToken(): Promise<string> {
    if (!this.token) {
      this.token = await this.obtainStravaToken()
    }
    return this.token
  }

  async obtainStravaToken(): Promise<string> {
    try {
      const url = `${this.TOKEN_API}?client_id=${this.clientId}&client_secret=${this.clientSecret}&refresh_token=${this.refreshToken}&grant_type=refresh_token`
      console.log("Fetching Strava token...")
      const data: StravaTokenResponse = await this.fetchAsync(url, 'POST') as StravaTokenResponse

      console.log("Token obtained successfully")
      return data.access_token
    }
    catch (e) {
      console.error("Error obtaining Strava access token:", e)
      throw e
    }
  }

  async getAtheleteInfo(): Promise<AthleteInfo> {
    try {
      const token = await this.getToken()
      const url = `${this.STRAVA_API_BASE_URL}/athlete?access_token=${token}`

      const athleteInfo = await this.fetchAsync(url, 'GET') as AthleteInfo

      return athleteInfo
    } catch (e) {
      console.error("Error loading Strava athlete info:", e)
      throw e
    }
  }

  async getAthleteZones(): Promise<AthleteZones> {
    try {
      const token = await this.getToken()
      const url = `${this.STRAVA_API_BASE_URL}/athlete/zones?access_token=${token}`

      const zones = await this.fetchAsync(url, 'GET') as AthleteZones

      return zones
    } catch (e) {
      console.error("Error loading Strava athlete zones:", e)
      throw e
    }
  }

  async loadActivities(): Promise<SummaryActivity[]> {
    try {
      const twentyEightDaysAgo = Math.floor(Date.now() / 1000) - (28 * 24 * 60 * 60)
      const token = await this.getToken()
      const url = `${this.STRAVA_API_BASE_URL}/athlete/activities?access_token=${token}&after=${twentyEightDaysAgo}&per_page=200`
      console.log("Fetching activities...")
      const activities = await this.fetchAsync(url, 'GET') as SummaryActivity[]

      console.log(`Loaded ${activities.length} activities`)
      // Filter out unwanted activity types
      const filteredActivities = activities.filter(activity => !this.EXCLUDED_TYPES.includes(activity.sport_type))

      for (const activity of filteredActivities) {
        let streams = this.loadCache(`activity_streams_${activity.id}`) as ActivityStreamResponse
        if (!streams) {
          try {
            streams = await this.getActivityStreams(activity.id, ['watts', 'heartrate', 'velocity_smooth', 'distance', 'time'])
            this.saveCache(`activity_streams_${activity.id}`, streams)
          } catch (e) {
            console.error(`Error loading streams for activity ${activity.id}:`, e)
          }
          // sleep 1 second to avoid rate limiting
          if (this.isScriptable) {
            // Scriptable doesn't have setTimeout, use Script.wait
            await new Promise(resolve => {
              const timer = Timer.schedule(1000, false, resolve)
            })
          } else {
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }
        activity.watts = streams.watts
        activity.heartrate = streams.heartrate
        activity.velocity_smooth = streams.velocity_smooth
        activity.time = streams.time
      }

      return filteredActivities
    } catch (e) {
      console.error("Error loading Strava activities:", e)
      throw e
    }
  }

  async getActivityStreams(activityId: number, keys: string[]): Promise<ActivityStreamResponse> {
    try {
      const token = await this.getToken()
      const url = `${this.STRAVA_API_BASE_URL}/activities/${activityId}/streams?access_token=${token}&keys=${keys.join(',')}&key_by_type=true`

      const streams = await this.fetchAsync(url, 'GET')

      return streams as ActivityStreamResponse
    } catch (e) {
      console.error(`Error loading Strava activity streams for activity ${activityId}:`, e)
      throw e
    }
  }

  async fetchAsync(url: string, method: string): Promise<any> {
    if (this.isScriptable) {
      // Use Scriptable's Request API
      try {
        const req = new Request(url)
        req.method = method
        req.headers = {
          'Content-Type': 'application/json'
        }
        req.timeoutInterval = 30

        const data = await req.loadJSON()

        // Check if response contains an error
        if (data && data.errors) {
          throw new Error(`Strava API error: ${JSON.stringify(data.errors)}`)
        }

        return data
      } catch (e) {
        console.error(`Scriptable Request failed for ${url}:`, e)
        throw e
      }
    } else {
      // Use standard fetch for Node.js/Bun
      const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' } })
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} for URL: ${url}`)
      }
      const data = await response.json()
      return data
    }
  }

  private saveCache(key: string, data: any): boolean {
    const jsonData = JSON.stringify(data)

    if (this.isScriptable) {
      const fm = FileManager.local()
      const cachePath = fm.joinPath(fm.documentsDirectory(), `${key}.json`)
      fm.writeString(cachePath, jsonData)
      return true
    }

    const cachePath = `${this.CACHE_FOLDER}/${key}.json`

    if (!this.fs.existsSync(this.CACHE_FOLDER)) {
      this.fs.mkdirSync(this.CACHE_FOLDER)
    }

    // replace file if exists
    if (this.fs.existsSync(cachePath)) {
      this.fs.unlinkSync(cachePath)
    }

    this.fs.writeFileSync(cachePath, jsonData, 'utf-8')
    return true
  }

  private loadCache(key: string): any | null {
    try {
      if (this.isScriptable) {
        const fm = FileManager.local()
        const cachePath = fm.joinPath(fm.documentsDirectory(), `${key}.json`)
        if (!fm.fileExists(cachePath)) {
          return null
        }
        const jsonData = fm.readString(cachePath)
        return JSON.parse(jsonData)
      }

      const jsonData = this.fs.readFileSync(`${this.CACHE_FOLDER}/${key}.json`, 'utf-8')
      return JSON.parse(jsonData)
    } catch (e) {
      return null
    }
  }
}