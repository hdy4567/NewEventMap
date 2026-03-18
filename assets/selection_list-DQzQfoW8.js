import{s as m,a as d,e as h,b as u,c as r,d as p}from"./index-CfsKxgeF.js";class f{constructor(){this.container=null,this.initUI()}initUI(){const e=document.getElementById("selection-list-panel");e&&e.remove(),this.container=document.createElement("div"),this.container.id="selection-list-panel",this.container.className="glass selection-list-panel",this.container.innerHTML=`
            <div class="selection-list-header">
                <div class="header-left">
                    <input type="checkbox" id="panel-select-all" title="Select All" checked>
                    <span>SELECTED (<span id="panel-count">0</span>)</span>
                </div>
                <button class="close-panel-btn">✕</button>
            </div>
            <div id="selection-items-cont" class="selection-items-cont no-scrollbar">
                <p class="empty-msg">지도를 Alt+드래그하여 선택하세요.</p>
            </div>
            <div class="selection-list-footer">
                <div class="process-box">
                    <input type="text" id="panel-batch-tag" placeholder="#태그 추가...">
                    <button id="panel-batch-btn" class="btn-mini">적용</button>
                </div>
                <div class="footer-btns">
                    <button id="batch-copy-btn" class="btn-action">복사</button>
                    <button id="batch-sync-btn" class="btn-action primary">AI 전송</button>
                </div>
            </div>
        `,document.body.appendChild(this.container),this.setupHandlers()}setupHandlers(){const e=this.container.querySelector(".close-panel-btn");e&&(e.onclick=()=>this.hide());const t=document.getElementById("panel-select-all");t&&(t.onchange=n=>{const a=n.target.checked;this.container.querySelectorAll(".card-check").forEach(l=>{l.checked=a,l.closest(".selection-item-card").classList.toggle("selected",a)})});const c=document.getElementById("batch-sync-btn");c&&(c.onclick=()=>{const n=this.getSelectedPanelIds();n.length>0?m(n):d("처리할 항목을 선택해 주세요.","info")});const s=document.getElementById("batch-copy-btn");s&&(s.onclick=()=>{const n=this.getSelectedPanelIds();if(n.length===0)return d("복사할 항목을 선택하세요.","info");const a=n.map(l=>{const o=h.find(g=>String(g.id)===String(l));return o?`📌 [${o.title}]
📍 ${o.region}
🏷️ ${o.tags.join(", ")}`:""}).join(`
---
`);navigator.clipboard.writeText(a),d(`${n.length}개의 데이터가 클립보드로 복사됨`,"success")});const i=document.getElementById("panel-batch-btn");i&&(i.onclick=async()=>{const n=document.getElementById("panel-batch-tag"),a=n?.value.trim();if(!a)return;const l=this.getSelectedPanelIds();if(l.length===0)return d("태그를 적용할 항목을 선택하세요.","info");const{count:o,formatted:g}=await u(l,a);o>0&&(this.update(),n&&(n.value=""),d(`${o}개 항목에 '${g}' 태그 적용 및 서버 동기화 완료`,"success"))})}getSelectedPanelIds(){return Array.from(this.container.querySelectorAll(".card-check:checked")).map(e=>e.closest(".selection-item-card").dataset.id)}update(){const e=document.getElementById("selection-items-cont"),t=document.getElementById("panel-count");r.selectedIds.size>0?(this.show(),t&&(t.innerText=r.selectedIds.size),e&&(e.innerHTML="",r.selectedIds.forEach(c=>{const s=h.find(i=>String(i.id)===String(c));s&&e.appendChild(this.createCard(s))}))):this.hide()}createCard(e){const t=document.createElement("div");return t.className="selection-item-card selected",t.dataset.id=e.id,t.draggable=!0,t.innerHTML=`
            <span class="card-drag-handle">⋮⋮</span>
            <input type="checkbox" class="card-check" checked>
            <img src="${e.imageUrl}" class="item-thumb">
            <div class="item-info">
                <div class="item-title">${e.title}</div>
                <div class="item-tags">${e.tags.slice(0,3).join(" ")}</div>
            </div>
        `,t.onclick=c=>{if(c.target.classList.contains("card-check")){t.classList.toggle("selected",c.target.checked);return}p(e),r.map.flyTo([e.lat,e.lng],15)},t.addEventListener("dragstart",()=>t.classList.add("dragging")),t.addEventListener("dragend",()=>t.classList.remove("dragging")),t.addEventListener("dragover",c=>{c.preventDefault();const s=document.querySelector(".dragging");if(!s||s===t)return;const i=document.getElementById("selection-items-cont"),n=this.getDragAfterElement(i,c.clientY);n==null?i.appendChild(s):i.insertBefore(s,n)}),t}getDragAfterElement(e,t){return[...e.querySelectorAll(".selection-item-card:not(.dragging)")].reduce((s,i)=>{const n=i.getBoundingClientRect(),a=t-n.top-n.height/2;return a<0&&a>s.offset?{offset:a,element:i}:s},{offset:Number.NEGATIVE_INFINITY}).element}show(){this.container&&this.container.classList.add("active")}hide(){this.container&&this.container.classList.remove("active")}}const y=new f;export{y as selectionList};
