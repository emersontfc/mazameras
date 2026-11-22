import {chapters} from './book-chapters';
export type EditorialPage={key:string;title:string;body:string;category:string;status:string};
export type BookContribution={id:string;userId:string;author:string;chapter:string;question:string;answer:string};
export type BookPhoto={id:string;userId:string;question:string;caption:string;people:string};
export type Leaf={id:string;kind:'cover'|'title'|'contents'|'divider'|'text'|'photo';title:string;part?:string;body?:string;status?:string;photo?:BookPhoto;source?:boolean};
// Conservative text budgets keep long responses readable without clipping them.
export function paginate(body:string,budget=1050):string[]{
 const blocks=body.trim().split(/\n\s*\n/).filter(Boolean);const pages:string[]=[];let current='';
 for(const block of blocks){const words=block.split(/\s+/);if(block.length>budget){for(const word of words){if(current.length+word.length+1>budget&&current){pages.push(current);current='';}current+=(current?' ':'')+word;}current+='\n\n';}else{if(current.length+block.length+2>budget&&current){pages.push(current.trim());current='';}current+=(current?'\n\n':'')+block;}}
 if(current.trim())pages.push(current.trim());return pages;
}
export function composeBook(pages:EditorialPage[],contributions:BookContribution[],photos:BookPhoto[]):Leaf[]{
 const leaves:Leaf[]=[{id:'cover',kind:'cover',title:'A Vida dum Estudante de Medicina'},{id:'title',kind:'title',title:'A Vida dum Estudante de Medicina'},{id:'contents',kind:'contents',title:'Índice'}];
 const add=(page:EditorialPage,part:string,source=false)=>{paginate(page.body).forEach((body,i)=>leaves.push({id:page.key+':'+i,kind:'text',title:page.title,part,body,status:page.status,source}));};
 for(const page of pages.filter(p=>p.category==='frontmatter'&&p.body.trim()).sort((a,b)=>a.key.localeCompare(b.key,'pt')))add(page,'PÁGINAS DE ABERTURA');
 leaves.push({id:'part-1',kind:'divider',title:'A nossa história',part:'PRIMEIRA PARTE'});
 for(const chapter of chapters.filter(c=>c.id!=='dedicatorias')){
 const selected=pages.find(p=>p.key==='collective:'+chapter.id&&p.body.trim());
 const items=contributions.filter(c=>c.chapter===chapter.title).sort((a,b)=>chapter.questions.indexOf(a.question)-chapter.questions.indexOf(b.question)||a.author.localeCompare(b.author,'pt')||a.id.localeCompare(b.id));
 if(!selected&&!items.length)continue;
 leaves.push({id:'chapter:'+chapter.id,kind:'divider',title:chapter.title,part:'CAPÍTULO '+chapter.number,body:chapter.kicker});
 if(selected)add(selected,'A NOSSA HISTÓRIA');else for(const item of items)add({key:'source:'+item.id,title:chapter.title,category:'collective',status:'draft',body:'### '+item.question+'\n\n'+item.answer.trim()+'\n\n— '+item.author},'A NOSSA HISTÓRIA',true);
 for(const photo of photos.filter(p=>items.some(c=>c.userId===p.userId&&c.question===p.question)))leaves.push({id:'photo:'+photo.id,kind:'photo',title:chapter.title,photo,part:'MEMÓRIAS EM IMAGENS'});
 }
 for(const [category,title,part] of [['individual','As nossas vozes','SEGUNDA PARTE'],['dedication','Cartas para guardar','TERCEIRA PARTE']]){
 const selected=pages.filter(p=>p.category===category&&p.body.trim()).sort((a,b)=>a.title.localeCompare(b.title,'pt')||a.key.localeCompare(b.key));
 const letters=category==='dedication'?contributions.filter(c=>c.chapter==='Cartas para guardar'&&!selected.some(p=>p.key==='dedication:'+c.userId)).sort((a,b)=>a.author.localeCompare(b.author,'pt')||a.id.localeCompare(b.id)):[];
 if(!selected.length&&!letters.length)continue;
 leaves.push({id:'part-'+category,kind:'divider',title,part});for(const page of selected)add(page,title.toUpperCase());for(const item of letters)add({key:'source:'+item.id,title:item.author,category,status:'draft',body:'### '+item.question+'\n\n'+item.answer},title.toUpperCase(),true);
 }
 const count=leaves.filter(p=>p.kind==='divider'||(p.kind==='text'&&p.id.endsWith(':0')&&p.part!=='A NOSSA HISTÓRIA')).length;
 const indexPages=Math.max(1,Math.ceil(count/16));
 leaves[2].body='0';
 for(let i=1;i<indexPages;i++)leaves.splice(2+i,0,{id:'contents:'+i,kind:'contents',title:'Índice',body:String(i*16)});
 return leaves;
}
