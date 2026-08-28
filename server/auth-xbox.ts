import 'dotenv/config'
import { Msal, TokenStore } from 'xal-node'

const tokenFile = process.env.XBOX_TOKEN_FILE || '.xbox.tokens.json'

async function authenticate() {
  const store = new TokenStore()
  store.load(tokenFile, true)
  const msal = new Msal(store)

  if (store.hasValidAuthTokens()) {
    console.log(`Xbox token already available: ${tokenFile}`)
    return
  }

  const device = await msal.doDeviceCodeAuth()
  console.log(device.message)
  await msal.doPollForDeviceCodeAuth(device.device_code, device.expires_in * 1000)
  await msal.getWebToken()
  console.log(`Xbox authentication succeeded. Token saved to ${tokenFile}`)
}

authenticate().catch((error) => {
  console.error('Xbox authentication failed:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
