import { chromium } from 'playwright'

const BASE = 'https://medqueue-frontend-w3hh.onrender.com'

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  page.setDefaultTimeout(25000)

  const apiLogs = []
  page.on('response', (res) => {
    if (res.url().includes('/api/')) apiLogs.push(`RESP ${res.status()} ${res.url()}`)
  })
  page.on('requestfailed', (req) => apiLogs.push(`FAIL ${req.url()} ${req.failure()?.errorText}`))

  await page.goto(BASE + '/register')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: 'C:/Temp/opencode/register-page.png', fullPage: true })

  const body = await page.locator('body').innerText()
  console.log('URL:', page.url())
  console.log('BODY (first 800):', body.slice(0, 800).replace(/\n+/g, ' | '))
  console.log('inputs:', await page.locator('input').count())
  console.log('inputs names:', await page.locator('input').evaluateAll((els) => els.map((e) => e.name || e.type)))
  for (const l of apiLogs) console.log(l)

  await browser.close()
}

main().catch((err) => { console.error('ERROR:', err.message); process.exit(1) })
