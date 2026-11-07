const {chromium}=require('playwright');
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
for(const size of [{width:1440,height:1000},{width:390,height:844}]){
 const page=await browser.newPage({viewport:size});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url=process.argv[2]||'http://127.0.0.1:8000/';
 await page.goto(url);await page.waitForSelector('.bar-row',{timeout:30000});
 const top=await page.locator('.bar-row').count();if(top!==35)throw Error('Expected top 35, got '+top);
 await page.check('#show-all');const all=await page.locator('.bar-row').count();if(all<100)throw Error('Insufficient agency coverage '+all);
 await page.fill('#search','Treasury');if(await page.locator('.bar-row').count()!==1)throw Error('Search failed');
 await page.locator('.bar-row').click();if(!await page.locator('#detail').innerText().then(t=>t.includes('Treasury')))throw Error('Drilldown failed');
 await page.selectOption('#period','2024');if(!await page.locator('#chart-title').innerText().then(t=>t.includes('2024')))throw Error('Year filter failed');
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Horizontal overflow');
 if(errors.length)throw Error(errors.join('\n'));
 await page.screenshot({path:'/tmp/atlas-'+size.width+'.png',fullPage:true});
 console.log(JSON.stringify({url,width:size.width,top,all,search:true,drilldown:true,yearFilter:true,noOverflow:true,errors}));await page.close();
}
await browser.close();
})();
