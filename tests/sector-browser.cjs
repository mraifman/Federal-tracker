const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const target=new URL(process.argv[2]||'http://127.0.0.1:8000/');target.searchParams.set('view','uses');target.searchParams.set('agency','ALL');
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:1000},acceptDownloads:true,reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(target.href,{waitUntil:'networkidle'});await page.locator('#outbound-kind').waitFor({state:'attached'});await page.locator('.award-filter-panel').evaluate(e=>e.open=true);const panel=page.locator('#outbound-panel');
  const pick=async label=>{await panel.locator('.award-mark .endpoint-caption>strong').filter({hasText:label}).first().click();await page.waitForFunction(()=>document.querySelector('#outbound-group').value==='recipient');await page.selectOption('#outbound-group','program')};
  await pick('Academia');assert((await panel.locator('.recipient-scope').innerText()).includes('Academia'));
  assert(!/national clean investment fund|clean communities investment accelerator/i.test(await panel.locator('#outbound-bubbles').innerText()));
  const academicDownload=page.waitForEvent('download');await page.click('#outbound-export');const academicCsv=await fs.readFile(await (await academicDownload).path(),'utf8');assert(!academicCsv.includes('66.957'));assert(!academicCsv.includes('66.960'));
  await page.click('#outbound-root');await pick('Nonprofits');assert((await panel.locator('.recipient-scope').innerText()).includes('Nonprofits'));
  const ggrf=panel.locator('.award-mark').filter({hasText:/national clean investment fund/i});await ggrf.waitFor();assert((await ggrf.innerText()).includes('$13.97B'));
  const nonprofitDownload=page.waitForEvent('download');await page.click('#outbound-export');const nonprofitCsv=await fs.readFile(await (await nonprofitDownload).path(),'utf8');assert(nonprofitCsv.includes('66.957'));assert(nonprofitCsv.includes('13970000000'));
  await ggrf.click();await page.waitForFunction(()=>document.querySelector('#outbound-group').value==='recipient');await panel.locator('.award-mark').first().waitFor();
  assert((await panel.locator('#outbound-bubbles').innerText()).toLowerCase().includes('climate united fund'));
  assert.equal(await panel.locator('.award-mark').count(),3);
  await page.selectOption('#outbound-basis','awarding');await panel.locator('.award-mark').first().waitFor();assert.equal(await panel.locator('.award-mark').count(),3);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
  await panel.locator('#outbound-bubbles').evaluate(e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:'/tmp/ggrf-corrected-'+width+'.png'});
  console.log(JSON.stringify({url:target.href,width,academiaExcludesGgrf:true,academiaExportExcludesGgrf:true,nonprofitsRetain1397B:true,nonprofitExport:true,threeVerifiedRecipients:true,bothAgencyRoles:true,noOverflow:true,errors}));await page.close();
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
