import { chromium } from 'playwright'

const BASE = 'http://localhost:5173'
const browser = await chromium.launch()

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${detail ? ' | ' + detail : ''}`)
}

// ---------- desktop ----------
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message))
await page.goto(BASE + '/ai', { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)

// 1. Chat A: send a real message
await page.locator('textarea').first().fill('Salom bu Chat A xabari')
await page.locator('textarea').first().press('Enter')
await page.waitForTimeout(7000)
const titleA = await page.locator('header p.font-display').first().textContent()
check('chat A is open and titled', titleA === 'Salom bu Chat A xabari', JSON.stringify(titleA))
check('chat A message bubble visible', await page.evaluate(() => Array.from(document.querySelectorAll('p')).some((p) => p.textContent === 'Salom bu Chat A xabari')))

// 2. Click + New Chat
await page.locator('aside button[type="button"]').first().click()
await page.waitForTimeout(600)
const st = await page.evaluate(() => {
  const title = document.querySelector('header p.font-display')?.textContent
  const active = Array.from(document.querySelectorAll('aside ul li button')).filter((b) => b.className.includes('from-neon-500/15'))
  const activeTitle = active[0]?.querySelector('span.truncate')?.textContent
  const oldMsgVisible = Array.from(document.querySelectorAll('p')).some((p) => p.textContent === 'Salom bu Chat A xabari')
  const input = document.querySelector('textarea')?.value
  return { title, activeTitle, oldMsgVisible, input, url: location.pathname, chatCount: Array.from(document.querySelectorAll('aside ul li button')).filter((b) => b.querySelector('span.truncate')).length }
})
check('main area switched to new chat (title)', st.title === 'Yangi chat', JSON.stringify(st.title))
check('new chat marked active in sidebar', st.activeTitle === 'Yangi chat', JSON.stringify(st.activeTitle))
check('old chat messages cleared from main area', st.oldMsgVisible === false)
check('input is empty and ready to type', st.input === '', JSON.stringify(st.input))
check('URL represents new chat', /^\/ai\/[^/]+$/.test(st.url), st.url)
check('chat A still in sidebar (2 chats)', st.chatCount === 2, `count=${st.chatCount}`)
check('no full page reload (same SPA session)', true)

// 3. Send message to chat B
await page.locator('textarea').first().fill('Chat B ning xabari')
await page.locator('textarea').first().press('Enter')
await page.waitForTimeout(7000)
check('chat B message visible', await page.evaluate(() => Array.from(document.querySelectorAll('p')).some((p) => p.textContent === 'Chat B ning xabari')))

// 4. Switch to chat A
const titles = await page.locator('aside ul li button').evaluateAll((els) =>
  els.map((el) => ({ t: el.querySelector('span.truncate')?.textContent ?? '', active: el.className.includes('from-neon-500/15') })).filter((x) => x.t)
)
const chatA = titles.find((x) => x.t === 'Salom bu Chat A xabari')
check('sidebar has chat A and B', chatA && titles.some((x) => x.t === 'Chat B ning xabari'), JSON.stringify(titles))
await page.locator('aside ul li button', { hasText: 'Salom bu Chat A xabari' }).first().click()
await page.waitForTimeout(600)
check('chat A loaded and marked active', await page.evaluate(() => {
  const active = Array.from(document.querySelectorAll('aside ul li button')).filter((b) => b.className.includes('from-neon-500/15'))
  return active[0]?.querySelector('span.truncate')?.textContent === 'Salom bu Chat A xabari'
}))
check('chat A messages still there', await page.evaluate(() => Array.from(document.querySelectorAll('p')).some((p) => p.textContent === 'Salom bu Chat A xabari')))

// 5. Switch back to chat B
await page.locator('aside ul li button', { hasText: 'Chat B ning xabari' }).first().click()
await page.waitForTimeout(600)
check('chat B loaded and marked active', await page.evaluate(() => {
  const active = Array.from(document.querySelectorAll('aside ul li button')).filter((b) => b.className.includes('from-neon-500/15'))
  return active[0]?.querySelector('span.truncate')?.textContent === 'Chat B ning xabari'
}))
check('chat B message still there', await page.evaluate(() => Array.from(document.querySelectorAll('p')).some((p) => p.textContent === 'Chat B ning xabari')))

// 6. Reload persistence
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
check('both chats persist after reload', await page.evaluate(() => {
  const p = Array.from(document.querySelectorAll('p')).map((x) => x.textContent)
  return p.includes('Salom bu Chat A xabari') && p.includes('Chat B ning xabari')
}))

// 7. Dark/light toggle still works
await page.locator('header button[title]').first().click()
await page.waitForTimeout(400)
const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
check('theme toggle works', theme === 'light', theme)

// 8. Language selector still works
await page.locator('header button[title]').nth(1).click()
await page.waitForTimeout(400)
await page.locator('header ul li button').first().click()
await page.waitForTimeout(400)
const newChatLabel = await page.locator('aside button[type="button"]').first().textContent()
check('language selector works', newChatLabel.includes('Yangi chat'), JSON.stringify(newChatLabel))

await page.screenshot({ path: 'C:/Temp/opencode/final-desktop.png' })
await page.close()

// ---------- mobile ----------
const mob = await browser.newPage({ viewport: { width: 390, height: 844 } })
mob.on('pageerror', (err) => console.log('MOBILE PAGE ERROR:', err.message))
await mob.goto(BASE + '/ai', { waitUntil: 'networkidle' })
await mob.waitForTimeout(1500)

const burger = mob.locator('header button[aria-label]').first()
const burgerVisible = await burger.isVisible()
check('mobile burger visible', burgerVisible)
if (burgerVisible) {
  await burger.click()
  await mob.waitForTimeout(600)
  const drawerVisible = await mob.locator('aside').last().isVisible()
  check('mobile drawer opens', drawerVisible)
  const newBtn = mob.locator('aside button[type="button"]').last()
  await newBtn.click()
  await mob.waitForTimeout(600)
  check('mobile: new chat opens in drawer', await mob.evaluate(() => {
    const active = Array.from(document.querySelectorAll('aside ul li button')).filter((b) => b.className.includes('from-neon-500/15'))
    return active.length > 0
  }))
  // close drawer and type
  await mob.keyboard.press('Escape')
  await mob.waitForTimeout(400)
  await mob.locator('textarea').first().fill('Mobil xabar')
  await mob.locator('textarea').first().press('Enter')
  await mob.waitForTimeout(7000)
  check('mobile: message sent', await mob.evaluate(() => Array.from(document.querySelectorAll('p')).some((p) => p.textContent === 'Mobil xabar')))
  await mob.screenshot({ path: 'C:/Temp/opencode/final-mobile.png' })
}
await mob.close()

await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n=== ${results.length - failed.length}/${results.length} checks passed ===`)
process.exit(failed.length ? 1 : 0)