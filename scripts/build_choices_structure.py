#!/usr/bin/env python3
"""Entitlements, interest and funding choices from the same SF 133 data the funding view uses.

Writes the `choices` block of data/budget-structure.json. Shares use net budget authority
(what the budget provided); the reductions and increases lists use obligations (what agencies
committed), matching the Funding Priorities view. Exclusions come from data/entitlement-accounts.json.
"""
import json,pathlib
from collections import defaultdict
ROOT=pathlib.Path(__file__).resolve().parents[1]
a=json.loads((ROOT/'data/authority-comparison.json').read_text());e=json.loads((ROOT/'data/entitlement-accounts.json').read_text())
review=json.loads((ROOT/'data/topic-review.json').read_text());reviewed={c['treasury_account']:c for c in review['reviews']}
labels={'750':'Law enforcement & justice'}
groups={x['treasury_account']:g['name'] for g in e['groups'] for x in g['accounts']}
def m(r,y,k):return (r['years'].get(y,{}).get('metrics') or {}).get(k)
cat=defaultdict(lambda:[0.0,0.0]);topic=defaultdict(lambda:[0.0,0.0])
for r in a['records']:
    if not r['credit_scope'].startswith('NON-'):continue
    ta=r['treasury_account']
    if r['topic'] in e['excluded_topics']:c='Net interest on the debt'
    elif ta in groups:c='Self-financed funds' if groups[ta].startswith('Self-financed') else 'Entitlement benefit programs'
    else:c='Funding choices'
    for i,y in enumerate(('2024','2026')):
        v=m(r,y,'obligations')
        if v is not None:cat[c][i]+=v
        if c=='Funding choices':
            o=m(r,y,'obligations')
            if o is not None:
                t=r['topic'];code=r['topic_code']
                if ta in reviewed:t=reviewed[ta]['topic'];code=reviewed[ta]['topic_code']
                topic[labels.get(code,t)][i]+=o
order=['Entitlement benefit programs','Net interest on the debt','Self-financed funds','Funding choices']
total=[sum(v[0] for v in cat.values()),sum(v[1] for v in cat.values())]
categories=[{'name':n,'a':cat[n][0],'b':cat[n][1],'share_a':cat[n][0]/total[0]*100,'share_b':cat[n][1]/total[1]*100} for n in order if n in cat]
changes=sorted(((k,v[0],v[1],v[1]-v[0]) for k,v in topic.items() if not k.startswith(('Mixed','Unclassified'))),key=lambda x:x[3])
by_topic=sorted(({'topic':k,'a':x,'b':y,'amount':d} for k,x,y,d in changes),key=lambda t:-t['b'])
cuts=[{'topic':k,'a':x,'b':y,'amount':d} for k,x,y,d in changes if d<0][:6]
adds=[{'topic':k,'a':x,'b':y,'amount':d} for k,x,y,d in reversed(changes) if d>0][:6]
p=ROOT/'data/budget-structure.json';b=json.loads(p.read_text())
b['choices']={'basis':'OMB SF 133 year-end reports, FY2024 and FY2026, all non-financing accounts. Shares, reductions and increases all use obligations (line 2190): funds committed during the year. Reductions and increases are within funding choices, by topic, as in the Funding Priorities view. Exclusions: data/entitlement-accounts.json.','total':{'a':total[0],'b':total[1]},'categories':categories,'choices_obligations':{'a':sum(v[0] for v in topic.values()),'b':sum(v[1] for v in topic.values())},'cuts':cuts,'adds':adds,'by_topic':by_topic}
p.write_text(json.dumps(b,indent=1)+'\n')
for c in categories:print(f"{c['name']:30} ${c['a']/1e12:5.2f}T -> ${c['b']/1e12:5.2f}T   {c['share_a']:4.0f}% -> {c['share_b']:4.0f}%")
print(f"{'TOTAL':30} ${total[0]/1e12:5.2f}T -> ${total[1]/1e12:5.2f}T");co=b['choices']['choices_obligations'];print(f"choices obligations ${co['a']/1e12:.2f}T -> ${co['b']/1e12:.2f}T ({(co['b']-co['a'])/1e9:+,.0f}B)")
print('cuts:',[(c['topic'][:28],round(c['amount']/1e9,1)) for c in cuts]);print('adds:',[(c['topic'][:28],round(c['amount']/1e9,1)) for c in adds])
