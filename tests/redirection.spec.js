// tests/redirection.spec.js
import { test, expect } from '@playwright/test';
import { checkNavigation, generateHtmlReport } from '../pages/navigationChecks'; // Adjust path if needed

test('Verify all old URLs redirect correctly and no 404 pages are found', async ({ page }) => {
  const excelFilePath = './data/url_redirections.xlsx';
  const reportOutputFolder = './reports';
  const reportFileName = `redirection_report_${new Date().toISOString().replace(/:/g, '-')}.html`;
  const reportFullPath = `${reportOutputFolder}/${reportFileName}`;

  console.log(`\n--- Starting URL Redirection Test ---`);
  console.log(`   Excel File: ${excelFilePath}`);
  console.log(`   Report will be saved to: ${reportFullPath}`);
  console.log(`   Timestamp: ${new Date().toLocaleString()}\n`);

  // Renamed 'failedRecords' to 'allResults'
  const allResults = await checkNavigation(page, excelFilePath);

  // Filter failed records for console output and test failure condition
  const failedRecords = allResults.filter(record => record.status === 'Failed');


  console.log(`[DEBUG] About to call generateHtmlReport. Total Records Count: ${allResults.length}, Failed: ${failedRecords.length}`);
  await generateHtmlReport(allResults, reportFullPath); // Pass allResults
  console.log(`[DEBUG] generateHtmlReport call completed.`);


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
