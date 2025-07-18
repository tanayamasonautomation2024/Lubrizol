// tests/redirection.spec.js
import { test, expect } from '@playwright/test';
import { checkNavigation, generateHtmlReport } from '../pages/navigationChecks'; // IMPORT BOTH FUNCTIONS

test('Verify all old URLs redirect correctly and no 404 pages are found', async ({ page }) => {
  test.setTimeout(2000000);
  const excelFilePath = './data/url_redirections.xlsx';
  const reportOutputFolder = './reports'; // Folder to save reports
  const reportFileName = `redirection_report_${new Date().toISOString().replace(/:/g, '-')}.html`;
  const reportFullPath = `${reportOutputFolder}/${reportFileName}`;

  console.log(`\n--- Starting URL Redirection Test ---`);
  console.log(`   Excel File: ${excelFilePath}`);
  console.log(`   Report will be saved to: ${reportFullPath}`);
  console.log(`   Timestamp: ${new Date().toLocaleString()}\n`);

  const failedRecords = await checkNavigation(page, excelFilePath);

  // === THIS IS THE CRUCIAL PART ===
  // Generate the HTML report regardless of success or failure
  await generateHtmlReport(failedRecords, reportFullPath);
  // =================================

  if (failedRecords.length > 0) {
    console.error('\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    console.error('!!!!! TEST FAILED: Some URL Redirections or 404 Pages Found !!!!!');
    console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n');

    console.error(`Total Failed Navigations: ${failedRecords.length}\n`);

    failedRecords.forEach((record, index) => {
      console.error(`--- FAILURE #${index + 1} ---`);
      console.error(`  Old URL:                 ${record.oldUrl}`);
      console.error(`  Expected New URL Part:   ${record.expectedNewUrlContains}`);
      console.error(`  Actual New URL Reached:  ${record.newUrl}`);
      console.error(`  Reason for Failure:      ${record.reason}`);
      console.error('--------------------------------------------------\n');
    });

    throw new Error(`${failedRecords.length} URL redirection(s) failed. See detailed console logs and HTML report for details.`);
  } else {
    console.log('\n=================================================');
    console.log('==== All URL Redirections Passed Successfully! ====');
    console.log('=================================================\n');
  }
});