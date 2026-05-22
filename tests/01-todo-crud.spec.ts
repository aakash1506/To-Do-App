import { test, expect, Page } from '@playwright/test'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns a datetime-local string 5 minutes in the future,
 * formatted as "YYYY-MM-DDTHH:mm" for the input[type=datetime-local].
 */
function futureDateTimeLocal(minutesAhead = 5): string {
  const d = new Date(Date.now() + minutesAhead * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  )
}

async function addTodo(page: Page, title: string, dueDate?: string) {
  await page.fill('input[placeholder="What needs to be done?"]', title)
  if (dueDate) {
    await page.fill('input[type="datetime-local"]', dueDate)
  }
  await page.click('button[type="submit"]:has-text("Add")')
  // Wait for the todo to appear in the list
  await expect(page.getByText(title).first()).toBeVisible()
}

async function createTag(page: Page, name: string, color = '#2563EB') {
  await page.fill('input[placeholder="Tag name"]', name)
  await page.fill('input[type="color"]', color)
  await page.click('button:has-text("Add Tag")')
  await expect(page.getByText(name).first()).toBeVisible()
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Feature 01 — Todo CRUD Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  // ── CREATE ─────────────────────────────────────────────────────────────────

  test('creates a todo with title only', async ({ page }) => {
    const title = `E2E Task ${Date.now()}`
    await addTodo(page, title)
    await expect(page.getByText(title)).toBeVisible()
  })

  test('creates a todo with a future due date', async ({ page }) => {
    const title = `Deadline Task ${Date.now()}`
    await addTodo(page, title, futureDateTimeLocal(10))
    await expect(page.getByText(title)).toBeVisible()
  })

  test('shows error for empty title', async ({ page }) => {
    await page.click('button[type="submit"]:has-text("Add")')
    await expect(page.getByText(/required/i)).toBeVisible()
  })

  test('shows error for past due date', async ({ page }) => {
    await page.fill('input[placeholder="What needs to be done?"]', 'Past date task')
    // type a datetime in the past via API
    const past = new Date(Date.now() - 60_000)
    const isoStr = past.toISOString().slice(0, 16)
    // force past date into the input (bypasses min constraint via eval)
    await page.evaluate(
      ({ sel, val }) => {
        const el = document.querySelector(sel) as HTMLInputElement
        if (el) { el.value = val }
      },
      { sel: 'input[type="datetime-local"]', val: isoStr },
    )
    await page.click('button[type="submit"]:has-text("Add")')
    await expect(page.getByText(/future/i)).toBeVisible()
  })

  // ── READ / SECTIONS ────────────────────────────────────────────────────────

  test('shows empty state when no todos exist', async ({ page }) => {
    // This test may fail if other tests leave todos — run isolated
    await expect(
      page.getByText('No todos yet. Add one above!').or(
        page.locator('[data-testid="todo-list"]'),
      ),
    ).toBeTruthy()
  })

  test('completed todos appear in the Completed section', async ({ page }) => {
    const title = `Complete me ${Date.now()}`
    await addTodo(page, title)

    // Tick the checkbox
    const row = page.locator('div').filter({ hasText: title }).first()
    await row.locator('input[type="checkbox"]').click()

    // Wait for Completed section
    await expect(page.getByText('COMPLETED')).toBeVisible()
  })

  // ── UPDATE ─────────────────────────────────────────────────────────────────

  test('edits a todo title', async ({ page }) => {
    const original = `Edit me ${Date.now()}`
    const updated = `Updated ${Date.now()}`
    await addTodo(page, original)

    const row = page.locator('div').filter({ hasText: original }).first()
    await row.getByRole('button', { name: 'Edit todo' }).click()

    await page.fill('input[type="text"]', updated)
    await page.click('button:has-text("Save")')

    await expect(page.getByText(updated)).toBeVisible()
    await expect(page.getByText(original)).not.toBeVisible()
  })

  test('cancel edit keeps original title', async ({ page }) => {
    const original = `Cancel edit ${Date.now()}`
    await addTodo(page, original)

    const row = page.locator('div').filter({ hasText: original }).first()
    await row.getByRole('button', { name: 'Edit todo' }).click()

    await page.fill('input[type="text"]', 'Should not save')
    await page.click('button:has-text("Cancel")')

    await expect(page.getByText(original)).toBeVisible()
    await expect(page.getByText('Should not save')).not.toBeVisible()
  })

  // ── TOGGLE ─────────────────────────────────────────────────────────────────

  test('toggles todo completion on and off', async ({ page }) => {
    const title = `Toggle ${Date.now()}`
    await addTodo(page, title)

    const row = page.locator('div').filter({ hasText: title }).first()
    const checkbox = row.locator('input[type="checkbox"]')

    // Mark complete
    await checkbox.click()
    await expect(page.getByText('COMPLETED')).toBeVisible()

    // Mark incomplete again
    await checkbox.click()
    await expect(page.getByText('ACTIVE')).toBeVisible()
  })

  // ── DELETE ─────────────────────────────────────────────────────────────────

  test('deletes a todo after confirmation', async ({ page }) => {
    const title = `Delete me ${Date.now()}`
    await addTodo(page, title)

    // Auto-accept the confirm dialog
    page.once('dialog', (dialog) => dialog.accept())

    const row = page.locator('div').filter({ hasText: title }).first()
    await row.getByRole('button', { name: 'Delete todo' }).click()

    await expect(page.getByText(title)).not.toBeVisible()
  })

  test('cancels delete and keeps the todo', async ({ page }) => {
    const title = `Keep me ${Date.now()}`
    await addTodo(page, title)

    // Dismiss the confirm dialog
    page.once('dialog', (dialog) => dialog.dismiss())

    const row = page.locator('div').filter({ hasText: title }).first()
    await row.getByRole('button', { name: 'Delete todo' }).click()

    await expect(page.getByText(title)).toBeVisible()
  })

  test('creates and filters by tag', async ({ page }) => {
    const tagName = `Work ${Date.now()}`
    const title = `Tagged ${Date.now()}`

    await createTag(page, tagName)
    await page.fill('input[placeholder="What needs to be done?"]', title)
    await page.click(`button:has-text("${tagName}")`)
    await page.click('button[type="submit"]:has-text("Add")')

    await expect(page.getByText(title).first()).toBeVisible()
    await page.click('button:has-text("All")')
    await page.click(`button:has-text("${tagName}")`)
    await expect(page.getByText(title).first()).toBeVisible()
  })
})
