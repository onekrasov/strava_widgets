export interface StravaTokenResponse {
  token_type: "Bearer";
  access_token: string;
  refresh_token: string;
  expires_at: number; // Seconds since Epoch
  expires_in: number; // Seconds until expiration
  athlete?: SummaryAthlete; // Only present on initial exchange
}

export interface SummaryAthlete {
  id: number;
  resource_state: number;
  firstname: string;
  lastname: string;
  city: string;
  state: string;
  country: string;
  sex: 'M' | 'F';
  premium: boolean;
  summit: boolean;
  created_at: string;
  updated_at: string;
}

export interface SummaryActivity {
  id: number;
  external_id: string;
  upload_id: number;
  athlete: { id: number; resource_state: number };
  name: string;
  distance: number; // Meters
  moving_time: number; // Seconds
  elapsed_time: number; // Seconds
  total_elevation_gain: number;
  sport_type: SportTypes;
  start_date: string;
  start_date_local: string;
  timezone: string;
  utc_offset: number;
  achievement_count: number;
  kudos_count: number;
  comment_count: number;
  athlete_count: number;
  photo_count: number;
  trainer: boolean;
  commute: boolean;
  manual: boolean;
  private: boolean;
  visibility: string;
  average_speed: number;
  max_speed: number;
  average_watts?: number;      // Key for TSS/IF
  device_watts?: boolean;      // Important: confirms power was measured, not estimated
  weighted_average_watts?: number; // Strava's version of NP
  kilojoules?: number;
  has_heartrate: boolean;
  average_heartrate?: number;
  max_heartrate?: number;
  elev_high?: number;
  elev_low?: number;
  suffer_score: number;
  velocity_smooth?: ActivityStream;
  watts: ActivityStream;
  heartrate: ActivityStream;
  time: ActivityStream;
  distance_stream?: ActivityStream;
}

export interface ActivityStream {
  data: number[];
  series_type: string;
  original_size: number;
  resolution: string;
}

export interface ActivityStreamResponse {
  watts: ActivityStream;
  heartrate: ActivityStream;
  velocity_smooth?: ActivityStream;
  distance: ActivityStream;
  time: ActivityStream;
}

// AlpineSki, BackcountrySki, Badminton, Canoeing, Crossfit, EBikeRide, Elliptical, EMountainBikeRide, Golf, GravelRide, Handcycle, HighIntensityIntervalTraining, Hike, IceSkate, InlineSkate, Kayaking, Kitesurf, MountainBikeRide, NordicSki, Pickleball, Pilates, Racquetball, Ride, RockClimbing, RollerSki, Rowing, Run, Sail, Skateboard, Snowboard, Snowshoe, Soccer, Squash, StairStepper, StandUpPaddling, Surfing, Swim, TableTennis, Tennis, TrailRun, Velomobile, VirtualRide, VirtualRow, VirtualRun, Walk, WeightTraining, Wheelchair, Windsurf, Workout, Yoga
type SportTypes = 'AlpineSki' | 'BackcountrySki' | 'Badminton' | 'Canoeing' | 'Crossfit' | 'EBikeRide' | 'Elliptical' | 'EMountainBikeRide' | 'Golf' | 'GravelRide' | 'Handcycle' | 'HighIntensityIntervalTraining' | 'Hike' | 'IceSkate' | 'InlineSkate' | 'Kayaking' | 'Kitesurf' | 'MountainBikeRide' | 'NordicSki' | 'Pickleball' | 'Pilates' | 'Racquetball' | 'Ride' | 'RockClimbing' | 'RollerSki' | 'Rowing' | 'Run' | 'Sail' | 'Skateboard' | 'Snowboard' | 'Snowshoe' | 'Soccer' | 'Squash' | 'StairStepper' | 'StandUpPaddling' | 'Surfing' | 'Swim' | 'TableTennis' | 'Tennis' | 'TrailRun' | 'Velomobile' | 'VirtualRide' | 'VirtualRow' | 'VirtualRun' | 'Walk' | 'WeightTraining' | 'Wheelchair' | 'Windsurf' | 'Workout' | 'Yoga';

export interface AthleteInfo {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  city: string;
  state: string;
  country: string;
  sex: 'M' | 'F';
  premium: boolean;
  summit: boolean;
  created_at: string;
  updated_at: string;
  ftp: number | null;
  weight: number;
}

export interface AthleteZones {
  heart_rate?: {
    custom_zones: boolean;
    zones: ZoneBucket[];
  };
  power?: {
    custom_zones: boolean;
    zones: ZoneBucket[];
  };
  running?: {
    threshold_speed: number; // m/s
  };
  swimming?: {
    css: number; // m/s
  };
}

export interface ZoneBucket {
  min: number;
  max: number;
  time: number; // seconds spent in this zone
}