(()=>{'use strict';
const search=document.querySelector('#search'),category=document.querySelector('#category'),status=document.querySelector('#status'),rows=[...document.querySelectorAll('.entry')],groups=[...document.querySelectorAll('.link-group')],count=document.querySelector('#result-count'),empty=document.querySelector('#empty'),areaNote=document.querySelector('#active-area'),chips=[...document.querySelectorAll('[data-area]')];
const areas={"tools":["Apps, AI & learning tools","AI assistants","Marketing & business"],"learn":["Arcade games","Football games & awareness","Apps, AI & learning tools"],"books":["Books & reading"],"creative":["Art, media & character"],"concepts":["Invention concepts"],"research":["Research & equations","Individual equations","Research publications","Research tools & maps"]};
let area=new URLSearchParams(location.search).get('area')||'';if(!Object.prototype.hasOwnProperty.call(areas,area))area='';
function filter(){if(!search||!category)return;
const q=search.value.trim().toLocaleLowerCase(),c=category.value,s=status?.value||'';let n=0,l=0,u=0;
for(const row of rows){const show=(!q||(row.textContent+' '+(row.dataset.category||'')).toLocaleLowerCase().includes(q))&&(!c||row.dataset.category===c)&&(!area||(areas[area].includes(row.dataset.category)&&(area!=='learn'||row.dataset.category!=='Apps, AI & learning tools'||/bluxabi|brain-training|learning|skills/i.test(row.textContent))))&&(!s||row.dataset.status===s);row.hidden=!show;if(show){n++;row.dataset.status==='linked'?l++:u++}}
for(const group of groups){const visible=[...group.querySelectorAll('.entry')].filter(row=>!row.hidden);group.hidden=!visible.length;group.open=!!(q||c||s||area);const badge=group.querySelector('summary span');if(badge)badge.textContent=visible.length}
if(count)count.textContent=n+' of '+rows.length+' records · '+l+' linked · '+u+' unavailable';if(empty)empty.hidden=n!==0;
for(const chip of chips){if(chip.dataset.area===area)chip.setAttribute('aria-current','true');else chip.removeAttribute('aria-current')}
if(areaNote){areaNote.hidden=!area;areaNote.textContent=area?'Topic: '+(chips.find(x=>x.dataset.area===area)?.textContent||area):''}}
if(search&&category){search.addEventListener('input',filter);category.addEventListener('change',()=>{area='';history.replaceState(null,'',location.pathname+'#directory');filter()});status?.addEventListener('change',filter);document.querySelector('#reset')?.addEventListener('click',()=>{area='';search.value='';category.value='';if(status)status.value='';filter();history.replaceState(null,'',location.pathname+'#directory');search.focus()});filter()}
document.querySelectorAll('video').forEach(video=>video.addEventListener('play',()=>document.querySelectorAll('video').forEach(other=>{if(other!==video)other.pause()})));
document.querySelectorAll('.mobile-nav nav a').forEach(link=>link.addEventListener('click',()=>{const menu=document.querySelector('.mobile-nav');if(menu)menu.open=false}));
const cameraTitle = [...document.querySelectorAll('#android-apps .app-showcase-card h3')]
    .find(heading => heading.textContent.trim() === 'C.CAM ULTRA');
if (cameraTitle) {
    const cameraCard = cameraTitle.closest('.app-showcase-card');
    const productLink = document.createElement('a');
    productLink.href = '/aurelius-cam/';
    productLink.setAttribute('aria-label', 'AURELIUS CAM Ultra for Android');
    productLink.style.cssText = 'display:flex;flex:1;flex-direction:column;color:inherit;text-decoration:none';
    cameraTitle.textContent = 'AURELIUS CAM Ultra';
    const downloadLabel = document.createElement('span');
    downloadLabel.textContent = 'Download for Android';
    downloadLabel.style.cssText = 'display:inline-flex;align-items:center;min-height:44px;padding:0 16px;border-radius:8px;background:#65ccff;color:#08121b;font-weight:700';
    cameraCard.querySelector('.development-status').replaceWith(downloadLabel);
    productLink.append(...cameraCard.childNodes);
    cameraCard.append(productLink);

    const appsDescription = cameraCard.closest('#android-apps').querySelector('.section-head > p');
    if (appsDescription) appsDescription.textContent = 'Explore the camera preview and other Android tools in development.';
}
})();