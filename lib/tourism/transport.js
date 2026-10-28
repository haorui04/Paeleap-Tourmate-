import destinations from '../../data/travel-destinations.json' with {type:'json'};
import routes from '../../data/travel-transport.json' with {type:'json'};
import {normalizeQuestion} from './faq-matching.js';
export function mentionedChinaCities(message){
 const n=normalizeQuestion(message);
 return destinations.flatMap(d=>{
 const hits=d.city_aliases.map(a=>{const x=normalizeQuestion(a);const index=/\p{Script=Han}/u.test(x)?n.indexOf(x):(' '+n+' ').indexOf(' '+x+' ');return index;}).filter(i=>i>=0);
 return hits.length?[{id:d.city_aliases[2],en:d.name_en,zh:d.name_zh,index:Math.min(...hits)}]:[];
 }).sort((a,b)=>a.index-b.index);
}
export function isIntercityTransport(message){
 return mentionedChinaCities(message).length>=2&&/\b(?:from|to|between|travel|get|transport|train|rail|hsr|flight|fly|long|hours|route)\b|从|從|到|去|之间|之間|高铁|高鐵|火车|火車|飞机|飛機|交通|多久/i.test(message) || /\b(?:travel|get|go|train|rail|flight|fly|transport)\b.{0,30}\bfrom\b.{1,60}\bto\b|从.{1,20}到.{1,20}(?:怎么|如何|交通|多久)/i.test(message);
}
export function transportReferences(message){
 if(!isIntercityTransport(message))return [];
 const cities=mentionedChinaCities(message);
 if(cities.length<2)return [];
 const route=routes.find(r=>r.cities[0]===cities[0].id&&r.cities[1]===cities[1].id);
 if(!route)return [];
 return [{id:route.id,category:'intercity_transport_estimates',question_en:'Transport from '+cities[0].en+' to '+cities[1].en,question_zh:cities[0].zh+'到'+cities[1].zh+'的交通',
 answer_en:'Approximate reference journey times from '+cities[0].en+' to '+cities[1].en+': '+route.options.map(o=>o[0]+': '+o[2]).join('; ')+'. These are dated planning estimates, not live schedules or guaranteed availability. Train times are station-to-station; flight time excludes airport access, check-in and waiting. Confirm the specific service and stations. If a mode is absent here, its duration has not been verified.',
 answer_zh:cities[0].zh+'到'+cities[1].zh+'的参考行程用时：'+route.options.map(o=>o[1]+'：'+o[3]).join('；')+'。以上为近似规划参考，并非实时班次或可订保证。火车为站到站时间，飞行时间不含机场接驳、值机及候机。请核实具体服务及车站；未列出的方式暂无已核实用时。',
 aliases:[],sources:[{name:'Travel China Guide: dated route reference',url:route.url},...(route.flight_source?[{name:'Travel China Guide: flight comparison',url:route.flight_source}]:[])],reviewed_on:route.reviewed_on}];
}
