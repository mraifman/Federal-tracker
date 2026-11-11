const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
for(const width of [1440,390]){const page=await browser.newPage({viewport:{width,height:1000},acceptDownloads:true,reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(process.argv[2]||'http://127.0.0.1:8000/',{waitUntil:'networkidle'});
await page.locator('.agency-bubble').first().waitFor({state:'attached'});
assert.equal(await page.locator('#atlas-facts .workforce-signal span').textContent(),'Fewer non-defense employees');
assert.equal(await page.locator('#workforce-app .trend-layout,.office-inspector,.repair-tiles').count(),0);
assert(await page.locator('#workforce-app .spotlights').evaluate(e=>e.getBoundingClientRect().top>document.querySelector('#workforce-app .bubble-panel').getBoundingClientRect().bottom));
await page.click('[data-focus="DOD"]');assert(await page.locator('#workforce-app>.warning').isVisible());
await page.click('[data-focus="TR"]');assert.equal(await page.locator('#workforce-app>.warning').count(),0);
await page.click('[data-focus="EP"]');assert.equal(await page.locator('#focus').inputValue(),'EP');assert.equal(await page.locator('#workforce-app>.warning').count(),0);
await page.click('.site-header [data-explore-view="funding"]');assert(await page.locator('#funding-context .budget-structure').isVisible());assert(await page.locator('#repair-hero').isHidden());assert(await page.locator('.universe-hero').isHidden());
assert.equal(await page.locator('#funding-panel .service-people,#funding-panel .demolition').count(),0);
assert.equal(await page.locator('#funding-metric option[value="net_outlays"]').count(),0);
await page.click('.site-header [data-explore-view="uses"]');await page.locator('#grant-flow [data-flow-sector]').first().waitFor();
assert.deepEqual(await page.locator('.flow-period button').allTextContents(),['Change, 2024–2026','2026 flows','2024 flows']);assert(await page.locator('.flow-inspector').isHidden());assert(await page.locator('#funding-context').isHidden());
for(const text of ['2026 flows','2024 flows','Change, 2024–2026']){await page.getByRole('button',{name:text,exact:true}).click();assert.equal(await page.getByRole('button',{name:text,exact:true}).getAttribute('aria-pressed'),'true');}
await page.locator('#grant-flow [data-flow-sector]').first().focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('#outbound-group')?.value==='recipient');assert((await page.locator('.award-result-region .bubble-breadcrumb').innerText()).includes('›'));assert((await page.locator('#outbound-bubbles h3').textContent()).includes(' to '));
assert.equal(await page.locator('#outlays-app').count(),0);
assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);console.log({width,tabScopes:true,EPA:true,defenseWarning:true,flowModes:true,linkedPrograms:true,oneMoneyMeasure:true,errors});await page.close();}
await browser.close()})().catch(e=>{console.error(e);process.exit(1)});
