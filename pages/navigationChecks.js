// js/navigationChecks.js
import { test, expect } from '@playwright/test';
import * as XLSX from 'xlsx';
import fs from 'fs-extra';
import pug from 'pug';

// Helper function to remove trailing slash if present (and not just root '/')
function normalizeUrl(url) {
  if (url && url.length > 1 && url.endsWith('/')) {
    // Avoid normalizing the root path 'https://example.com/' to 'https://example.com'
    // It should remain 'https://example.com/' or equivalent after redirection for root.
    // However, for path segments like /page/, removing the trailing slash is desired.
    // This simple check handles most cases where a slash at the end of a path segment is optional.
    const lastCharRemoved = url.slice(0, -1);
    // Basic check to prevent stripping slash from a root domain like "http://example.com/"
    // or if the URL became just the protocol part
    if (lastCharRemoved.includes('://') && lastCharRemoved.endsWith(':')) { // e.g., 'http:'
        return url; // Don't remove if it reduces to just protocol part
    }
    return lastCharRemoved;
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

  const rows = data.slice(1); // Skip header row
  const allTestResults = []; // Array to store all test outcomes

  for (const row of rows) {
    const oldUrl = row[0];
    const expectedNewUrlContains = row[1];

    let currentRecord = { // Initialize record for current row
      oldUrl: oldUrl,
      expectedNewUrlContains: expectedNewUrlContains,
      status: 'Passed', // Assume passed until a failure is found
      reason: '',
      newUrl: 'N/A', // Default for new URL
      error: 'N/A' // Default for error details
    };

    if (!oldUrl || !expectedNewUrlContains) {
      console.warn('Skipping row due to missing Old URL or Expected New URL part:', row);
      currentRecord.status = 'Skipped';
      currentRecord.reason = 'Missing Old URL or Expected New URL part in Excel';
      currentRecord.error = currentRecord.reason;
      allTestResults.push(currentRecord); // Add skipped record to results
      continue; // Move to next row
    }

    let failureReason = '';
    let newUrlReached = 'N/A';

    try {
      // Set a timeout for page.goto specifically to handle slow navigations.
      // 60000ms (60 seconds) is a common default, but can be adjusted.
      await page.goto(oldUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      newUrlReached = page.url();
      currentRecord.newUrl = newUrlReached; // Update the new URL for the record

      // Normalize both URLs for comparison: remove trailing slash and convert to lowercase.
      // This makes the comparison insensitive to these common URL variations.
      const normalizedActualUrl = normalizeUrl(newUrlReached).toLowerCase();
      const normalizedExpectedPart = normalizeUrl(expectedNewUrlContains).toLowerCase();

      // Check if the actual new URL contains the expected part.
      if (!normalizedActualUrl.includes(normalizedExpectedPart)) {
        failureReason += `URL Mismatch (Case & Trailing Slash Insensitive): Expected to contain "${expectedNewUrlContains}", but got "${newUrlReached}". `;
      }

      // Check for common "Page Not Found" H1 text on the new page.
      // The /i flag makes the text matching case-insensitive.
      const h1NotFound = page.locator('h1', { hasText: /Page Not Found|Error 404|404 Not Found/i });
      const h1NotFoundCount = await h1NotFound.count();

      if (h1NotFoundCount > 0) {
        failureReason += ` "Page Not Found" H1 detected on the new page. `;
      }

    } catch (e) {
      // Catch any Playwright navigation errors (e.g., timeout, network errors).
      failureReason += `Navigation or initial check failed: ${e.message}. `;
    }

    // Determine final status for the current record
    if (failureReason) {
      console.error(`FAILED: ${oldUrl} -> ${newUrlReached}. Reason: ${failureReason}`); // Log failures to console
      currentRecord.status = 'Failed';
      currentRecord.reason = failureReason.trim();
      currentRecord.error = failureReason;
    } else {
      console.log(`SUCCESS: ${oldUrl} -> ${newUrlReached}`); // Log successes to console
    }
    console.log('---'); // Log separator after each check

    allTestResults.push(currentRecord); // Add the final record (pass/fail/skipped) to results
  }

  return allTestResults; // Return all collected results
}

/**
 * Generates an HTML report from all test records.
 * @param {Array<Object>} allTestRecords - Array of all test records (passed/failed/skipped).
 * @param {string} reportPath - Path where the HTML report should be saved.
 */
export async function generateHtmlReport(allTestRecords, reportPath) {
    // The template path is relative to the project root where the script is run from.
    const templatePath = './templates/report.pug';

    console.log(`[Report Debug] Attempting to generate report.`);
    console.log(`[Report Debug] Report Path: ${reportPath}`);
    console.log(`[Report Debug] Template Path: ${templatePath}`);

    try {
        // Ensure the 'reports' directory exists
        await fs.ensureDir('reports');
        console.log(`[Report Debug] 'reports' directory ensured to exist.`);

        // Check if the Pug template file actually exists
        if (!await fs.pathExists(templatePath)) {
            console.error(`[Report Debug] ERROR: Pug template file NOT found at: ${templatePath}`);
            return; // Exit if template not found
        }
        console.log(`[Report Debug] Pug template found.`);

        // Categorize records for summary counts
        const passedRecords = allTestRecords.filter(r => r.status === 'Passed');
        const failedRecords = allTestRecords.filter(r => r.status === 'Failed');
        const skippedRecords = allTestRecords.filter(r => r.status === 'Skipped');

        // Compile the Pug template and render HTML
        const compiledFunction = pug.compileFile(templatePath);
        const html = compiledFunction({
            allTestRecords: allTestRecords, // Pass all records to the template for detailed table
            passedRecordsCount: passedRecords.length,
            failedRecordsCount: failedRecords.length,
            skippedRecordsCount: skippedRecords.length,
            totalRecordsCount: allTestRecords.length,
            reportDate: new Date().toLocaleString(), // Current date and time for the report
        });
        console.log(`[Report Debug] Pug template compiled and HTML generated.`);

        // Write the generated HTML to the specified report path
        await fs.writeFile(reportPath, html);
        console.log(`[Report Debug] HTML report written successfully to: ${reportPath}`);
        console.log(`\nHTML report generated: ${reportPath}`);
    } catch (error) {
        console.error(`[Report Debug] FATAL ERROR generating HTML report:`);
        console.error(`[Report Debug] Error details:`, error);
        console.error(`[Report Debug] Error message: ${error.message}`);
        if (error.code) console.error(`[Report Debug] Error code: ${error.code}`); // Log specific error code if available
    }
}
