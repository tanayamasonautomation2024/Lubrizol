// utils/navigationChecks.js
import { test, expect } from '@playwright/test';
import * as XLSX from 'xlsx';
import fs from 'fs-extra';
import pug from 'pug';

// Helper function to remove trailing slash if present (and not just root '/')
function normalizeUrl(url) {
  if (url && url.length > 1 && url.endsWith('/')) {
    return url.slice(0, -1);
  }
  return url;
}

/**
 * Checks URL redirection and verifies the absence of a "Page Not Found" H1 on the new page.
 * It collects ALL records (passed, failed, skipped) for easy reporting.
 *
 * @param {import('@playwright/test').Page} page - The Playwright Page object.
 * @param {string} excelFilePath - The path to the Excel file containing the test data.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of all test records (passed/failed/skipped).
 */
export async function checkNavigation(page, excelFilePath) {
  const workbook = XLSX.readFile(excelFilePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const rows = data.slice(1);
  const allTestResults = []; // New array to store all results

  for (const row of rows) {
    const oldUrl = row[0];
    const expectedNewUrlContains = row[1];

    let currentRecord = { // Create a record for each row
      oldUrl: oldUrl,
      expectedNewUrlContains: expectedNewUrlContains,
      status: 'Passed', // Assume passed until a failure is found
      reason: '',
      newUrl: 'N/A',
      error: 'N/A'
    };

    if (!oldUrl || !expectedNewUrlContains) {
      console.warn('Skipping row due to missing old URL or expected new URL part:', row);
      currentRecord.status = 'Skipped';
      currentRecord.reason = 'Missing Old URL or Expected New URL part in Excel';
      currentRecord.error = currentRecord.reason;
      allTestResults.push(currentRecord); // Add skipped record
      continue;
    }

    let failureReason = '';
    let newUrlReached = 'N/A';

    try {
      await page.goto(oldUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      newUrlReached = page.url();
      currentRecord.newUrl = newUrlReached; // Update the new URL for the record

      // Normalize both URLs for comparison (remove trailing slash and convert to lowercase)
      const normalizedActualUrl = normalizeUrl(newUrlReached).toLowerCase();
      const normalizedExpectedPart = normalizeUrl(expectedNewUrlContains).toLowerCase();

      if (!normalizedActualUrl.includes(normalizedExpectedPart)) {
        failureReason += `URL Mismatch (Case & Trailing Slash Insensitive): Expected to contain "${expectedNewUrlContains}", but got "${newUrlReached}". `;
      }

      const h1NotFound = page.locator('h1', { hasText: /Page Not Found|Error 404|404 Not Found/i });
      const h1NotFoundCount = await h1NotFound.count();

      if (h1NotFoundCount > 0) {
        failureReason += ` "Page Not Found" H1 detected on the new page. `;
      }

    } catch (e) {
      failureReason += `Navigation or initial check failed: ${e.message}. `;
    }

    if (failureReason) {
      // console.error(`FAILED: ${oldUrl} -> ${newUrlReached}. Reason: ${failureReason}`); // Console log for failures
      currentRecord.status = 'Failed';
      currentRecord.reason = failureReason.trim();
      currentRecord.error = failureReason;
    } else {
      // console.log(`SUCCESS: ${oldUrl} -> ${newUrlReached}`); // Console log for passes
    }
    // console.log('---'); // Console log separator
    allTestResults.push(currentRecord); // Add the completed record (pass/fail)
  }

  return allTestResults; // Return all results
}

/**
 * Generates an HTML report from all test records.
 * @param {Array<Object>} allTestRecords - Array of all test records (passed/failed/skipped).
 * @param {string} reportPath - Path where the HTML report should be saved.
 */
export async function generateHtmlReport(allTestRecords, reportPath) { // Updated parameter name
    const templatePath = './templates/report.pug';

    console.log(`[Report Debug] Attempting to generate report.`);
    console.log(`[Report Debug] Report Path: ${reportPath}`);
    console.log(`[Report Debug] Template Path: ${templatePath}`);

    try {
        await fs.ensureDir('reports');
        console.log(`[Report Debug] 'reports' directory ensured to exist.`);

        if (!await fs.pathExists(templatePath)) {
            console.error(`[Report Debug] ERROR: Pug template file NOT found at: ${templatePath}`);
            return;
        }
        console.log(`[Report Debug] Pug template found.`);

        const passedRecords = allTestRecords.filter(r => r.status === 'Passed');
        const failedRecords = allTestRecords.filter(r => r.status === 'Failed');
        const skippedRecords = allTestRecords.filter(r => r.status === 'Skipped');


        const compiledFunction = pug.compileFile(templatePath);
        const html = compiledFunction({
            allTestRecords: allTestRecords, // Pass all records to the template
            passedRecordsCount: passedRecords.length,
            failedRecordsCount: failedRecords.length,
            skippedRecordsCount: skippedRecords.length,
            totalRecordsCount: allTestRecords.length,
            reportDate: new Date().toLocaleString(),
        });
        console.log(`[Report Debug] Pug template compiled and HTML generated.`);

        await fs.writeFile(reportPath, html);
        console.log(`[Report Debug] HTML report written successfully to: ${reportPath}`);
        console.log(`\nHTML report generated: ${reportPath}`);
    } catch (error) {
        console.error(`[Report Debug] FATAL ERROR generating HTML report:`);
        console.error(`[Report Debug] Error details:`, error);
        console.error(`[Report Debug] Error message: ${error.message}`);
        if (error.code) console.error(`[Report Debug] Error code: ${error.code}`);
    }
}
