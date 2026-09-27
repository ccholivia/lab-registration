const slots = [
  {id:'monday1',label:'Slot 1',day:'Monday',time:'8:00 AM – 10:00 AM',base:14},
  {id:'monday2',label:'Slot 2',day:'Monday',time:'10:00 AM – 12:00 PM',base:28},
  {id:'monday3',label:'Slot 3',day:'Monday',time:'12:00 PM – 2:00 PM',base:37},
  {id:'monday4',label:'Slot 4',day:'Monday',time:'2:00 PM – 4:00 PM',base:25},
  {id:'online',label:'Online lab',day:'Tuesday',time:'7:30 PM – 9:30 PM',base:0}
];
const $ = id => document.getElementById(id);
let counts = {}, ready = false, chosen = '', busy = false;
function notice(type,text) { $('message').replaceChildren(); if(!text)return; const el=document.createElement('p');el.className='message '+type;el.setAttribute('role',type==='error'?'alert':'status');el.textContent=text;$('message').append(el) }
function render() {
  for (const group of ['physical','online']) $(group).replaceChildren();
  for(const slot of slots) {
    const occupied=slot.base+(counts[slot.id]||0), remaining=40-occupied, full=slot.id!=='online'&&remaining<=0;
    const button=document.createElement('button');button.type='button';button.className='slot '+(chosen===slot.id?'selected':'');button.disabled=!ready||full;button.setAttribute('aria-pressed',chosen===slot.id?'true':'false');
    const radio=document.createElement('span');radio.className='radio';button.append(radio);
    const text=document.createElement('span');text.className='slottext';const title=document.createElement('strong');title.textContent=slot.id==='online'?slot.time:`${slot.label} · ${slot.time}`;text.append(title);
    const detail=document.createElement('small');detail.textContent=slot.id==='online'?`Online lab · ${counts.online||0} registered`:`${slot.day} · ${occupied}/40 occupied`;text.append(detail);
    if(slot.id!=='online'){const meter=document.createElement('span');meter.className='meter';const fill=document.createElement('span');fill.style.width=`${Math.min(100,occupied/40*100)}%`;meter.append(fill);text.append(meter)}button.append(text);
    const status=document.createElement('span');status.className='availability '+(full?'full':remaining<=5?'low':'');status.textContent=!ready?'Checking…':slot.id==='online'?'Unlimited':full?'Full':`${remaining} left`;button.append(status);
    button.addEventListener('click',()=>{chosen=slot.id;$('labChoice').value=`${slot.label} · ${slot.time}`;render()});$(slot.id==='online'?'online':'physical').append(button);
  }
  $('submit').disabled=!ready||busy;
}
async function refresh(showError=true){try{const response=await fetch('/api/slots',{cache:'no-store'});if(!response.ok)throw new Error();const data=await response.json();counts=data.counts;ready=true;if(chosen&&chosen!=='online'&&40-slots.find(x=>x.id===chosen).base-(counts[chosen]||0)<=0){chosen='';$('labChoice').value=''}render()}catch{ready=false;render();if(showError)notice('error','Availability is temporarily unavailable. Please try again.')}}
$('refresh').addEventListener('click',()=>refresh());
$('registration').addEventListener('submit',async event=>{event.preventDefault();if(!chosen)return notice('error','Please choose a lab slot.');busy=true;render();notice('','');const form=event.currentTarget;try{const response=await fetch('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...Object.fromEntries(new FormData(form)),slot:chosen})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Registration failed.');notice('success','Registration confirmed. Your lab place has been saved.');form.reset();chosen='';await refresh(false)}catch(cause){notice('error',cause.message||'Please try again.');await refresh(false)}finally{busy=false;render()}});
refresh();setInterval(()=>refresh(false),15000);
