const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 for(const viewport of [{width:1280,height:1000},{width:390,height:844}]){
  const page=await browser.newPage({viewport}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.argv[2]||'http://127.0.0.1:8000/');await page.waitForSelector('.headline-stats');
  for(const n of ['2,312,301','2,017,021','295,280'])if(!(await page.locator('.headline-stats').innerText()).includes(n))throw Error('Government total mismatch '+n);
  await page.click('[data-focus="TR"]');
  for(const n of ['117,063','83,063','34,000'])if(!(await page.locator('.headline-stats').innerText()).includes(n))throw Error('Treasury mismatch '+n);
  await page.click('.agency-link');if(!(await page.locator('.drawer').innerText()).includes('Internal Revenue Service'))throw Error('Subagency detail absent');await page.click('#close');
  await page.click('[data-focus="all"]');await page.click('#exclude');if(!(await page.locator('.headline-stats').innerText()).includes('185,816'))throw Error('Nondefense total mismatch');
  await page.selectOption('#end','202608');if(!(await page.locator('.headline-stats').innerText()).includes('189,353'))throw Error('August comparison mismatch');
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Page overflow');if(errors.length)throw Error(errors.join('\n'));
  console.log(JSON.stringify({width:viewport.width,workforce:true,agencyDetail:true,scopeControls:true,noOverflow:true}));await page.close();
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
