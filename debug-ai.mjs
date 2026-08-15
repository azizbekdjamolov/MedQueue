import { chromium } from 'playwright'

const BASE = 'http://localhost:5173'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
page.setDefaultTimeout(10000)
await page.goto(BASE)
await page.waitForTimeout(2500)

const input = page.locator('input[placeholder*="MedQueue AI"]').first()
console.log('input count:', await page.locator('input').count())
console.log('placeholder:', await input.getAttribute('placeholder'))
await input.fill('Yunusobodda kardiolog bormi?')
await page.waitForTimeout(500)
console.log('input value:', await input.inputValue())

const buttons = await page.locator('button[aria-label]').all()
for (const b of buttons) {
  console.log('button:', await b.getAttribute('aria-label'), 'disabled:', await b.isDisabled())
}
await browser.close()