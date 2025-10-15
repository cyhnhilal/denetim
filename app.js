
(() => {
  const USERS = [
    {name:"SERKAN TATU", role:"denetmen"},
    {name:"HİLAL CEYHAN", role:"yönetici"},
    {name:"ÇAĞLA MAYDA", role:"denetmen"},
    {name:"YASİN ÖZKILIÇ", role:"denetmen"},
    {name:"HATİCE TEKİNER", role:"denetmen"},
  ];

  const WEIGHTS = {"İSG":1.6,"KASA":1.4,"TEKNİK":1.4,"UZAK İZLEME":1.3,"DEPO":1.1,"ETİKET":1.1,"GÖRSEL":1.0,"İK":1.0};

  const SCHEMA = [
    { id:1, cat:"KASA",   q:"Kasa devir yapılıyor mu?", min:-3, max:0, kritik:true },
    { id:2, cat:"KASA",   q:"Gün sonunda kasa nakit/kart mutabakatı var mı?", min:-4, max:0, kritik:true },
    { id:3, cat:"ETİKET", q:"Raf etiketi – kasa fiyat uyumlu mu?", min:-3, max:0, kritik:false },
    { id:4, cat:"İSG",    q:"Yangın tüpleri tarih/erişim uygun mu?", min:-4, max:0, kritik:true },
  ];

  const $ = sel => document.querySelector(sel);
  const el = (t,a={},ch=[]) => {
    const n = document.createElement(t);
    for (const k in a) {
      if (k==="class") n.className=a[k];
      else if (k==="html") n.innerHTML=a[k];
      else if (k.startsWith("on")) n.addEventListener(k.slice(2).toLowerCase(), a[k]);
      else n.setAttribute(k,a[k]);
    }
    ch.forEach(c => n.appendChild(typeof c==="string"?document.createTextNode(c):c));
    return n;
  };

  // Supabase client
  let supabase = null;
  function initSupabase(){
    if (!window.APP_CONFIG) return alert("config.js eksik veya hatalı.");
    const { createClient } = window.supabase;
    supabase = createClient(window.APP_CONFIG.SUPABASE_URL, window.APP_CONFIG.SUPABASE_ANON_KEY);
  }

  const app = $("#app");

  function loginScreen(){
    app.innerHTML="";
    const select = el("select",{}, USERS.map(u => el("option",{value:u.name},[u.name])));
    const pass   = el("input",{type:"password",placeholder:"Şifre (1)",value:""});
    const btn    = el("button",{class:"btn pri", onClick:doLogin},["Giriş Yap"]);
    app.appendChild(el("div",{class:"card",},[
      el("h1",{},["Denetim Test – Giriş"]),
      el("div",{class:"mut"},["Kullanıcı seçin ve şifreyi girin. (Geçici şifre: 1)"]),
      el("div",{class:"row"},[select, pass]),
      el("div",{},[btn])
    ]));
    function doLogin(){
      if (pass.value!=="1") { alert("Şifre hatalı."); return; }
      const user = USERS.find(u=>u.name===select.value);
      localStorage.setItem("user", JSON.stringify(user));
      renderApp();
    }
  }

  async function loadStores(){
    const { data, error } = await supabase.from("stores").select("code,name").order("code");
    if (error) throw error;
    return data;
  }
  async function listAudits(){
    const { data, error } = await supabase.from("audits")
      .select("id,date,store_code,manager,mus,critical_count,photo_count,note,created_at")
      .order("created_at",{ascending:false});
    if (error) throw error;
    return data;
  }
  async function insertAudit(p){
    const { error } = await supabase.from("audits").insert(p);
    if (error) throw error;
  }

  function topbar(title){
    return el("div",{class:"row", style:"grid-template-columns:1fr auto;align-items:center;margin-bottom:12px;border-bottom:1px solid #e5e7eb;padding-bottom:8px"},[
      el("div",{},[el("h1",{},[title]), el("div",{class:"mut"},["Supabase bağlı – canlı kayıt"])]),
      el("div",{},[
        el("button",{class:"btn",onClick:()=>renderForm()},["Form"])," ",
        el("button",{class:"btn",onClick:()=>renderAdmin()},["Yönetici"])," ",
        el("button",{class:"btn",onClick:()=>{localStorage.removeItem('user'); loginScreen();}},["Çıkış"])
      ])
    ]);
  }

  async function renderForm(){
    if (!localStorage.getItem("user")) return loginScreen();
    app.innerHTML="";
    app.appendChild(topbar("Denetim Formu"));

    let stores=[];
    try{ stores = await loadStores(); }
    catch(e){ alert("Mağaza listesi hatası: "+e.message+"\n\nEğer 401 görüyorsan geçici test policy'lerini ekle."); }

    const storeSel = el("select",{}, stores.map(s=>el("option",{value:s.code},[s.code+" – "+s.name])));
    const date = el("input",{type:"date"}); date.valueAsNumber=Date.now();
    const manager = el("input",{placeholder:"Bölge Müdürü (seç/yaz)"});
    const note = el("input",{placeholder:"Not (ops.)"});

    const answers = {};
    const scoreBox = el("div",{class:"card"},[
      el("div",{class:"mut"},["Skor"]),
      el("div",{class:"score",id:"score"},["100"]),
      el("div",{class:"mut",id:"crit"},["Kritik bulgu yok"]),
    ]);

    function calc(){
      let s=100; const crits=[];
      SCHEMA.forEach(it=>{
        if (answers[it.id]==="Hayır"){
          const w = it.kritik ? (WEIGHTS[it.cat]||1.5) : (WEIGHTS[it.cat]||1);
          s += Math.round(it.min * w);
          if (it.kritik) crits.push(it.cat+" – "+it.q);
        }
      });
      scoreBox.querySelector("#score").textContent = s;
      scoreBox.querySelector("#crit").textContent = crits.length?("Kritik: "+crits.join(" | ")):"Kritik bulgu yok";
    }

    const qArea = el("div",{});
    SCHEMA.forEach(it=>{
      const mid = el("div",{});
      ["Evet","Hayır","N/A"].forEach(v=>{
        mid.appendChild(el("button",{class:"btn", onClick:()=>{answers[it.id]=v; calc(); highlight(mid,v);}},[v]));
      });
      const row = el("div",{class:"q"},[
        el("div",{html:`<div style="font-weight:600">${it.cat} – ${it.q}</div>
          <div class="mut" style="margin-top:6px">Puan: ${it.min}…${it.max} ${it.kritik? " • KRİTİK":""}</div>`}),
        mid,
        el("div",{})
      ]);
      qArea.appendChild(row);
    });
    function highlight(container,val){
      [...container.children].forEach(b=>{
        b.style.background = (b.textContent===val) ? "#0ea5e9" : "#fff";
        b.style.color      = (b.textContent===val) ? "#fff" : "#000";
      });
    }

    const saveBtn = el("button",{class:"btn pri", onClick:async()=>{
      try{
        const mus = parseInt(scoreBox.querySelector("#score").textContent,10);
        const crit = scoreBox.querySelector("#crit").textContent.startsWith("Kritik") ? scoreBox.querySelector("#crit").textContent.split("|").length : 0;
        await insertAudit({
          store_code: storeSel.value,
          date: date.value,
          manager: manager.value || null,
          mus: mus,
          critical_count: crit,
          photo_count: 0,
          note: note.value || null,
          answers: answers
        });
        alert("Kaydedildi ✅");
      }catch(err){
        alert("Kayıt hatası: "+err.message+"\n\nÇözüm: Eğer 'RLS/401' ise test amaçlı policy'leri ekleyelim; sonra gerçek Auth'a geçeriz.");
      }
    }},["Kaydet"]);

    const left = el("div",{class:"card"},[
      el("div",{class:"mut"},["Mağaza"]), storeSel,
      el("div",{class:"mut"},["Tarih"]), date,
      el("div",{class:"mut"},["Bölge Müdürü"]), manager,
      el("div",{class:"mut"},["Not"]), note,
      saveBtn
    ]);

    app.appendChild(el("div",{class:"row row-2"},[left, scoreBox]));
    app.appendChild(el("div",{class:"card", style:"margin-top:12px"},[qArea]));
  }

  async function renderAdmin(){
    if (!localStorage.getItem("user")) return loginScreen();
    app.innerHTML="";
    app.appendChild(topbar("Yönetici Paneli"));
    const wrap = el("div",{class:"card"});
    const tbl = el("table",{style:"width:100%;border-collapse:collapse"});
    tbl.innerHTML = "<thead><tr><th>Tarih</th><th>Mağaza</th><th>Müdür</th><th>MUS</th><th>Kritik</th><th>Foto</th><th>Not</th></tr></thead>";
    const tb = el("tbody",{});
    tbl.appendChild(tb);
    wrap.appendChild(tbl);
    app.appendChild(wrap);
    try{
      const rows = await listAudits();
      tb.innerHTML="";
      rows.forEach(r=>{
        const tr = el("tr",{});
        tr.innerHTML = `<td>${r.date||""}</td><td>${r.store_code||""}</td><td>${r.manager||"-"}</td>
                        <td><b>${r.mus||""}</b></td><td>${r.critical_count||0}</td><td>${r.photo_count||0}</td><td>${r.note||"-"}</td>`;
        tb.appendChild(tr);
      });
    }catch(err){
      tb.innerHTML = `<tr><td colspan="7" style="color:#b91c1c">Listeleme hatası: ${err.message}</td></tr>`;
    }
  }

  function start(){
    initSupabase();
    if (localStorage.getItem("user")) renderForm();
    else loginScreen();
  }
  start();
})();
