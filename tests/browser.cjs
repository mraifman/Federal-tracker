// Optional browser regression suite. Interactive QA is also performed in the shared browser.
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 for(const viewport of [{width:1280,height:1000},{width:390,height:844}]){
  const page=await browser.newPage({viewport}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.argv[2]||'http://127.0.0.1:8000/');await page.waitForSelector('.agency-bubble',{state:'attached'});
  if(!(await page.locator('#workforce-app .headline-stats').innerText()).includes('185,816'))throw Error('Non-defense default mismatch');
  await page.click('[data-focus="TR"]');
  for(const n of ['117,063','83,063','34,000'])if(!(await page.locator('#workforce-app .headline-stats').innerText()).includes(n))throw Error('Treasury mismatch '+n);
  if(await page.locator('.agency-bubble').count()<2)throw Error('Agency did not default to internal breakdown');
  await page.locator('#workforce-app button[data-chart-mode="bubbles"]').click();
  await page.locator('.agency-bubble[data-agency="TR|TR93"]').focus();await page.keyboard.press('Enter');
  if(!(await page.locator('.bubble-guide').innerText()).includes('Occupational series'.toUpperCase()))throw Error('Leaf roles not explicitly labeled');
  if(await page.locator('[role="dialog"]').count())throw Error('Unexpected workforce modal');
  await page.click('.site-header [data-explore-view="uses"]');await page.locator('#outbound-kind').waitFor({state:'attached'});await page.locator('#outbound-panel .award-filter-panel').evaluate(e=>e.open=true);
  await page.selectOption('#outbound-kind','Grants / cooperative agreements');await page.waitForFunction(()=>document.querySelector('#outbound-kind').value==='Grants / cooperative agreements');
  if(await page.locator('#outbound-panel .award-mark').count()<1)throw Error('Grant program allocation missing');
  await page.selectOption('#outbound-group','recipient');await page.locator('#outbound-panel .award-mark').first().waitFor();
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Page overflow');
  if(errors.length)throw Error(errors.join('\n'));
  console.log(JSON.stringify({width:viewport.width,agencyBreakdown:true,rolesLabeled:true,grantPrograms:true,recipients:true,noOverflow:true}));await page.close();
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
