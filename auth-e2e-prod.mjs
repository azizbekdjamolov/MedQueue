import { chromium } from 'playwright'

const BASE = 'https://medqueue-frontend-w3hh.onrender.com'
const results = []
let browser

function ok(name, pass, extra = '') {
  results.push({ name, pass, extra })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${extra ? '  | ' + extra : ''}`)
}

async function main() {
  browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  page.setDefaultTimeout(20000)

  const requests = []
  page.on('requestfailed', (req) => requests.push(`FAILED ${req.method()} ${req.url()} ${req.failure()?.errorText}`))
  page.on('response', (res) => {
    if (res.url().includes('/api/')) requests.push(`RESP ${res.status()} ${res.url()}`)
  })

  const stamp = Date.now()
  const email = `pwtest${stamp}@gmail.com`

  // 1. Register page loads
  await page.goto(BASE + '/register')
  ok('register page loads', page.url().includes('/register'))

  // 2. Register success
  await page.fill('input[name="full_name"]', 'Playwright Test')
  await page.fill('input[name="phone"]', '+998911234567')
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', 'StrongPass123!')
  await page.fill('input[name="confirm_password"]', 'StrongPass123!')
  await page.click('button[type="submit"]')
  await page.waitForTimeout(3500)
  const regOk = page.url().includes('/cabinet')
  ok('register succeeds (redirects to cabinet)', regOk, page.url())
  if (!regOk) {
    const body = await page.locator('body').innerText()
    ok('register error text shown', false, body.slice(0, 300))
  }

  // 3. Cabinet requires session cookie — should show logged-in state
  await page.waitForTimeout(1500)
  const cabinetText = await page.locator('body').innerText()
  ok('cabinet shows user data', /Playwright Test/.test(cabinetText), cabinetText.slice(0, 120).replace(/\n/g, ' '))

  // 4. Logout + login flow
  await context.clearCookies()
  await page.goto(BASE + '/login')
  await page.fill('input[name="identifier"]', email)
  await page.fill('input[name="password"]', 'StrongPass123!')
  await page.click('button[type="submit"]')
  await page.waitForTimeout(3500)
  ok('login succeeds (redirects to cabinet)', page.url().includes('/cabinet'), page.url())
  if (!page.url().includes('/cabinet')) {
    const body = await page.locator('body').innerText()
    ok('login error text shown', false, body.slice(0, 300))
  }

  await page.waitForTimeout(1500)
  const cabinetText2 = await page.locator('body').innerText()
  ok('cabinet shows user after login', /Playwright Test/.test(cabinetText2))

  console.log('\n--- API traffic ---')
  for (const r of requests) console.log(' ', r)

  await browser.close()
  const failed = results.filter((r) => !r.pass)
  console.log(`\n==== ${results.length - failed.length}/${results.length} passed ====`)
  process.exit(failed.length ? 1 : 0)
}

main().catch(async (err) => {
  console.error('ERROR:', err.message)
  if (browser) await browser.close()
  process.exit(1)
})
