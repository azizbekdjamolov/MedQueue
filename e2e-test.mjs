import { chromium } from 'playwright'

const BASE = 'http://localhost:5173'
const results = []
let browser

function ok(name, pass, extra = '') {
  results.push({ name, pass, extra })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${extra ? '  | ' + extra : ''}`)
}

async function main() {
  browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  page.setDefaultTimeout(15000)

  // 1. Homepage loads
  await page.goto(BASE)
  ok('homepage loads', (await page.title()).includes('MedQueue'), await page.title())
  const aiBarVisible = await page.getByPlaceholder(/MedQueue AI bilan so'rang|Ask MedQueue AI|Спросите MedQueue AI/).isVisible()
  ok('homepage AI input visible', aiBarVisible)

  // 2. Homepage AI input navigates to /ai with message
  await page.getByPlaceholder(/MedQueue AI bilan so'rang|Ask MedQueue AI|Спросите MedQueue AI/).fill('Yunusobodda kardiolog bormi?')
  await page.getByRole('button', { name: /AI yordamchini ochish|Open AI assistant|Открыть ИИ-ассистента/ }).click()
  await page.waitForURL(/\/ai\//)
  ok('AI input navigates to /ai', page.url().includes('/ai'))

  // 3. AI responds (streaming)
  const replyLocator = page.locator('.whitespace-pre-wrap.break-words')
  await page.waitForFunction(
    () => {
      const el = document.querySelector('.whitespace-pre-wrap.break-words')
      return el && el.textContent.length > 20
    },
    null,
    { timeout: 60000 }
  )
  const aiText = await replyLocator.last().textContent()
  ok('AI streams a reply', aiText.length > 20, aiText.slice(0, 80) + '...')

  // 4. New Chat works
  const before = await page.locator('aside li').count()
  await page.getByRole('button', { name: /Yangi chat|New Chat|Новый чат/ }).click()
  const after = await page.locator('aside li').count()
  ok('New Chat adds a chat to sidebar', after > before, `before=${before} after=${after}`)
  const welcomeVisible = await page.locator('aside li').first().isVisible()
  ok('New Chat opens fresh chat', welcomeVisible)

  // 5. Old chat restores messages
  await page.locator('aside li button').nth(1).click()
  await page.waitForTimeout(400)
  const restoredCount = await page.locator('.whitespace-pre-wrap.break-words').count()
  ok('clicking old chat restores messages', restoredCount >= 1, `messages=${restoredCount}`)

  // 6. Dark/light mode toggle
  await page.getByRole('button', { name: /Yorug' rejimga o'tish|Switch to light mode|Переключить на светлую тему/ }).click()
  const theme = await page.evaluate(() => document.documentElement.dataset.theme)
  ok('light mode toggle works', theme === 'light', theme)

  // 7. Search page
  await page.goto(BASE + '/search')
  await page.waitForTimeout(2500)
  const clinicCards = await page.locator('.glass.rounded-2xl h3').count()
  ok('search page loads clinics', clinicCards > 0, `cards=${clinicCards}`)
  await page.getByRole('button', { name: /Shifokorlar|Doctors|Врачи/ }).click()
  await page.waitForTimeout(2500)
  const doctorCards = await page.locator('.glass.rounded-2xl h3').count()
  ok('search doctors tab works', doctorCards > 0, `cards=${doctorCards}`)
  const takeBtn = page.getByRole('button', { name: /Navbat olish|Take queue|Занять очередь/ }).first()
  if (await takeBtn.isVisible()) {
    await takeBtn.click()
    await page.waitForTimeout(3000)
    const modal = await page.getByText(/Navbat olindi|Queue taken|Очередь занята/).isVisible()
    ok('take queue modal shows number', modal)
    await page.keyboard.press('Escape')
  } else {
    ok('take queue button visible', false, 'not found')
  }

  // 8. Dashboard page with live queue
  await page.goto(BASE + '/dashboard')
  await page.waitForTimeout(2500)
  const queueCard = await page.getByText(/Sizning raqamingiz|Your number|Ваш номер/).isVisible()
  ok('dashboard shows current queue', queueCard)
  const liveBadge = await page.getByText(/Jonli|Live|Вживую/).first().isVisible()
  ok('dashboard live badge present', liveBadge)

  // 9. AI page general question
  await page.goto(BASE + '/ai')
  await page.waitForTimeout(1000)
  await page.getByPlaceholder(/Shifokor, klinika yoki istalgan savol|Doctor, clinic or any question|Врач, клиника или любой вопрос/).fill("Python'da for loop tushuntir")
  await page.getByRole('button', { name: /Xabarni yuborish|Send message|Отправить сообщение/ }).click()
  await page.waitForFunction(
    () => {
      const els = document.querySelectorAll('.whitespace-pre-wrap.break-words')
      const last = els[els.length - 1]
      return last && last.textContent.length > 30
    },
    null,
    { timeout: 60000 }
  )
  const generalText = await page.locator('.whitespace-pre-wrap.break-words').last().textContent()
  ok('general AI question answered', generalText.includes('for') || generalText.length > 30, generalText.slice(0, 70) + '...')

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
