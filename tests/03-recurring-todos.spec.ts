import { test, expect, Page } from '@playwright/test'

function futureDateTimeLocal(minutesAhead = 10): string {
  const d = new Date(Date.now() + minutesAhead * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  )
}

async function addRecurringTodo(
  page: Page,
  title: string,
  pattern: 'daily' | 'weekly' | 'monthly' | 'yearly',
) {
  await page.fill('input[placeholder="What needs to be done?"]', title)
  await page.fill('input[type="datetime-local"]', futureDateTimeLocal(10))
  await page.getByLabel('Repeat').check()
  await page.selectOption('select', pattern)
  await page.click('button[type="submit"]:has-text("Add")')
}

test.describe('Feature 03 - Recurring Todos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('creates a recurring todo with badge', async ({ page }) => {
    const title = `Recurring Weekly ${Date.now()}`
    await addRecurringTodo(page, title, 'weekly')

    const row = page.locator('div').filter({ hasText: title }).first()
    await expect(row).toBeVisible()
    await expect(row.getByText('🔄 weekly')).toBeVisible()
  })

  test('completing recurring todo creates next instance', async ({ page }) => {
    const title = `Recurring Daily ${Date.now()}`
    await addRecurringTodo(page, title, 'daily')

    const firstRow = page.locator('div').filter({ hasText: title }).first()
    await firstRow.locator('input[type="checkbox"]').click()

    await expect(page.getByText('COMPLETED')).toBeVisible()
    await expect(page.getByText(title)).toHaveCount(2)
  })

  test('shows validation error when recurring todo has no due date', async ({ page }) => {
    await page.fill('input[placeholder="What needs to be done?"]', `Missing due ${Date.now()}`)
    await page.getByLabel('Repeat').check()
    await page.selectOption('select', 'daily')
    await page.click('button[type="submit"]:has-text("Add")')

    await expect(page.getByText('Recurring todos require a due date')).toBeVisible()
  })

  test('can edit recurrence settings on and off', async ({ page }) => {
    const title = `Recurring Edit ${Date.now()}`
    await addRecurringTodo(page, title, 'weekly')

    let row = page.locator('div').filter({ hasText: title }).first()
    await row.getByRole('button', { name: 'Edit todo' }).click()

    let modal = page.locator('div.fixed.inset-0').last()
    await modal.getByLabel('Repeat').uncheck()
    await modal.getByRole('button', { name: 'Save' }).click()

    row = page.locator('div').filter({ hasText: title }).first()
    await expect(row.getByText('🔄 weekly')).not.toBeVisible()

    await row.getByRole('button', { name: 'Edit todo' }).click()
    modal = page.locator('div.fixed.inset-0').last()
    await modal.getByLabel('Repeat').check()
    await modal.locator('select').selectOption('monthly')
    await modal.getByRole('button', { name: 'Save' }).click()

    row = page.locator('div').filter({ hasText: title }).first()
    await expect(row.getByText('🔄 monthly')).toBeVisible()
  })
})
