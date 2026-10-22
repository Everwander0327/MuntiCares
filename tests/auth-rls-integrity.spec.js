import { test, expect } from '@playwright/test';

test.describe('MuntiCares System & Auth+RLS Integrity Suite', () => {

  test('1. Public Shell: Landing page loads and FAQ section is confirmed absent', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/MuntiCares/i);
    // Branding exists
    await expect(page.getByText('MuntiCares').first()).toBeVisible();
    // FAQ is permanently removed as requested
    const faqHeading = page.locator('#faq-heading');
    await expect(faqHeading).toHaveCount(0);
    // Navigation to login
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL(/\/login/);
  });

  test('2. Unauthenticated Protected Route Access: Redirects to /login', async ({ page }) => {
    // Attempt to access protected dashboard directly without auth
    await page.goto('/patient/dashboard');
    await expect(page).toHaveURL(/\/login/);

    await page.goto('/provider/dashboard');
    await expect(page).toHaveURL(/\/login/);

    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('3. Authentication: Invalid password is rejected', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'andrew@gmail.com');
    await page.fill('input[type="password"]', 'wrong_password_123');
    await page.click('button[type="submit"]');

    // Should display invalid credentials error toast/message
    await expect(page.getByText(/invalid email or password/i).first()).toBeVisible({ timeout: 8000 });
    // URL stays on /login
    await expect(page).toHaveURL(/\/login/);
  });

  test('4. Patient Journey: Real Login, Multi-Tab Navigation, Role Boundaries & Logout', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'andrew@gmail.com');
    await page.fill('input[type="password"]', 'andrew123');
    await page.click('button[type="submit"]');

    // Successfully redirects to patient dashboard
    await expect(page).toHaveURL(/\/patient\/dashboard/, { timeout: 15000 });

    // Verify Patient UI & welcome/name
    await expect(page.getByText(/Andrew/i).first()).toBeVisible();

    // Verify Patient Requests page
    await page.goto('/patient/requests');
    await expect(page).toHaveURL(/\/patient\/requests/);
    await expect(page.getByText(/My Service Requests/i).first()).toBeVisible();

    // Verify Patient Providers page
    await page.goto('/patient/providers');
    await expect(page).toHaveURL(/\/patient\/providers/);
    await expect(page.getByRole('heading', { name: /Find a Healthcare Provider/i })).toBeVisible();

    // Verify Patient Profile page
    await page.goto('/patient/profile');
    await expect(page).toHaveURL(/\/patient\/profile/);
    await expect(page.getByText(/Profile|Personal Info|Account/i).first()).toBeVisible();

    // Verify Patient cannot cross into Provider or Admin dashboards (auto-redirects to /patient/dashboard)
    await page.goto('/provider/dashboard');
    await expect(page).toHaveURL(/\/patient\/dashboard/);

    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/patient\/dashboard/);

    // Logout
    const logoutBtn = page.getByRole('button', { name: /Logout/i }).first();
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
      await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
    }
  });

  test('5. Provider Journey: Real Login, Multi-Tab Navigation, Role Boundaries & Logout', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'johnlawrence@gmail.com');
    await page.fill('input[type="password"]', '12345678');
    await page.click('button[type="submit"]');

    // Successfully redirects to provider dashboard
    await expect(page).toHaveURL(/\/provider\/dashboard/, { timeout: 15000 });

    // Verify Provider UI
    await expect(page.getByText(/John/i).first()).toBeVisible();

    // Verify Provider Requests page
    await page.goto('/provider/requests');
    await expect(page).toHaveURL(/\/provider\/requests/);
    await expect(page.getByText(/Patient Requests|Bookings|Appointments/i).first()).toBeVisible();

    // Verify Provider Patients page
    await page.goto('/provider/patients');
    await expect(page).toHaveURL(/\/provider\/patients/);
    await expect(page.getByText(/Patients|Roster|My Patients/i).first()).toBeVisible();

    // Verify Provider Schedule page
    await page.goto('/provider/schedule');
    await expect(page).toHaveURL(/\/provider\/schedule/);
    await expect(page.getByText(/Schedule|Availability|Calendar/i).first()).toBeVisible();

    // Verify Provider cannot access Admin (auto-redirects to /provider/dashboard)
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/provider\/dashboard/);

    // Logout
    const logoutBtn = page.getByRole('button', { name: /Logout/i }).first();
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
      await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
    }
  });

  test('6. Admin Journey: Real Login, System Administration Tabs & Logout', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@munticares.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');

    // Successfully redirects to admin dashboard
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });
    await expect(page.getByText(/Admin|Overview|Dashboard/i).first()).toBeVisible();

    // Verify Admin Patients page
    await page.goto('/admin/patients');
    await expect(page).toHaveURL(/\/admin\/patients/);
    await expect(page.getByText(/Patients/i).first()).toBeVisible();

    // Verify Admin Providers page
    await page.goto('/admin/providers');
    await expect(page).toHaveURL(/\/admin\/providers/);
    await expect(page.getByText(/Providers|Doctors|Nurses/i).first()).toBeVisible();

    // Verify Admin Requests page
    await page.goto('/admin/requests');
    await expect(page).toHaveURL(/\/admin\/requests/);
    await expect(page.getByText(/Requests|Appointments/i).first()).toBeVisible();

    // Verify Admin Announcements page
    await page.goto('/admin/announcements');
    await expect(page).toHaveURL(/\/admin\/announcements/);
    await expect(page.getByText(/Announcements|Broadcast/i).first()).toBeVisible();

    // Logout
    const logoutBtn = page.getByRole('button', { name: /Logout/i }).first();
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
      await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
    }
  });

});
