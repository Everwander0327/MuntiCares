import { BASE_URL, OVERLAY_PROBES } from './config.mjs';
import { probeDialogState, probeFocusReturn, probeOverlayClosed, markFullscreenRoots } from './audit.mjs';

// Opens each overlay, captures dialog semantics, presses Escape, and verifies
// focus restoration. Results are appended to `sink`.
export async function runOverlayProbes(page, roleName, sink) {
  const probes = OVERLAY_PROBES.filter((item) => item.role === roleName);
  for (const probe of probes) {
    const record = { id: probe.id, role: roleName, route: probe.route, status: 'skipped' };
    try {
      await page.goto(BASE_URL + probe.route, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2400);
      if (probe.prepare) await probe.prepare(page);
      const trigger = probe.trigger(page);
      if (!(await trigger.count())) {
        record.skipReason = 'trigger not found';
        sink.push(record);
        console.log(`overlay ${probe.id}: skipped (trigger not found)`);
        continue;
      }
      await trigger.evaluate((el) => el.setAttribute('data-qa-trigger', '1'));
      await page.evaluate(markFullscreenRoots);
      await trigger.click();
      await page.waitForTimeout(probe.settle);

      const state = await page.evaluate(probeDialogState, { overlayId: probe.id });
      Object.assign(record, state);
      if (!state.newOverlayRootCount) {
        record.status = 'skipped';
        record.skipReason = 'trigger clicked but no overlay opened';
        sink.push(record);
        console.log(`overlay ${probe.id}: skipped (no overlay opened)`);
        await page.goto(BASE_URL + probe.route, { waitUntil: 'domcontentloaded', timeout: 30000 });
        continue;
      }
      record.status = 'measured';

      await page.keyboard.press('Escape');
      await page.waitForTimeout(700);
      const afterEscape = await page.evaluate(probeOverlayClosed);
      record.escapeCloses = afterEscape.newOverlayRootCount === 0;
      record.rootsAfterEscape = afterEscape.overlayRootCount;

      if (!record.escapeCloses) {
        // Overlay ignores Escape; reset the page so the next probe starts clean.
        await page.goto(BASE_URL + probe.route, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(800);
      } else {
        const focus = await page.evaluate(probeFocusReturn);
        record.focusReturnedToTrigger = focus.focusReturnedToTrigger;
        record.activeAfterEscape = focus.activeElement;
        await trigger.evaluate((el) => el.removeAttribute('data-qa-trigger')).catch(() => {});
      }
    } catch (error) {
      record.status = 'skipped';
      record.skipReason = String(error).slice(0, 150);
    }
    sink.push(record);
    console.log(
      `overlay ${probe.id}: ${record.status}${record.skipReason ? ` (${record.skipReason})` : ''} ` +
        `role=dialog:${record.dialogCount ?? '-'} aria-modal:${record.ariaModal ?? '-'} focus-inside:${record.focusInsideDialog ?? '-'} escape:${record.escapeCloses ?? '-'}`
    );
  }
  return sink;
}
