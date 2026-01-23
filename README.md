# Strava widget for performance metrics 

![Example image](./example.jpeg)

Mobile widgets for fast access to performance stats from strava:

1. **Training Stress Score (TSS)** - Last 7 days total
   - Cycling: `TSS = [(time × NP × IF) / (FTP × 3600)] × 100` where `IF = NP / FTP`
   - Other activities: Uses Strava's Suffer Score as proxy

2. **Intensity Factor (IF)** - Average across all cycling activities
   - `IF = Normalized Power / FTP`
   - Shows how hard you work relative to threshold (0.75 = easy, 0.85 = tempo, 1.0+ = hard)

3. **Acute:Chronic Workload Ratio (ACWR)** - Injury risk indicator
   - `ACWR = (7-day avg TSS) / (28-day avg TSS)`
   - 🟢 0.8-1.3 = optimal, 🟡 <0.8 = detraining, 🔴 >1.5 = high injury risk

4. **Efficiency Factor (EF)** - Aerobic fitness indicator
   - `EF = Normalized Power / Average HR`
   - Higher values = better aerobic fitness

5. **Zone Distribution** - Training intensity breakdown (last 7 days)
   - Low (<75% of threshold): Easy aerobic base
   - Medium (75-85%): Tempo/sweetspot
   - High (>85%): Threshold and above
   - Supports 80/20 training principle

## Pre-requirements

1. An iPhone;
2. Strava account with activities;
3. Install [scriptable app](https://apps.apple.com/us/app/scriptable/id1405459188);

## Create Strava perfsonal application

1. Go to your [API settings](https://www.strava.com/settings/api);
1. Create an application (if you don't have one);
1. Open this url replacing `CLIENT_ID` with your own: `https://www.strava.com/oauth/authorize?client_id=[CLIENT_ID]&redirect_uri=http://localhost&response_type=code&scope=activity:read_all`;
1. Click Authorize.
    - The page will error out (e.g., "Site cannot be reached"). This is normal.
    - Look at the URL in your address bar. Copy the string of characters after `&code=`.
    - Example: `http://localhost/?state=&code=**abc123def456**&scope=...`;
1. Exchange Code for Refresh Token (curl):

    Now that you have the code, use this curl command to get your first refresh_token and access_token.

    ```Bash
    curl -X POST https://www.strava.com/oauth/token \
    -F client_id=[CLIENT_ID] \
    -F client_secret=[CLIENT_SECRET] \
    -F code=[CODE_HERE] \
    -F grant_type=authorization_code
    ```

    The Response: The JSON response will contain the `refresh_token`. Save this. The `access_token` expires every 6 hours, but the `refresh_token` is permanent (unless you revoke it).

1. Store Client ID, Client Secret and Refresh Token;

...

## Create widget in scriptable
...

## Running widget
...
