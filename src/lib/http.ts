declare const Request: any

export async function fetchAsync(url: string, method: 'GET' | 'POST', isScriptable: boolean = false, body?: any): Promise<any> {
  if (isScriptable) {
    // Use Scriptable's Request API
    try {
      const req = new Request(url)
      req.method = method
      req.headers = {
        'Content-Type': 'application/json'
      }
      req.timeoutInterval = 60 // 60 seconds

      if (body) {
        req.body = JSON.stringify(body)
      }

      const data = await req.loadJSON()

      // Check if response contains an error
      if (data && data.errors) {
        throw new Error(`API error: ${JSON.stringify(data.errors)}`)
      }

      return data
    } catch (e) {
      console.error(`Scriptable Request failed for ${url}:`, e)
      throw e
    }
  } else {
    // Use standard fetch for Node.js/Bun
    const params = { method, headers: { 'Content-Type': 'application/json' } } as RequestInit
    if (body) {
      params.body = JSON.stringify(body)
    }
    const response = await fetch(url, params)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} for URL: ${url}`)
    }
    const data = await response.json()
    return data
  }
}