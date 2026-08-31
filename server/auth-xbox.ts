import 'dotenv/config'
import { Msal } from 'xal-node'
import { loadXboxTokenStore, saveXboxTokenStore } from './xbox-token-store'

async function authenticate() {
  const store = await loadXboxTokenStore()
  const msal = new Msal(store)

  if (store.getUserToken()) {
    try {
      await msal.getWebToken()
      await saveXboxTokenStore(store)
      console.log('Xbox credentials are valid and stored in SQLite.')
      return
    } catch {
      console.log('Existing Xbox token could not be refreshed; starting a new login.')
    }
  }

  const device = await msal.doDeviceCodeAuth()
  console.log(device.message)
  await msal.doPollForDeviceCodeAuth(device.device_code, device.expires_in * 1000)
  await msal.getWebToken()
  await saveXboxTokenStore(store)
  console.log('Xbox authentication succeeded. Credentials saved to SQLite.')
}

authenticate().catch((error) => {
  console.error('Xbox authentication failed:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
