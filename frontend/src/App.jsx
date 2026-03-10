import { useState, useEffect, useRef, useCallback } from "react";

// ─── API CONFIG ────────────────────────────────────────────────────────────────
// Ganti sesuai URL backend (atau set VITE_API_URL di .env)
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// Token store sederhana (module-level, tidak perlu Context)
let _access  = null;
let _refresh = null;
let _onSessionExpired = null;

function storeTokens(access, refresh) {
  _access  = access;
  _refresh = refresh;
  try { localStorage.setItem("dg_a", access); localStorage.setItem("dg_r", refresh); } catch {}
}
function clearTokens() {
  _access = null; _refresh = null;
  try { localStorage.removeItem("dg_a"); localStorage.removeItem("dg_r"); } catch {}
}
// Restore dari localStorage saat pertama kali load (tetap login walau browser ditutup)
try { _access = localStorage.getItem("dg_a"); _refresh = localStorage.getItem("dg_r"); } catch {}

async function api(method, path, body, extraToken) {
  const tok = extraToken || _access;
  const opts = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(tok && { Authorization: `Bearer ${tok}` }),
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  };
  let res = await fetch(`${API_BASE}${path}`, opts);

  // Auto-refresh jika 401
  if (res.status === 401 && _refresh) {
    try {
      const rRes = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: _refresh }),
      });
      if (rRes.ok) {
        const { data } = await rRes.json();
        storeTokens(data.accessToken, data.refreshToken);
        opts.headers.Authorization = `Bearer ${data.accessToken}`;
        res = await fetch(`${API_BASE}${path}`, opts);
      } else {
        clearTokens();
        if (_onSessionExpired) _onSessionExpired();
        throw new Error("Sesi berakhir, silakan login ulang.");
      }
    } catch (e) {
      if (e.message.includes("Sesi")) throw e;
      clearTokens();
      if (_onSessionExpired) _onSessionExpired();
      throw new Error("Sesi berakhir, silakan login ulang.");
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

async function apiForm(method, path, formData) {
  const opts = {
    method,
    headers: { ...(_access && { Authorization: `Bearer ${_access}` }) },
    body: formData,
  };
  let res = await fetch(`${API_BASE}${path}`, opts);
  // Auto-refresh jika 401 — sama seperti api()
  if (res.status === 401 && _refresh) {
    try {
      const rRes = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: _refresh }),
      });
      if (rRes.ok) {
        const { data } = await rRes.json();
        storeTokens(data.accessToken, data.refreshToken);
        opts.headers.Authorization = `Bearer ${data.accessToken}`;
        res = await fetch(`${API_BASE}${path}`, opts);
      } else {
        clearTokens();
        if (_onSessionExpired) _onSessionExpired();
        throw new Error("Sesi berakhir, silakan login ulang.");
      }
    } catch (e) {
      if (e.message.includes("Sesi")) throw e;
      clearTokens();
      if (_onSessionExpired) _onSessionExpired();
      throw new Error("Sesi berakhir, silakan login ulang.");
    }
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── DATA MAPPERS ──────────────────────────────────────────────────────────────
const mapBook = (b) => ({
  ...b,
  cover: [b.coverColor1 || "#6366f1", b.coverColor2 || "#8b5cf6"],
  coverImage: b.coverImage ? `${API_BASE.replace("/api","")}${b.coverImage}` : null,
  downloads: b.downloads || 0,
  rating: b.rating || 0,
});

const mapUser = (u) => ({
  ...u,
  avatar: u.avatar || "👤",
  fakultas: u.fakultas?.nama || (typeof u.fakultas === "string" ? u.fakultas : "-"),
  prodi:    u.prodi?.nama    || (typeof u.prodi    === "string" ? u.prodi    : "-"),
  angkatan: u.angkatan || "",
  tipe:     u.tipe    || "",
  joined:   u.joinedAt || u.joined || new Date().toISOString(),
});

const mapPeminjaman = (p) => ({
  ...p,
  expiryDate: p.tokenExpiry ? new Date(p.tokenExpiry) : null,
  book: p.book ? mapBook(p.book) : undefined,
  user: p.user ? mapUser(p.user) : undefined,
});

const parseSettings = (raw) => ({
  nama:         raw.nama_perpustakaan || "Perpustakaan UNISMU",
  email:        raw.email             || "perpus@unismu.ac.id",
  phone:        raw.phone             || "(022) 2641600",
  alamat:       raw.alamat            || "Jl. Raya Ciawi No.1, Purwakarta",
  website:      raw.website           || "https://perpus.unismu.ac.id",
  durasiPinjam: parseInt(raw.durasi_pinjam  || "14"),
  maxPinjam:    parseInt(raw.max_pinjam     || "3"),
  dendaPerHari: parseInt(raw.denda_per_hari || "1000"),
  tokenDurasi:  parseInt(raw.token_durasi   || "14"),
  maintenance:  raw.maintenance === "true",
  bannerAktif:  raw.banner_aktif === "true",
  bannerText:   raw.banner_text   || "Selamat datang di Perpustakaan Digital UNISMU 📚",
  bannerColor:  raw.banner_color  || "#6366f1",
  pengumuman:   raw.pengumuman    || "",
  verifikasiEmail: raw.verifikasi_email === "true",
  kategoriBuku: (() => {
    try { return JSON.parse(raw.kategori_buku || "[]"); } catch { return []; }
  })(),
});

const serializeSettings = (s) => ({
  nama_perpustakaan: s.nama,
  email:             s.email,
  phone:             s.phone,
  alamat:            s.alamat,
  website:           s.website || "",
  durasi_pinjam:     String(s.durasiPinjam),
  max_pinjam:        String(s.maxPinjam),
  denda_per_hari:    String(s.dendaPerHari),
  token_durasi:      String(s.tokenDurasi),
  maintenance:       String(s.maintenance),
  banner_aktif:      String(s.bannerAktif),
  banner_text:       s.bannerText,
  banner_color:      s.bannerColor,
  pengumuman:        s.pengumuman || "",
  verifikasi_email:  String(s.verifikasiEmail),
  kategori_buku:     JSON.stringify(s.kategoriBuku),
});

// ─── UTILITIES ─────────────────────────────────────────────────────────────────
function hashStr(s){let h=5381;for(let i=0;i<s.length;i++)h=((h<<5)+h)^s.charCodeAt(i);return Math.abs(h);}
function generateQRMatrix(data,size=25){let rng=hashStr(data);const nx=()=>{rng=(rng*1664525+1013904223)&0xffffffff;return(rng>>>0)/0xffffffff;};const m=[];for(let r=0;r<size;r++){m[r]=[];for(let c=0;c<size;c++){const tl=r<=6&&c<=6,tr=r<=6&&c>=size-7,bl=r>=size-7&&c<=6;if(tl||tr||bl){const lr=tl?r:tr?r:r-(size-7),lc=tl?c:tr?c-(size-7):c;m[r][c]=(lr===0||lr===6||lc===0||lc===6)?1:(lr>=2&&lr<=4&&lc>=2&&lc<=4)?1:0;}else if(r===7||c===7||r===size-8||c===size-8){m[r][c]=0;}else{m[r][c]=nx()>0.45?1:0;}}}return m;}
function QRCode({data,size=120,fg="#1e293b",bg="#fff"}){const m=generateQRMatrix(data,25),cell=size/25;return(<svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{display:"block"}}><rect width={size} height={size} fill={bg}/>{m.map((row,r)=>row.map((v,c)=>v?<rect key={`${r}-${c}`} x={c*cell} y={r*cell} width={cell} height={cell} fill={fg}/>:null))}<rect x={size/2-10} y={size/2-10} width={20} height={20} fill={bg} rx={2}/><text x={size/2} y={size/2+4} textAnchor="middle" fontSize={9} fill={fg} fontWeight="bold">U</text></svg>);}
function daysLeft(d){return Math.ceil((new Date(d)-new Date())/(864e5));}
function fmtDate(d){return new Date(d).toLocaleDateString("id-ID",{day:"2-digit",month:"long",year:"numeric"});}
function fmtShort(d){return new Date(d).toLocaleDateString("id-ID",{day:"2-digit",month:"2-digit",year:"numeric"});}

// ─── STATIC CONFIG ─────────────────────────────────────────────────────────────
const CATS_DEFAULT=["Semua","Sains & Teknologi","Hukum & Syariah","Ekonomi & Bisnis","Pendidikan","Agama & Filsafat","Kesehatan","Sosial & Politik","Bahasa & Sastra"];
const ROLE_CONFIG={
  pustakawan_universitas:{label:"Pustakawan Universitas",color:"#6366f1",bg:"linear-gradient(135deg,#6366f1,#8b5cf6)",icon:"🎓",cardBg:"linear-gradient(135deg,#1e1b4b,#3730a3)",tabs:["dashboard","koleksi","peminjaman","pengguna","laporan","pengaturan"]},
  pustakawan_fakultas:{label:"Pustakawan Fakultas",color:"#0ea5e9",bg:"linear-gradient(135deg,#0ea5e9,#6366f1)",icon:"🏛️",cardBg:"linear-gradient(135deg,#0c4a6e,#0369a1)",tabs:["dashboard","koleksi","peminjaman","pengguna","laporan"]},
  mahasiswa:{label:"Mahasiswa",color:"#3b82f6",bg:"linear-gradient(135deg,#3b82f6,#6366f1)",icon:"👨‍🎓",cardBg:"linear-gradient(135deg,#1e3a5f,#1d4ed8)",tabs:["beranda","koleksi","peminjaman-saya","bookmark","kartu-anggota","profil"]},
  umum:{label:"Anggota Umum",color:"#f59e0b",bg:"linear-gradient(135deg,#f59e0b,#ef4444)",icon:"👤",cardBg:"linear-gradient(135deg,#451a03,#b45309)",tabs:["beranda","koleksi","kartu-anggota","profil"]},
};
const TAB_LABELS={dashboard:"Dashboard",beranda:"Beranda",koleksi:"Koleksi Buku",peminjaman:"Peminjaman","peminjaman-saya":"Peminjaman Saya",pengguna:"Pengguna",laporan:"Laporan",pengaturan:"Pengaturan",bookmark:"Tersimpan","kartu-anggota":"Kartu Anggota",profil:"Profil"};
const TAB_ICONS={dashboard:"📊",beranda:"🏠",koleksi:"📚",peminjaman:"🔄","peminjaman-saya":"📋",pengguna:"👥",laporan:"📈",pengaturan:"⚙️",bookmark:"🔖","kartu-anggota":"🪪",profil:"👤"};
const IS={width:"100%",padding:"10px 14px",borderRadius:10,border:"1.5px solid #e2e8f0",fontSize:14,background:"#f8fafc",color:"#1e293b",fontFamily:"inherit",boxSizing:"border-box"};
const BADGE={"Best Seller":{bg:"#fef3c7",color:"#92400e",border:"#fde68a"},"Populer":{bg:"#fee2e2",color:"#991b1b",border:"#fecaca"},"Baru":{bg:"#dcfce7",color:"#14532d",border:"#bbf7d0"}};

// ─── SHARED MINI COMPONENTS ────────────────────────────────────────────────────
function Spinner(){return <div style={{display:"flex",justifyContent:"center",padding:40}}><div style={{width:32,height:32,border:"3px solid #e2e8f0",borderTop:"3px solid #6366f1",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>;}
function EmptyState({icon,msg,sub}){return(<div style={{textAlign:"center",padding:"60px 20px"}}><div style={{fontSize:60,marginBottom:16}}>{icon}</div><div style={{fontSize:18,fontWeight:600,color:"#374151",marginBottom:6}}>{msg}</div><div style={{fontSize:14,color:"#94a3b8"}}>{sub}</div></div>);}
function Card({title,sub,action,children}){return(<div style={{background:"#fff",borderRadius:16,padding:24,boxShadow:"0 2px 10px rgba(0,0,0,0.06)",border:"1px solid #f1f5f9",marginBottom:0}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}><div><h3 style={{fontWeight:700,fontSize:15,color:"#1e293b"}}>{title}</h3>{sub&&<p style={{fontSize:12,color:"#94a3b8",marginTop:3}}>{sub}</p>}</div>{action&&<div>{action}</div>}</div><div style={{display:"flex",flexDirection:"column",gap:12}}>{children}</div></div>);}
function Grid2({children}){return <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>{children}</div>;}
function Toggle({val,onChange}){return(<button onClick={()=>onChange(!val)} style={{width:48,height:26,borderRadius:13,border:"none",background:val?"#6366f1":"#e2e8f0",cursor:"pointer",position:"relative",transition:"background 0.2s",flexShrink:0}}><div style={{width:20,height:20,borderRadius:"50%",background:"#fff",position:"absolute",top:3,left:val?25:3,transition:"left 0.2s",boxShadow:"0 1px 4px rgba(0,0,0,0.2)"}}/></button>);}
const BtnStyle=(color)=>({padding:"10px 20px",borderRadius:10,border:"none",background:`linear-gradient(135deg,${color},${color}cc)`,color:"#fff",cursor:"pointer",fontWeight:600,fontSize:14,boxShadow:`0 4px 14px ${color}30`});
function SaveBtn({onClick}){return <button onClick={onClick} style={{...BtnStyle("#6366f1"),alignSelf:"flex-start",padding:"11px 24px"}}>💾 Simpan Perubahan</button>;}
function FF({label,children}){return(<div><label style={{fontSize:12,fontWeight:600,color:"#374151",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.05em"}}>{label}</label>{children}</div>);}
function Chip({color,children}){return <span style={{padding:"2px 9px",borderRadius:20,fontSize:11,fontWeight:600,background:`${color}15`,color,border:`1px solid ${color}30`}}>{children}</span>;}
function ModalWrap({title,onClose,children,maxWidth=600}){return(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(4px)"}} onClick={e=>e.target===e.currentTarget&&onClose()}><div style={{background:"#fff",borderRadius:20,maxWidth,width:"100%",maxHeight:"90vh",overflow:"auto",boxShadow:"0 30px 80px rgba(0,0,0,0.3)"}}><div style={{padding:"20px 28px",borderBottom:"1px solid #f1f5f9",display:"flex",justifyContent:"space-between",alignItems:"center"}}><h3 style={{fontWeight:700,fontSize:16,color:"#1e293b"}}>{title}</h3><button onClick={onClose} style={{width:32,height:32,borderRadius:8,border:"1.5px solid #e2e8f0",background:"#f8fafc",cursor:"pointer",fontSize:16,color:"#64748b"}}>✕</button></div><div style={{padding:28}}>{children}</div></div></div>);}

// ─── PASSWORD INPUT WITH SHOW/HIDE TOGGLE ────────────────────────────────────
function PasswordInput({value,onChange,placeholder="Password",onKeyDown}){
  const [show,setShow]=useState(false);
  return(
    <div style={{position:"relative"}}>
      <input type={show?"text":"password"} value={value} onChange={onChange} onKeyDown={onKeyDown}
        placeholder={placeholder} style={{...IS,paddingRight:44}}/>
      <button type="button" onClick={()=>setShow(s=>!s)}
        style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:16,color:"#94a3b8",padding:0,lineHeight:1}}>
        {show?"🙈":"👁"}
      </button>
    </div>
  );
}

// ─── CONFIRM DIALOG ────────────────────────────────────────────────────────────
function ConfirmDialog({title,msg,onConfirm,onCancel,confirmText="Ya, Hapus",confirmColor="#ef4444",icon="🗑️"}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:9000,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(6px)"}} onClick={onCancel}>
      <div style={{background:"#fff",borderRadius:20,maxWidth:400,width:"100%",overflow:"hidden",boxShadow:"0 40px 100px rgba(0,0,0,0.35)"}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:"28px 28px 0"}}>
          <div style={{width:56,height:56,borderRadius:16,background:`${confirmColor}15`,border:`2px solid ${confirmColor}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,marginBottom:16}}>{icon}</div>
          <h3 style={{fontWeight:700,fontSize:17,color:"#1e293b",marginBottom:8}}>{title}</h3>
          <p style={{fontSize:14,color:"#64748b",lineHeight:1.6,marginBottom:24}}>{msg}</p>
        </div>
        <div style={{display:"flex",gap:10,padding:"0 28px 28px"}}>
          <button onClick={onCancel} style={{flex:1,padding:"12px",borderRadius:12,border:"1.5px solid #e2e8f0",background:"#fff",cursor:"pointer",fontWeight:600,fontSize:14,color:"#64748b"}}>Batal</button>
          <button onClick={onConfirm} style={{flex:1,padding:"12px",borderRadius:12,border:"none",background:`linear-gradient(135deg,${confirmColor},${confirmColor}cc)`,color:"#fff",cursor:"pointer",fontWeight:700,fontSize:14}}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}

// ─── BOOK COVER ─────────────────────────────────────────────────────────────────
function BookCover({book,size="md"}){
  const h=size==="lg"?220:size==="md"?180:130;
  const iSize=size==="lg"?52:size==="md"?42:32;
  const [c1,c2]=book.cover||[book.coverColor1||"#6366f1",book.coverColor2||"#8b5cf6"];
  const imgSrc=book.coverImage||null;
  const radius=size==="sm"?0:"8px 8px 0 0";
  return(
    <div style={{height:h,position:"relative",overflow:"hidden",borderRadius:radius,background:`linear-gradient(145deg,${c1},${c2})`}}>
      {imgSrc?(
        <img src={imgSrc} alt={book.title} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}
          onError={e=>{e.target.style.display="none";}}/>
      ):(
        <>
          <div style={{position:"absolute",left:0,top:0,bottom:0,width:8,background:"rgba(0,0,0,0.2)"}}/>
          <div style={{position:"absolute",left:8,top:0,bottom:0,width:2,background:"rgba(255,255,255,0.1)"}}/>
          {[20,40,60,80].map(p=><div key={p} style={{position:"absolute",left:"10%",right:"5%",top:`${p}%`,height:1,background:"rgba(255,255,255,0.06)"}}/>)}
          <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"16px 12px",gap:8}}>
            <div style={{fontSize:iSize,opacity:0.25}}>📖</div>
            <div style={{color:"rgba(255,255,255,0.9)",fontSize:size==="lg"?12:10,fontWeight:700,textAlign:"center",lineHeight:1.4,textShadow:"0 1px 4px rgba(0,0,0,0.5)",display:"-webkit-box",WebkitLineClamp:3,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{book.title}</div>
          </div>
        </>
      )}
      {book.badge&&<div style={{position:"absolute",top:10,right:10,background:BADGE[book.badge]?.bg||"#e0e7ff",color:BADGE[book.badge]?.color||"#3730a3",border:`1px solid ${BADGE[book.badge]?.border||"#c7d2fe"}`,fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:20,letterSpacing:"0.04em",textTransform:"uppercase",zIndex:2}}>{book.badge}</div>}
    </div>
  );
}

function DashBookCard({book,bookmarks,toggleBM,onSelect,isAdmin,onEdit,onDelete}){
  const isB=bookmarks?.includes(book.id);
  return(
    <div className="hc" style={{background:"#fff",borderRadius:14,overflow:"hidden",boxShadow:"0 2px 10px rgba(0,0,0,0.07)",border:"1px solid #f1f5f9",cursor:"pointer",position:"relative"}} onClick={()=>onSelect(book)}>
      <BookCover book={book} size="md"/>
      {isAdmin&&(
        <div style={{position:"absolute",top:8,right:8,display:"flex",gap:4}} onClick={e=>e.stopPropagation()}>
          <button onClick={()=>onEdit(book)} title="Edit Buku" style={{width:28,height:28,borderRadius:8,background:"rgba(255,255,255,0.92)",border:"none",cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 6px rgba(0,0,0,0.15)"}}>✏️</button>
          <button onClick={()=>onDelete(book)} title="Hapus Buku" style={{width:28,height:28,borderRadius:8,background:"rgba(255,255,255,0.92)",border:"none",cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 6px rgba(0,0,0,0.15)"}}>🗑️</button>
        </div>
      )}
      <div style={{padding:"12px 14px"}}>
        <p style={{fontSize:13,fontWeight:600,color:"#1e293b",lineHeight:1.4,marginBottom:4,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden",minHeight:38}}>{book.title}</p>
        <p style={{fontSize:11,color:"#94a3b8",marginBottom:8,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{book.author?.split(",")[0]}</p>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:10,background:"#eef2ff",color:"#6366f1",padding:"2px 8px",borderRadius:20,fontWeight:500}}>{book.category?.split(" ")[0]}</span>
          {toggleBM&&<button onClick={e=>{e.stopPropagation();toggleBM(book.id);}} style={{background:"none",border:"none",cursor:"pointer",fontSize:16,color:isB?"#fbbf24":"#d1d5db"}}>{isB?"★":"☆"}</button>}
        </div>
      </div>
    </div>
  );
}

// ─── PUBLIC CATALOG ─────────────────────────────────────────────────────────────
function PublicCatalog({onLoginClick,onBookClick}){
  const [books,setBooks]=useState([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState("");
  const [cat,setCat]=useState("Semua");
  const [cats,setCats]=useState(CATS_DEFAULT);
  const [scrolled,setScrolled]=useState(false);
  const [heroIdx,setHeroIdx]=useState(0);
  const [searchResults,setSearchResults]=useState([]);
  const [searching,setSearching]=useState(false);

  useEffect(()=>{
    const h=()=>setScrolled(window.scrollY>60);
    window.addEventListener("scroll",h);
    return()=>window.removeEventListener("scroll",h);
  },[]);

  // Load buku publik dari API
  useEffect(()=>{
    const loadBooks=async()=>{
      try {
        const [bRes, sRes] = await Promise.all([
          api("GET", "/books?limit=50&sort=downloads"),
          api("GET", "/settings"),
        ]);
        if(bRes.success) setBooks(bRes.data.map(mapBook));
        if(sRes.success && sRes.data.kategori_buku) {
          try { setCats(["Semua",...JSON.parse(sRes.data.kategori_buku)]); } catch {}
        }
      } catch(e) {
        // fallback: tampil kosong
      } finally {
        setLoading(false);
      }
    };
    loadBooks();
  },[]);

  // Search
  useEffect(()=>{
    if(!search) { setSearchResults([]); return; }
    setSearching(true);
    const t=setTimeout(async()=>{
      try {
        const res=await api("GET", `/books?limit=50&search=${encodeURIComponent(search)}${cat!=="Semua"?`&category=${encodeURIComponent(cat)}`:""}`)
        if(res.success) setSearchResults(res.data.map(mapBook));
      } catch {}
      setSearching(false);
    },400);
    return()=>clearTimeout(t);
  },[search,cat]);

  const heroBooks = books.filter(b=>b.badge==="Best Seller").slice(0,4);
  if(heroBooks.length<4) books.slice(0,4).forEach(b=>{ if(!heroBooks.find(x=>x.id===b.id)) heroBooks.push(b); });
  useEffect(()=>{if(heroBooks.length>1){const t=setInterval(()=>setHeroIdx(i=>(i+1)%heroBooks.length),4000);return()=>clearInterval(t);}},[heroBooks.length]);

  const displayBooks = search ? searchResults : (cat==="Semua" ? books : books.filter(b=>b.category===cat));
  const bestSeller = books.filter(b=>b.badge==="Best Seller");
  const newest     = books.filter(b=>b.badge==="Baru");

  return(
    <div style={{minHeight:"100vh",background:"#f8f9fb",fontFamily:"'Inter',sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Poppins:wght@600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:5px;}::-webkit-scrollbar-thumb{background:#e2e8f0;border-radius:3px;}
        .bk:hover{transform:translateY(-6px);box-shadow:0 20px 48px rgba(0,0,0,0.14)!important;transition:all 0.28s cubic-bezier(0.4,0,0.2,1);}
        .bk{transition:all 0.28s cubic-bezier(0.4,0,0.2,1);}
        .cat-btn:hover{background:#1e293b!important;color:#fff!important;}
        input:focus{outline:2px solid #6366f1!important;outline-offset:2px;}
        input::placeholder{color:#94a3b8;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* NAVBAR */}
      <nav style={{position:"sticky",top:0,zIndex:100,background:scrolled?"rgba(255,255,255,0.97)":"#fff",backdropFilter:"blur(16px)",borderBottom:"1px solid #f1f5f9",boxShadow:scrolled?"0 4px 24px rgba(0,0,0,0.08)":"none",transition:"all 0.3s"}}>
        <div style={{background:"linear-gradient(90deg,#1e1b4b,#312e81,#1e3a5f)",padding:"6px 40px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:11,color:"rgba(255,255,255,0.7)",fontStyle:"italic"}}>✨ Perpustakaan Digital Universitas Islam Dr. Khez Muttaqien</span>
          <div style={{display:"flex",gap:20}}>{["Tentang","Kontak","FAQ"].map(t=><a key={t} href="#" style={{fontSize:11,color:"rgba(255,255,255,0.6)",textDecoration:"none"}}>{t}</a>)}</div>
        </div>
        <div style={{padding:"14px 40px",display:"flex",alignItems:"center",gap:20}}>
          <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
            <div style={{width:42,height:42,borderRadius:12,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,boxShadow:"0 4px 14px #6366f140"}}>📚</div>
            <div><div style={{fontFamily:"'Poppins',sans-serif",fontWeight:800,fontSize:16,color:"#1e293b",letterSpacing:"-0.02em",lineHeight:1.1}}>Digilib<span style={{background:"linear-gradient(135deg,#6366f1,#ec4899)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}> UNISMU</span></div><div style={{fontSize:9,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.1em"}}>Dr. Khez Muttaqien</div></div>
          </div>
          <div style={{flex:1,maxWidth:520,position:"relative"}}>
            <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:"#94a3b8",fontSize:16,pointerEvents:"none"}}>🔍</span>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari judul buku, penulis, kata kunci..." style={{width:"100%",padding:"11px 16px 11px 44px",borderRadius:30,border:"1.5px solid #e2e8f0",fontSize:14,background:"#f8fafc",transition:"all 0.2s"}}/>
            {search&&<button onClick={()=>setSearch("")} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:18}}>×</button>}
          </div>
          <div style={{display:"flex",gap:4,alignItems:"center"}}>
            {[["🏠","Beranda"],["📚","Koleksi"],["🎓","Skripsi"],["📰","Jurnal"]].map(([ic,l])=>(
              <button key={l} style={{padding:"8px 14px",borderRadius:8,border:"none",background:"none",cursor:"pointer",fontSize:13,color:"#64748b",fontWeight:500,display:"flex",alignItems:"center",gap:5}}><span>{ic}</span><span>{l}</span></button>
            ))}
          </div>
          <button onClick={onLoginClick} style={{padding:"9px 20px",borderRadius:30,border:"none",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:700,boxShadow:"0 4px 14px #6366f140",flexShrink:0}}>🔐 Masuk / Daftar</button>
        </div>
        <div style={{padding:"0 40px 12px",display:"flex",gap:6,overflowX:"auto",scrollbarWidth:"none"}}>
          {cats.map(c=>(<button key={c} onClick={()=>setCat(c)} className="cat-btn" style={{padding:"5px 14px",borderRadius:20,border:`1.5px solid ${cat===c?"#6366f1":"#e2e8f0"}`,background:cat===c?"#6366f1":"#fff",color:cat===c?"#fff":"#64748b",cursor:"pointer",fontSize:12,fontWeight:cat===c?700:400,whiteSpace:"nowrap",transition:"all 0.2s",flexShrink:0}}>{c}</button>))}
        </div>
      </nav>

      {/* HERO */}
      {!search&&cat==="Semua"&&heroBooks.length>0&&(
        <section style={{background:"linear-gradient(135deg,#0f0c29,#302b63,#24243e)",position:"relative",overflow:"hidden",padding:"0 40px"}}>
          {[[" 10%","20%","400px","#6366f120"],["70%","60%","300px","#ec489920"],["40%","80%","250px","#3b82f615"]].map(([l,t,s,c],i)=>(
            <div key={i} style={{position:"absolute",left:l,top:t,width:s,height:s,borderRadius:"50%",background:c,filter:"blur(100px)",pointerEvents:"none"}}/>
          ))}
          <div style={{maxWidth:1200,margin:"0 auto",display:"grid",gridTemplateColumns:"1fr 1fr",gap:40,alignItems:"center",padding:"60px 0",position:"relative",zIndex:1}}>
            <div style={{animation:"fadeUp 0.6s ease"}}>
              <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(99,102,241,0.2)",border:"1px solid rgba(99,102,241,0.4)",borderRadius:20,padding:"5px 14px",marginBottom:20,fontSize:11,color:"#a5b4fc",fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase"}}>📚 Perpustakaan Digital UNISMU</div>
              <h1 style={{fontFamily:"'Poppins',sans-serif",fontSize:46,fontWeight:900,lineHeight:1.1,color:"#fff",marginBottom:18,letterSpacing:"-0.02em"}}>Temukan Buku<br/><span style={{background:"linear-gradient(90deg,#fbbf24,#f59e0b,#fde68a)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Ilmu Terbaik</span><br/><span style={{fontSize:36,fontWeight:700,color:"rgba(255,255,255,0.8)"}}>Untuk Masa Depanmu</span></h1>
              <p style={{fontSize:15,color:"rgba(255,255,255,0.65)",lineHeight:1.8,marginBottom:28,maxWidth:440}}>Akses koleksi buku digital, jurnal ilmiah, dan karya tugas akhir mahasiswa UNISMU kapan saja.</p>
              <div style={{display:"flex",gap:12}}><button onClick={onLoginClick} style={{padding:"13px 28px",borderRadius:30,border:"none",background:"linear-gradient(135deg,#fbbf24,#f59e0b)",color:"#1e1b4b",cursor:"pointer",fontSize:15,fontWeight:800,boxShadow:"0 8px 24px rgba(251,191,36,0.4)"}}>🚀 Mulai Membaca</button></div>
              <div style={{display:"flex",gap:24,marginTop:36}}>
                {[[books.length+"+"," Koleksi Buku"],["8K+","Anggota Aktif"],["124","Jurnal Ilmiah"]].map(([v,l])=>(
                  <div key={l}><div style={{fontFamily:"'Poppins',sans-serif",fontSize:24,fontWeight:800,color:"#fff"}}>{v}</div><div style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginTop:1}}>{l}</div></div>
                ))}
              </div>
            </div>
            <div style={{position:"relative",height:380,display:"flex",alignItems:"center",justifyContent:"center"}}>
              {heroBooks.slice(0,4).map((b,i)=>{
                const isActive=i===heroIdx;
                const offset=(i-heroIdx+heroBooks.length)%heroBooks.length;
                return(<div key={b.id} onClick={()=>onBookClick(b)} style={{position:"absolute",width:180,cursor:"pointer",borderRadius:12,overflow:"hidden",boxShadow:"0 32px 64px rgba(0,0,0,0.6)",transform:isActive?"translateX(0) scale(1.05) rotate(0deg)":`translateX(${(offset-1.5)*90}px) scale(${0.8-offset*0.05}) rotate(${(offset-1.5)*4}deg)`,zIndex:isActive?10:5-offset,opacity:isActive?1:0.5,transition:"all 0.5s cubic-bezier(0.4,0,0.2,1)"}}><BookCover book={b} size="lg"/><div style={{background:"#fff",padding:"12px 14px"}}><p style={{fontSize:12,fontWeight:700,color:"#1e293b",lineHeight:1.4,marginBottom:2,display:"-webkit-box",WebkitLineClamp:1,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{b.title}</p><p style={{fontSize:10,color:"#94a3b8"}}>{b.author?.split(",")[0]}</p></div></div>);
              })}
              <div style={{position:"absolute",bottom:-20,display:"flex",gap:6}}>{heroBooks.slice(0,4).map((_,i)=><div key={i} onClick={()=>setHeroIdx(i)} style={{width:heroIdx===i?20:6,height:6,borderRadius:3,background:heroIdx===i?"#fbbf24":"rgba(255,255,255,0.3)",cursor:"pointer",transition:"all 0.3s"}}/>)}</div>
            </div>
          </div>
        </section>
      )}

      {/* MAIN */}
      <div style={{maxWidth:1280,margin:"0 auto",padding:"40px 40px"}}>
        {loading&&<Spinner/>}
        {!loading&&(search||cat!=="Semua")&&(
          <div style={{marginBottom:40}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <div><h2 style={{fontFamily:"'Poppins',sans-serif",fontSize:22,fontWeight:700,color:"#1e293b"}}>{search?`Hasil: "${search}"`:cat}</h2><p style={{fontSize:13,color:"#94a3b8",marginTop:3}}>{searching?"Mencari...":`${displayBooks.length} buku`}</p></div>
              <button onClick={()=>{setSearch("");setCat("Semua");}} style={{padding:"8px 16px",borderRadius:20,border:"1.5px solid #e2e8f0",background:"#fff",cursor:"pointer",fontSize:12,color:"#64748b"}}>✕ Reset filter</button>
            </div>
            {searching?<Spinner/>:displayBooks.length>0?(<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(175px,1fr))",gap:16}}>{displayBooks.map(b=><PubBookCard key={b.id} book={b} onClick={()=>onBookClick(b)}/>)}</div>):<EmptyState icon="📭" msg="Tidak ada buku ditemukan" sub="Coba kata kunci atau kategori lain"/>}
          </div>
        )}
        {!loading&&!search&&cat==="Semua"&&(<>
          {bestSeller.length>0&&(<section style={{marginBottom:48}}><SectionHeader title="🏆 Best Seller" sub="Buku paling banyak dibaca"/><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(175px,1fr))",gap:16}}>{bestSeller.slice(0,8).map(b=><PubBookCard key={b.id} book={b} onClick={()=>onBookClick(b)}/>)}</div></section>)}
          <div style={{background:"linear-gradient(135deg,#1e1b4b,#312e81,#1e40af)",borderRadius:20,padding:"32px 40px",marginBottom:48,display:"flex",justifyContent:"space-between",alignItems:"center",position:"relative",overflow:"hidden"}}>
            <div style={{position:"relative",zIndex:1}}><div style={{fontSize:11,color:"#a5b4fc",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10}}>🎓 Untuk Sivitas Akademika UNISMU</div><h3 style={{fontFamily:"'Poppins',sans-serif",fontSize:26,fontWeight:800,color:"#fff",marginBottom:10,lineHeight:1.2}}>Akses Penuh Semua Koleksi<br/><span style={{color:"#fbbf24"}}>Gratis & Unlimited</span></h3><p style={{fontSize:13,color:"rgba(255,255,255,0.65)",maxWidth:400,lineHeight:1.7}}>Login dengan akun mahasiswa, dosen, atau tendik UNISMU dan nikmati akses penuh ke seluruh koleksi digital.</p></div>
            <button onClick={onLoginClick} style={{padding:"14px 32px",borderRadius:30,border:"none",background:"linear-gradient(135deg,#fbbf24,#f59e0b)",color:"#1e1b4b",cursor:"pointer",fontSize:15,fontWeight:800,flexShrink:0,position:"relative",zIndex:1,boxShadow:"0 8px 24px rgba(251,191,36,0.3)"}}>Masuk Sekarang →</button>
          </div>
          {newest.length>0&&(<section style={{marginBottom:48}}><SectionHeader title="✨ Koleksi Terbaru" sub="Baru ditambahkan"/><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(175px,1fr))",gap:16}}>{newest.slice(0,8).map(b=><PubBookCard key={b.id} book={b} onClick={()=>onBookClick(b)}/>)}</div></section>)}
          <section style={{marginBottom:48}}><SectionHeader title="📚 Semua Koleksi" sub="Jelajahi seluruh koleksi"/><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(175px,1fr))",gap:16}}>{books.map(b=><PubBookCard key={b.id} book={b} onClick={()=>onBookClick(b)}/>)}</div></section>
        </>)}
      </div>

      {/* FOOTER */}
      <footer style={{background:"#0f172a",color:"rgba(255,255,255,0.6)",padding:"48px 40px 24px"}}>
        <div style={{maxWidth:1280,margin:"0 auto"}}>
          <div style={{borderTop:"1px solid rgba(255,255,255,0.08)",paddingTop:20,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
            <p style={{fontSize:12}}>© 2024 Perpustakaan Digital UNISMU — Universitas Islam Dr. Khez Muttaqien</p>
            <div style={{display:"flex",gap:16}}>{["Privasi","Syarat","Bantuan"].map(t=><a key={t} href="#" style={{fontSize:12,color:"rgba(255,255,255,0.4)",textDecoration:"none"}}>{t}</a>)}</div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SectionHeader({title,sub,action}){return(<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}><div><h2 style={{fontFamily:"'Poppins',sans-serif",fontSize:22,fontWeight:700,color:"#1e293b"}}>{title}</h2><p style={{fontSize:13,color:"#94a3b8",marginTop:3}}>{sub}</p></div>{action&&<button style={{padding:"7px 16px",borderRadius:20,border:"1.5px solid #e2e8f0",background:"#fff",cursor:"pointer",fontSize:12,color:"#64748b",fontWeight:500}}>{action} →</button>}</div>);}

function PubBookCard({book,onClick}){
  return(
    <div className="bk" onClick={onClick} style={{background:"#fff",borderRadius:12,overflow:"hidden",boxShadow:"0 2px 12px rgba(0,0,0,0.06)",border:"1px solid #f1f5f9",cursor:"pointer"}}>
      <BookCover book={book} size="md"/>
      <div style={{padding:"12px 14px"}}>
        <p style={{fontSize:13,fontWeight:700,color:"#1e293b",lineHeight:1.4,marginBottom:4,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden",minHeight:38}}>{book.title}</p>
        <p style={{fontSize:11,color:"#94a3b8",marginBottom:8,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{book.author?.split(",")[0]}</p>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <span style={{fontSize:10,background:"#f1f5f9",color:"#64748b",padding:"2px 8px",borderRadius:20,fontWeight:500}}>{book.category?.split(" ")[0]}</span>
          <span style={{fontSize:11,color:"#f59e0b",fontWeight:600}}>★ {book.rating||"-"}</span>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontSize:11,color:"#94a3b8"}}>⬇️ {(book.downloads||0).toLocaleString()}</span>
          <div style={{height:22,overflow:"hidden",borderRadius:6,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",padding:"0 10px"}}><span style={{fontSize:10,color:"#fff",fontWeight:700,whiteSpace:"nowrap"}}>📖 Baca</span></div>
        </div>
      </div>
    </div>
  );
}

// ─── PUBLIC BOOK MODAL ──────────────────────────────────────────────────────────
function PubBookModal({book,onClose,onLoginClick}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(8px)"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:"#fff",borderRadius:20,maxWidth:700,width:"100%",maxHeight:"92vh",overflow:"auto",boxShadow:"0 40px 100px rgba(0,0,0,0.4)"}}>
        <div style={{height:200,background:`linear-gradient(145deg,${book.cover?.[0]||"#6366f1"},${book.cover?.[1]||"#8b5cf6"})`,position:"relative",display:"flex",alignItems:"flex-end",padding:"24px 32px"}}>
          <button onClick={onClose} style={{position:"absolute",top:16,right:16,width:34,height:34,borderRadius:10,background:"rgba(0,0,0,0.3)",border:"none",color:"#fff",cursor:"pointer",fontSize:18}}>✕</button>
          <div><h2 style={{color:"#fff",fontFamily:"'Poppins',sans-serif",fontSize:22,fontWeight:700,lineHeight:1.3,textShadow:"0 2px 10px rgba(0,0,0,0.4)"}}>{book.title}</h2></div>
        </div>
        <div style={{padding:"28px 32px"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
            {[["✍️ Penulis",book.author],["📅 Tahun",book.year],["🔢 ISBN",book.isbn],["📄 Halaman",`${book.pages} halaman`],["📦 Stok",`${book.stok} tersedia`],["📍 Lokasi",book.lokasi],["⬇️ Diunduh",(book.downloads||0).toLocaleString()+" kali"],["⭐ Rating",`${book.rating||"-"}/5.0`]].map(([l,v])=>(
              <div key={l} style={{background:"#f8fafc",borderRadius:10,padding:"10px 14px",border:"1px solid #f1f5f9"}}><p style={{fontSize:10,color:"#94a3b8",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:3}}>{l}</p><p style={{fontSize:13,color:"#1e293b",fontWeight:500}}>{v||"-"}</p></div>
            ))}
          </div>
          {book.abstract&&<div style={{background:"#f8fafc",borderRadius:12,padding:"16px 18px",marginBottom:24}}><p style={{fontSize:14,color:"#374151",lineHeight:1.8}}>{book.abstract}</p></div>}
          <div style={{background:"linear-gradient(135deg,#eef2ff,#f0fdf4)",border:"1.5px solid #e0e7ff",borderRadius:14,padding:"20px 22px",display:"flex",gap:16,alignItems:"center"}}>
            <div style={{fontSize:36}}>🔐</div>
            <div style={{flex:1}}><p style={{fontWeight:700,fontSize:14,color:"#1e293b",marginBottom:4}}>Login untuk Membaca & Meminjam</p><p style={{fontSize:13,color:"#64748b",lineHeight:1.6}}>Masuk dengan akun sivitas akademika UNISMU untuk mendapatkan token akses.</p></div>
            <button onClick={onLoginClick} style={{padding:"11px 22px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:700,flexShrink:0}}>Masuk Sekarang</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── LOGIN MODAL ────────────────────────────────────────────────────────────────
function LoginModal({onClose,onLogin,notification,loading}){
  const [data,setData]=useState({nim:"",password:""});
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"flex-end",backdropFilter:"blur(8px)"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{width:440,height:"100vh",background:"#fff",boxShadow:"-20px 0 60px rgba(0,0,0,0.3)",display:"flex",flexDirection:"column",animation:"slideInRight 0.35s cubic-bezier(0.4,0,0.2,1)"}}>
        <style>{`@keyframes slideInRight{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
        <div style={{background:"linear-gradient(135deg,#1e1b4b,#312e81,#1e40af)",padding:"32px 32px 28px",position:"relative",flexShrink:0}}>
          <div style={{position:"absolute",top:0,left:0,right:0,height:4,background:"linear-gradient(90deg,#fbbf24,#f59e0b,#fde68a,#fbbf24)"}}/>
          <button onClick={onClose} style={{position:"absolute",top:16,right:16,width:32,height:32,borderRadius:8,background:"rgba(255,255,255,0.1)",border:"none",color:"#fff",cursor:"pointer",fontSize:16}}>✕</button>
          <div style={{width:52,height:52,borderRadius:14,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,marginBottom:14}}>📚</div>
          <h2 style={{fontFamily:"'Poppins',sans-serif",fontSize:22,fontWeight:800,color:"#fff",marginBottom:6}}>Masuk ke Digilib</h2>
          <p style={{fontSize:13,color:"rgba(255,255,255,0.6)"}}>Universitas Islam Dr. Khez Muttaqien</p>
        </div>
        <div style={{flex:1,overflow:"auto",padding:"28px 32px"}}>
          {notification&&<div style={{background:notification.type==="error"?"#fef2f2":"#ecfdf5",border:`1px solid ${notification.type==="error"?"#fecaca":"#a7f3d0"}`,borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:13,color:notification.type==="error"?"#991b1b":"#065f46",fontWeight:500}}>{notification.type==="error"?"❌":"✅"} {notification.msg}</div>}
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <FF label="NIM / NIP / ID"><input value={data.nim} onChange={e=>setData(p=>({...p,nim:e.target.value}))} placeholder="Masukkan NIM/NIP/ID" style={IS}/></FF>
            <FF label="Password"><PasswordInput value={data.password} onChange={e=>setData(p=>({...p,password:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&onLogin(data)} placeholder="Password"/></FF>
            <button onClick={()=>onLogin(data)} disabled={loading} style={{padding:"13px",borderRadius:12,border:"none",background:loading?"#94a3b8":"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",fontSize:15,fontWeight:700,cursor:loading?"not-allowed":"pointer",marginTop:4}}>
              {loading?"⏳ Memproses...":"Masuk ke Digilib →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── DASHBOARD APP ──────────────────────────────────────────────────────────────
function DashboardApp({user,onLogout,accessToken}){
  const [activeTab,setActiveTab]=useState(ROLE_CONFIG[user.role]?.tabs[0]||"beranda");
  const [books,setBooks]=useState([]);
  const [peminjaman,setPeminjaman]=useState([]);
  const [bookmarkIds,setBookmarkIds]=useState([]);
  const [selectedBook,setSelectedBook]=useState(null);
  const [search,setSearch]=useState("");
  const [cat,setCat]=useState("Semua");
  const [notif,setNotif]=useState(null);
  const [sidebar,setSidebar]=useState(true);
  const [cats,setCats]=useState(CATS_DEFAULT);
  const [loadingBooks,setLoadingBooks]=useState(true);

  const rc=ROLE_CONFIG[user.role]||ROLE_CONFIG.mahasiswa;
  const isUniv=user.role==="pustakawan_universitas";
  const isFakAdmin=user.role==="pustakawan_fakultas";
  const isAdmin=isUniv||isFakAdmin;

  const showNotif=(msg,type="success")=>{setNotif({msg,type});setTimeout(()=>setNotif(null),3500);};

  // Load initial data
  useEffect(()=>{
    const load=async()=>{
      try {
        setLoadingBooks(true);
        const [bRes, sRes] = await Promise.all([
          api("GET", "/books?limit=50"),
          api("GET", "/settings"),
        ]);
        if(bRes.success) setBooks(bRes.data.map(mapBook));
        if(sRes.success && sRes.data.kategori_buku) {
          try { setCats(["Semua",...JSON.parse(sRes.data.kategori_buku)]); } catch {}
        }
      } catch(e) { showNotif("Gagal memuat data buku: "+e.message, "error"); }
      finally { setLoadingBooks(false); }
    };
    load();
  },[]);

  // Load peminjaman
  useEffect(()=>{
    const load=async()=>{
      try {
        const res=await api("GET","/peminjaman?limit=100");
        if(res.success) setPeminjaman(res.data.map(mapPeminjaman));
      } catch {}
    };
    if(user) load();
  },[user]);

  // Load bookmarks
  useEffect(()=>{
    const load=async()=>{
      try {
        const res=await api("GET","/bookmark");
        if(res.success) setBookmarkIds(res.data.map(b=>b.id));
      } catch {}
    };
    if(user) load();
  },[user]);

  // Reload books (dipanggil setelah CRUD)
  const reloadBooks=useCallback(async()=>{
    try {
      const res=await api("GET","/books?limit=50");
      if(res.success) setBooks(res.data.map(mapBook));
    } catch {}
  },[]);

  const reloadPeminjaman=useCallback(async()=>{
    try {
      const res=await api("GET","/peminjaman?limit=100");
      if(res.success) setPeminjaman(res.data.map(mapPeminjaman));
    } catch {}
  },[]);

  const toggleBM=async(bookId)=>{
    try {
      const res=await api("POST",`/bookmark/${bookId}`);
      if(res.success) {
        if(res.data.bookmarked) { setBookmarkIds(p=>[...p,bookId]); showNotif("Ditambahkan ke bookmark 🔖"); }
        else { setBookmarkIds(p=>p.filter(x=>x!==bookId)); showNotif("Dihapus dari bookmark"); }
      }
    } catch(e) { showNotif(e.message,"error"); }
  };

  const handleBorrow=async(book,durasi)=>{
    try {
      const res=await api("POST","/peminjaman",{bookId:book.id,durasi});
      if(res.success) {
        showNotif("📚 Buku dipinjam! Token berhasil dibuat.");
        await reloadPeminjaman();
        await reloadBooks();
        return res.data;
      }
    } catch(e) { showNotif(e.message,"error"); return null; }
  };

  const filteredBooks=books.filter(b=>{
    const mC=cat==="Semua"||b.category===cat;
    const mQ=!search||b.title?.toLowerCase().includes(search.toLowerCase())||b.author?.toLowerCase().includes(search.toLowerCase());
    return mC&&mQ;
  });

  return(
    <div style={{display:"flex",minHeight:"100vh",fontFamily:"'Inter',sans-serif",background:"#f1f5f9"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Poppins:wght@600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0;}::-webkit-scrollbar{width:5px;}::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:3px;}.hc:hover{transform:translateY(-4px);box-shadow:0 20px 40px rgba(0,0,0,0.12)!important;transition:all 0.25s;}.bg:hover{filter:brightness(1.08);transform:translateY(-1px);transition:all 0.2s;}input:focus,select:focus,textarea:focus{outline:2px solid #6366f1!important;outline-offset:2px;}input::placeholder,textarea::placeholder{color:#94a3b8;}`}</style>

      {notif&&<div style={{position:"fixed",top:20,right:20,zIndex:9999,background:notif.type==="error"?"#ef4444":"#10b981",color:"#fff",padding:"12px 20px",borderRadius:10,boxShadow:"0 8px 30px rgba(0,0,0,0.2)",fontSize:14,fontWeight:500,maxWidth:340,zIndex:9999}}>{notif.type==="error"?"❌":"✅"} {notif.msg}</div>}

      {/* Sidebar */}
      <aside style={{width:sidebar?260:72,background:"#fff",borderRight:"1px solid #e2e8f0",display:"flex",flexDirection:"column",transition:"width 0.3s",overflow:"hidden",position:"sticky",top:0,height:"100vh",flexShrink:0}}>
        <div style={{padding:"20px 16px",borderBottom:"1px solid #f1f5f9",display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:40,height:40,borderRadius:10,background:rc.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{rc.icon||"📚"}</div>
          {sidebar&&<div><div style={{fontFamily:"'Poppins',sans-serif",fontWeight:700,fontSize:13,color:"#1e293b",lineHeight:1.2}}>Digilib UNISMU</div><div style={{fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.06em"}}>Dr. Khez Muttaqien</div></div>}
        </div>
        {sidebar&&<div style={{margin:"12px 16px",padding:"10px 12px",borderRadius:10,background:`${rc.color}15`,border:`1px solid ${rc.color}30`}}><div style={{fontSize:11,color:rc.color,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em"}}>{rc.icon} {rc.label}</div><div style={{fontSize:12,color:"#64748b",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.name?.split(",")[0]}</div></div>}
        <nav style={{flex:1,padding:"8px 10px",overflow:"auto"}}>
          {rc.tabs.map(tab=>(<button key={tab} onClick={()=>setActiveTab(tab)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,border:"none",cursor:"pointer",background:activeTab===tab?`${rc.color}18`:"transparent",color:activeTab===tab?rc.color:"#64748b",fontWeight:activeTab===tab?600:400,fontSize:13,marginBottom:2,transition:"all 0.2s",justifyContent:sidebar?"flex-start":"center"}}><span style={{fontSize:16,flexShrink:0}}>{TAB_ICONS[tab]}</span>{sidebar&&<span style={{whiteSpace:"nowrap"}}>{TAB_LABELS[tab]}</span>}{sidebar&&activeTab===tab&&<span style={{marginLeft:"auto",width:6,height:6,borderRadius:"50%",background:rc.color}}/>}</button>))}
        </nav>
        <div style={{padding:"12px 10px",borderTop:"1px solid #f1f5f9"}}>
          <button onClick={()=>setSidebar(p=>!p)} style={{width:"100%",padding:"8px",borderRadius:8,border:"1px solid #e2e8f0",background:"#f8fafc",cursor:"pointer",fontSize:14,color:"#64748b",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>{sidebar?"◀ Tutup":"▶"}</button>
          {sidebar&&<button onClick={onLogout} style={{width:"100%",marginTop:6,padding:"8px",borderRadius:8,border:"none",background:"#fee2e2",cursor:"pointer",fontSize:13,color:"#ef4444",fontWeight:500}}>🚪 Keluar</button>}
        </div>
      </aside>

      <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
        <header style={{background:"#fff",borderBottom:"1px solid #e2e8f0",padding:"14px 28px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50}}>
          <div><h1 style={{fontSize:18,fontWeight:700,color:"#1e293b",fontFamily:"'Poppins',sans-serif"}}>{TAB_ICONS[activeTab]} {TAB_LABELS[activeTab]}</h1><p style={{fontSize:12,color:"#94a3b8",marginTop:1}}>Universitas Islam Dr. Khez Muttaqien</p></div>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{position:"relative"}}><input placeholder="Cari koleksi..." value={search} onChange={e=>{setSearch(e.target.value);if(e.target.value&&rc.tabs.includes("koleksi"))setActiveTab("koleksi");}} style={{padding:"8px 36px 8px 14px",borderRadius:20,border:"1px solid #e2e8f0",fontSize:13,width:200,background:"#f8fafc"}}/><span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",color:"#94a3b8",fontSize:14}}>🔍</span></div>
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 12px",borderRadius:20,background:`${rc.color}12`,border:`1px solid ${rc.color}30`,cursor:"pointer"}}><span style={{fontSize:18}}>{user.avatar||"👤"}</span><span style={{fontSize:13,fontWeight:500,color:rc.color}}>{user.name?.split(",")[0].split(" ").slice(0,2).join(" ")}</span></div>
          </div>
        </header>

        <main style={{flex:1,padding:28,overflow:"auto"}}>
          {activeTab==="dashboard"&&<DashInner user={user} books={books} peminjaman={peminjaman} rc={rc}/>}
          {activeTab==="beranda"&&<BerandaInner user={user} books={books} rc={rc} setActiveTab={setActiveTab} bookmarkIds={bookmarkIds} toggleBM={toggleBM} setSelectedBook={setSelectedBook}/>}
          {activeTab==="koleksi"&&<KoleksiInner user={user} books={filteredBooks} allBooks={books} setBooks={setBooks} rc={rc} bookmarkIds={bookmarkIds} toggleBM={toggleBM} setSelectedBook={setSelectedBook} cats={cats} cat={cat} setCat={setCat} isAdmin={isAdmin||isFakAdmin} showNotif={showNotif} reloadBooks={reloadBooks}/>}
          {activeTab==="peminjaman"&&<PinjamAdmin peminjaman={peminjaman} setPeminjaman={setPeminjaman} books={books} rc={rc} showNotif={showNotif} reloadPeminjaman={reloadPeminjaman} user={user}/>}
          {activeTab==="peminjaman-saya"&&<PinjamSaya user={user} peminjaman={peminjaman.filter(p=>p.userId===user.id)} books={books} rc={rc} showNotif={showNotif} setSelectedBook={setSelectedBook}/>}
          {activeTab==="pengguna"&&<UserPage rc={rc} showNotif={showNotif} user={user}/>}
          {activeTab==="laporan"&&<LaporanInner books={books} peminjaman={peminjaman} rc={rc} user={user}/>}
          {activeTab==="pengaturan"&&isUniv&&<SettingsKepala rc={rc} showNotif={showNotif} books={books} peminjaman={peminjaman}/>}
          {activeTab==="bookmark"&&<BookmarkInner books={books} bookmarkIds={bookmarkIds} toggleBM={toggleBM} setSelectedBook={setSelectedBook}/>}
          {activeTab==="kartu-anggota"&&<KartuAnggota user={user} rc={rc}/>}
          {activeTab==="profil"&&<ProfilInner user={user} rc={rc} showNotif={showNotif}/>}
        </main>
      </div>

      {selectedBook&&<BookModalFull book={selectedBook} onClose={()=>setSelectedBook(null)} user={user} rc={rc} bookmarkIds={bookmarkIds} toggleBM={toggleBM} showNotif={showNotif} peminjaman={peminjaman} onBorrow={handleBorrow}/>}
    </div>
  );
}

// ─── MAIN APP ───────────────────────────────────────────────────────────────────
export default function App(){
  const [user,setUser]=useState(null);
  const [initLoading,setInitLoading]=useState(true);
  const [showLogin,setShowLogin]=useState(false);
  const [pubBook,setPubBook]=useState(null);
  const [notif,setNotif]=useState(null);
  const [loginLoading,setLoginLoading]=useState(false);

  const showN=(msg,type="success")=>{setNotif({msg,type});setTimeout(()=>setNotif(null),3000);};

  // Set session-expired callback
  useEffect(()=>{
    _onSessionExpired=()=>{
      clearTokens();
      setUser(null);
      showN("Sesi berakhir. Silakan login ulang.","error");
    };
    // Restore session dari storage
    const restore=async()=>{
      if(_access){
        try {
          const res=await api("GET","/auth/me");
          if(res.success) setUser(mapUser(res.data));
          else clearTokens();
        } catch { clearTokens(); }
      }
      setInitLoading(false);
    };
    restore();
    return()=>{ _onSessionExpired=null; };
  },[]);

  const handleLogin=async(data)=>{
    if(!data.nim||!data.password){ showN("NIM dan password wajib diisi.","error"); return; }
    setLoginLoading(true);
    try {
      const res=await api("POST","/auth/login",{nim:data.nim.trim(),password:data.password});
      if(res.success){
        storeTokens(res.data.accessToken,res.data.refreshToken);
        setUser(mapUser(res.data.user));
        setShowLogin(false);
        showN(`Selamat datang, ${res.data.user.name?.split(",")[0]}! 🎉`);
      }
    } catch(e){ showN(e.message||"NIM atau password salah!","error"); }
    finally { setLoginLoading(false); }
  };

  const handleLogout=async()=>{
    try { await api("POST","/auth/logout",{refreshToken:_refresh}); } catch {}
    clearTokens();
    setUser(null);
  };

  if(initLoading) return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16,background:"#f8fafc"}}>
      <div style={{width:52,height:52,borderRadius:14,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26}}>📚</div>
      <Spinner/>
      <p style={{color:"#94a3b8",fontSize:13}}>Memuat Digilib UNISMU...</p>
    </div>
  );

  if(user) return <DashboardApp user={user} onLogout={handleLogout} accessToken={_access}/>;

  return(
    <>
      {notif&&<div style={{position:"fixed",top:20,right:20,zIndex:9999,background:notif.type==="error"?"#ef4444":"#10b981",color:"#fff",padding:"12px 20px",borderRadius:10,boxShadow:"0 8px 30px rgba(0,0,0,0.2)",fontSize:14,fontWeight:500}}>{notif.type==="error"?"❌":"✅"} {notif.msg}</div>}
      <PublicCatalog onLoginClick={()=>setShowLogin(true)} onBookClick={b=>{setPubBook(b);setShowLogin(false);}}/>
      {pubBook&&<PubBookModal book={pubBook} onClose={()=>setPubBook(null)} onLoginClick={()=>{setPubBook(null);setShowLogin(true);}}/>}
      {showLogin&&<LoginModal onClose={()=>setShowLogin(false)} onLogin={handleLogin} notification={notif} loading={loginLoading}/>}
    </>
  );
}

// ─── DASHBOARD INNER COMPONENTS ─────────────────────────────────────────────────
function DashInner({user,books,peminjaman,rc}){
  const [stats,setStats]=useState(null);
  useEffect(()=>{
    api("GET","/laporan/statistik").then(r=>{ if(r.success) setStats(r.data); }).catch(()=>{});
  },[]);

  const totalBuku   = stats?.totalBuku   ?? books.length;
  const totalAnggota= stats?.totalAnggota?? 0;
  const dipinjam    = stats?.statusPeminjaman?.dipinjam ?? peminjaman.filter(p=>p.status==="dipinjam").length;
  const totalPinjam = stats?.totalPeminjaman ?? peminjaman.length;

  return(
    <div>
      <div style={{background:rc.bg,borderRadius:20,padding:"28px 32px",marginBottom:28,color:"#fff",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",right:-20,top:-20,width:150,height:150,borderRadius:"50%",background:"rgba(255,255,255,0.08)"}}/>
        <h2 style={{fontFamily:"'Poppins',sans-serif",fontSize:22,fontWeight:700,marginBottom:6}}>Selamat datang, {user.name?.split(",")[0].split(" ").slice(0,2).join(" ")}! 👋</h2>
        <p style={{fontSize:13,opacity:0.8,marginBottom:12}}>{new Date().toLocaleDateString("id-ID",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p>
        <div style={{display:"flex",gap:8}}><span style={{background:"rgba(255,255,255,0.2)",padding:"4px 12px",borderRadius:20,fontSize:12,border:"1px solid rgba(255,255,255,0.3)"}}>{rc.icon} {rc.label}</span><span style={{background:"rgba(255,255,255,0.2)",padding:"4px 12px",borderRadius:20,fontSize:12,border:"1px solid rgba(255,255,255,0.3)"}}>{user.fakultas}</span></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:28}}>
        {user?.role==="pustakawan_fakultas"&&(user?.fakultas&&user.fakultas!=="-")&&<div style={{gridColumn:"1/-1",padding:"10px 16px",borderRadius:12,background:"#eff6ff",border:"1px solid #bfdbfe",fontSize:13,color:"#1d4ed8",marginBottom:4}}>🏛️ Data ditampilkan untuk <strong>Fakultas {user.fakultas}</strong></div>}
        {[["📚","Total Buku",totalBuku,"#6366f1","#eef2ff"],["🔄","Dipinjam",dipinjam,"#f59e0b","#fffbeb"],["👥","Pengguna",totalAnggota,"#10b981","#ecfdf5"],["📋","Total Transaksi",totalPinjam,"#3b82f6","#eff6ff"]].map(([ic,l,v,c,bg])=>(
          <div key={l} className="hc" style={{background:"#fff",borderRadius:16,padding:20,boxShadow:"0 2px 12px rgba(0,0,0,0.06)",border:"1px solid #f1f5f9"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div><p style={{fontSize:12,color:"#94a3b8",marginBottom:6,fontWeight:500}}>{l}</p><p style={{fontSize:28,fontWeight:800,color:"#1e293b",fontFamily:"'Poppins',sans-serif"}}>{v}</p></div>
              <div style={{width:44,height:44,borderRadius:12,background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{ic}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:20}}>
        <div style={{background:"#fff",borderRadius:16,padding:24,boxShadow:"0 2px 12px rgba(0,0,0,0.06)",border:"1px solid #f1f5f9"}}>
          <h3 style={{fontWeight:700,fontSize:16,color:"#1e293b",marginBottom:20}}>📊 Status Peminjaman</h3>
          {[["Dipinjam",stats?.statusPeminjaman?.dipinjam??0,"#f59e0b"],["Dikembalikan",stats?.statusPeminjaman?.dikembalikan??0,"#10b981"],["Terlambat",stats?.statusPeminjaman?.terlambat??0,"#ef4444"],["Total Denda",`Rp ${(stats?.totalDenda||0).toLocaleString("id-ID")}`,rc.color]].map(([l,v,c])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid #f8fafc"}}><span style={{fontSize:13,color:"#374151"}}>{l}</span><span style={{fontSize:16,fontWeight:700,color:c}}>{v}</span></div>
          ))}
        </div>
        {stats?.topBuku&&<div style={{background:"#fff",borderRadius:16,padding:24,boxShadow:"0 2px 12px rgba(0,0,0,0.06)",border:"1px solid #f1f5f9"}}>
          <h3 style={{fontWeight:700,fontSize:16,color:"#1e293b",marginBottom:20}}>🏆 Top Buku</h3>
          {stats.topBuku.slice(0,5).map((b,i)=>(
            <div key={b.id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
              <div style={{width:24,height:24,borderRadius:"50%",background:i<3?["#fbbf24","#94a3b8","#cd7c3c"][i]:"#f1f5f9",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:i<3?"#fff":"#94a3b8",flexShrink:0}}>{i+1}</div>
              <div style={{flex:1,minWidth:0}}><p style={{fontSize:12,fontWeight:500,color:"#1e293b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{b.title}</p><p style={{fontSize:10,color:"#94a3b8"}}>{(b.downloads||0).toLocaleString()} unduhan</p></div>
            </div>
          ))}
        </div>}
      </div>
    </div>
  );
}

function BerandaInner({user,books,rc,setActiveTab,bookmarkIds,toggleBM,setSelectedBook}){
  const popular=[...books].sort((a,b)=>(b.downloads||0)-(a.downloads||0)).slice(0,4);
  const newest=[...books].filter(b=>b.badge==="Baru").slice(0,4);
  return(
    <div>
      <div style={{background:rc.bg,borderRadius:20,padding:"28px 32px",marginBottom:28,color:"#fff",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",right:-20,top:-20,width:150,height:150,borderRadius:"50%",background:"rgba(255,255,255,0.08)"}}/>
        <h2 style={{fontFamily:"'Poppins',sans-serif",fontSize:26,fontWeight:700,marginBottom:8}}>Halo, {user.name?.split(",")[0].split(" ")[0]}! 👋</h2>
        <p style={{fontSize:14,opacity:0.85,marginBottom:20}}>Temukan ribuan referensi ilmiah di Perpustakaan Digital UNISMU</p>
        <div style={{display:"flex",gap:10}}><button onClick={()=>setActiveTab("koleksi")} style={{background:"rgba(255,255,255,0.2)",border:"1.5px solid rgba(255,255,255,0.4)",color:"#fff",padding:"9px 18px",borderRadius:20,cursor:"pointer",fontSize:13,fontWeight:500}}>📚 Koleksi</button><button onClick={()=>setActiveTab("kartu-anggota")} style={{background:"rgba(255,255,255,0.15)",border:"1.5px solid rgba(255,255,255,0.3)",color:"#fff",padding:"9px 18px",borderRadius:20,cursor:"pointer",fontSize:13,fontWeight:500}}>🪪 Kartu Anggota</button></div>
      </div>
      <h3 style={{fontWeight:700,fontSize:17,color:"#1e293b",marginBottom:14}}>🔥 Terpopuler</h3>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:28}}>{popular.map(b=><DashBookCard key={b.id} book={b} bookmarks={bookmarkIds} toggleBM={toggleBM} onSelect={setSelectedBook}/>)}</div>
      {newest.length>0&&<><h3 style={{fontWeight:700,fontSize:17,color:"#1e293b",marginBottom:14}}>✨ Terbaru</h3><div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14}}>{newest.map(b=><DashBookCard key={b.id} book={b} bookmarks={bookmarkIds} toggleBM={toggleBM} onSelect={setSelectedBook}/>)}</div></>}
    </div>
  );
}

function KoleksiInner({user,books,allBooks,setBooks,rc,bookmarkIds,toggleBM,setSelectedBook,cats,cat,setCat,isAdmin,showNotif,reloadBooks}){
  const EMPTY_BOOK={title:"",author:"",year:"",category:"Sains & Teknologi",pages:"",isbn:"",abstract:"",stok:"",lokasi:"",coverColor1:"#6366f1",coverColor2:"#8b5cf6"};
  const [showAdd,setShowAdd]=useState(false);
  const [showEdit,setShowEdit]=useState(false);
  const [nb,setNb]=useState(EMPTY_BOOK);
  const [editBook,setEditBook]=useState(null);
  const [eb,setEb]=useState(EMPTY_BOOK);
  const [pdfFile,setPdfFile]=useState(null);
  const [coverFile,setCoverFile]=useState(null);       // manual cover
  const [coverPreview,setCoverPreview]=useState(null); // blob URL preview
  const [editPdfFile,setEditPdfFile]=useState(null);
  const [editCoverFile,setEditCoverFile]=useState(null);
  const [editCoverPreview,setEditCoverPreview]=useState(null);
  const [saving,setSaving]=useState(false);
  const [confirmDel,setConfirmDel]=useState(null); // book to delete

  // Auto-generate thumbnail dari halaman pertama PDF menggunakan PDF.js
  const autoThumbnailFromPdf=async(file,setPreview,setCover)=>{
    try {
      const pdfjsLib=window.pdfjsLib;
      if(!pdfjsLib){return;}// PDF.js not loaded
      const ab=await file.arrayBuffer();
      const pdf=await pdfjsLib.getDocument({data:ab}).promise;
      const page=await pdf.getPage(1);
      const vp=page.getViewport({scale:1.5});
      const canvas=document.createElement("canvas");
      canvas.width=vp.width; canvas.height=vp.height;
      await page.render({canvasContext:canvas.getContext("2d"),viewport:vp}).promise;
      canvas.toBlob(async(blob)=>{
        if(!blob)return;
        const preview=URL.createObjectURL(blob);
        setPreview(preview);
        // Convert blob to File object for upload
        const imgFile=new File([blob],file.name.replace(/\.pdf$/i,"-cover.jpg"),{type:"image/jpeg"});
        setCover(imgFile);
      },"image/jpeg",0.88);
    } catch(e){ console.warn("Auto thumbnail gagal:",e.message); }
  };

  const handleAdd=async()=>{
    if(!nb.title||!nb.author){showNotif("Judul dan penulis wajib!","error");return;}
    setSaving(true);
    try {
      const fd=new FormData();
      Object.entries({...nb,year:+nb.year||new Date().getFullYear(),pages:+nb.pages||0,stok:+nb.stok||1}).forEach(([k,v])=>fd.append(k,v));
      if(pdfFile)   fd.append("file",pdfFile);
      if(coverFile) fd.append("cover",coverFile); // auto-generated atau manual
      const res=await apiForm("POST","/books",fd);
      if(res.success){ showNotif("Buku berhasil ditambahkan ✅"); setShowAdd(false); setNb(EMPTY_BOOK); setPdfFile(null); setCoverFile(null); setCoverPreview(null); await reloadBooks(); }
    } catch(e){ showNotif(e.message,"error"); }
    finally{ setSaving(false); }
  };

  const openEdit=(book)=>{
    setEditBook(book);
    setEb({title:book.title||"",author:book.author||"",year:book.year||"",category:book.category||"Sains & Teknologi",pages:book.pages||"",isbn:book.isbn||"",abstract:book.abstract||"",stok:book.stok||"",lokasi:book.lokasi||"",coverColor1:book.cover?.[0]||book.coverColor1||"#6366f1",coverColor2:book.cover?.[1]||book.coverColor2||"#8b5cf6"});
    setEditPdfFile(null); setEditCoverFile(null);
    setEditCoverPreview(book.coverImage||null);
    setShowEdit(true);
  };

  const handleEdit=async()=>{
    if(!eb.title||!eb.author){showNotif("Judul dan penulis wajib!","error");return;}
    setSaving(true);
    try {
      const fd=new FormData();
      Object.entries({...eb,year:+eb.year||new Date().getFullYear(),pages:+eb.pages||0,stok:+eb.stok||1}).forEach(([k,v])=>fd.append(k,v));
      if(editPdfFile)   fd.append("file",editPdfFile);
      if(editCoverFile) fd.append("cover",editCoverFile);
      if(!editCoverPreview&&!editCoverFile) fd.append("removeCover","true");
      const res=await apiForm("PUT",`/books/${editBook.id}`,fd);
      if(res.success){ showNotif("Buku berhasil diperbarui ✅"); setShowEdit(false); setEditBook(null); setEditPdfFile(null); setEditCoverFile(null); setEditCoverPreview(null); await reloadBooks(); }
    } catch(e){ showNotif(e.message,"error"); }
    finally{ setSaving(false); }
  };

  const handleDelete=async()=>{
    if(!confirmDel)return;
    try {
      await api("DELETE",`/books/${confirmDel.id}`);
      showNotif(`Buku "${confirmDel.title}" dihapus`);
      await reloadBooks();
    } catch(e){ showNotif(e.message,"error"); }
    finally{ setConfirmDel(null); }
  };

  const BookFormFields=({data,setData,pdfF,setPdfF,coverF,setCoverF,coverPrev,setCoverPrev,existingFilePath,formId="add"})=>{
    const pdfId=`pdf-inp-${formId}`;
    const covId=`cov-inp-${formId}`;
    const handlePdfChange=async(e)=>{
      const file=e.target.files?.[0]||null;
      setPdfF(file);
      // Auto-generate thumbnail dari halaman 1 PDF
      if(file&&!coverF){
        autoThumbnailFromPdf(file,setCoverPrev,setCoverF);
      }
    };
    const handleCoverChange=(e)=>{
      const file=e.target.files?.[0]||null;
      if(!file)return;
      setCoverF(file);
      const prev=URL.createObjectURL(file);
      setCoverPrev(prev);
    };
    return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        {[["Judul*","title"],["Penulis*","author"],["ISBN","isbn"],["Tahun","year"],["Halaman","pages"],["Stok","stok"],["Lokasi","lokasi"]].map(([l,k])=>(<FF key={k} label={l}><input value={data[k]} onChange={e=>setData(p=>({...p,[k]:e.target.value}))} style={IS} placeholder={l}/></FF>))}
        <FF label="Kategori"><select value={data.category} onChange={e=>setData(p=>({...p,category:e.target.value}))} style={IS}>{cats.slice(1).map(ct=><option key={ct}>{ct}</option>)}</select></FF>
      </div>
      <FF label="Abstrak"><textarea value={data.abstract} onChange={e=>setData(p=>({...p,abstract:e.target.value}))} style={{...IS,height:80,resize:"vertical"}} placeholder="Deskripsi singkat buku"/></FF>

      {/* Cover + Warna dalam satu baris */}
      <div style={{display:"grid",gridTemplateColumns:"auto 1fr",gap:16,alignItems:"flex-start"}}>
        {/* Preview cover */}
        <div style={{width:90,height:120,borderRadius:8,overflow:"hidden",background:`linear-gradient(145deg,${data.coverColor1},${data.coverColor2})`,flexShrink:0,border:"2px solid #e2e8f0",position:"relative",cursor:"pointer"}} onClick={()=>document.getElementById(covId).click()} title="Klik untuk ganti cover">
          {coverPrev&&<img src={coverPrev} alt="cover" style={{width:"100%",height:"100%",objectFit:"cover"}} onError={e=>e.target.style.display="none"}/>}
          <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.3)",display:"flex",alignItems:"center",justifyContent:"center",opacity:0,transition:"opacity 0.2s"}} className="cover-hover-overlay">
            <span style={{color:"#fff",fontSize:11,fontWeight:700}}>Ganti</span>
          </div>
          <style>{`.cover-hover-overlay:hover{opacity:1!important}`}</style>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <FF label="Cover Buku">
            <input id={covId} type="file" accept="image/jpeg,image/png,image/webp" style={{display:"none"}} onChange={handleCoverChange}/>
            <div style={{display:"flex",gap:8}}>
              <button type="button" onClick={()=>document.getElementById(covId).click()} style={{padding:"7px 14px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"#f8fafc",cursor:"pointer",fontSize:12,color:"#374151",fontWeight:500}}>
                {coverPrev?"🖼 Ganti Cover":"📷 Upload Cover"}
              </button>
              {coverPrev&&<button type="button" onClick={()=>{setCoverF(null);setCoverPrev(null);}} style={{padding:"7px 10px",borderRadius:8,border:"1px solid #fecaca",background:"#fee2e2",cursor:"pointer",fontSize:12,color:"#ef4444"}}>✕ Hapus</button>}
            </div>
            {!coverPrev&&<p style={{fontSize:11,color:"#94a3b8",marginTop:4}}>💡 Cover otomatis dari halaman 1 PDF saat upload</p>}
            {coverF&&!coverPrev&&<p style={{fontSize:11,color:"#f59e0b",marginTop:4}}>⏳ Sedang proses thumbnail...</p>}
          </FF>
          <FF label="Warna Gradient (jika tanpa cover)">
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <div style={{display:"flex",gap:8,alignItems:"center"}}><span style={{fontSize:12,color:"#64748b"}}>Warna 1</span><input type="color" value={data.coverColor1} onChange={e=>setData(p=>({...p,coverColor1:e.target.value}))} style={{width:36,height:32,borderRadius:6,border:"1.5px solid #e2e8f0",cursor:"pointer"}}/></div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}><span style={{fontSize:12,color:"#64748b"}}>Warna 2</span><input type="color" value={data.coverColor2} onChange={e=>setData(p=>({...p,coverColor2:e.target.value}))} style={{width:36,height:32,borderRadius:6,border:"1.5px solid #e2e8f0",cursor:"pointer"}}/></div>
            </div>
          </FF>
        </div>
      </div>

      <FF label={existingFilePath?"Upload PDF Baru (Opsional)":"Upload File PDF Ebook"}>
        <div style={{border:"2px dashed #e2e8f0",borderRadius:10,padding:"16px",textAlign:"center",background:"#f8fafc",cursor:"pointer"}} onClick={()=>document.getElementById(pdfId).click()}>
          <input id={pdfId} type="file" accept="application/pdf" style={{display:"none"}} onChange={handlePdfChange}/>
          {pdfF?(
            <div style={{display:"flex",alignItems:"center",gap:8,justifyContent:"center"}}>
              <span style={{fontSize:20}}>📄</span>
              <div style={{textAlign:"left"}}><p style={{fontSize:13,fontWeight:600,color:"#1e293b"}}>{pdfF.name}</p><p style={{fontSize:11,color:"#94a3b8"}}>{(pdfF.size/1024/1024).toFixed(2)} MB</p></div>
              <button onClick={e=>{e.stopPropagation();setPdfF(null);}} style={{marginLeft:8,background:"#fee2e2",border:"none",borderRadius:6,color:"#ef4444",cursor:"pointer",padding:"2px 8px",fontSize:12}}>✕</button>
            </div>
          ):existingFilePath?(
            <div><p style={{fontSize:13,color:"#10b981",fontWeight:600}}>✅ File PDF sudah ada</p><p style={{fontSize:12,color:"#94a3b8"}}>Klik untuk upload ulang/ganti</p></div>
          ):(
            <div><div style={{fontSize:28,marginBottom:6}}>📤</div><p style={{fontSize:13,color:"#64748b"}}>Klik untuk memilih file PDF</p><p style={{fontSize:11,color:"#94a3b8"}}>Maks. 50MB · Cover otomatis dari halaman 1</p></div>
          )}
        </div>
      </FF>
    </div>
  );};

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{cats.map(c=><button key={c} onClick={()=>setCat(c)} style={{padding:"6px 14px",borderRadius:20,border:cat===c?"none":"1.5px solid #e2e8f0",background:cat===c?rc.color:"#fff",color:cat===c?"#fff":"#64748b",cursor:"pointer",fontSize:12,fontWeight:cat===c?600:400,transition:"all 0.2s"}}>{c}</button>)}</div>
        {isAdmin&&<button onClick={()=>{setNb(EMPTY_BOOK);setPdfFile(null);setShowAdd(true);}} style={{padding:"9px 18px",borderRadius:10,border:"none",background:`linear-gradient(135deg,${rc.color},${rc.color}cc)`,color:"#fff",cursor:"pointer",fontSize:13,fontWeight:600}}>+ Tambah Buku</button>}
      </div>
      <p style={{fontSize:13,color:"#94a3b8",marginBottom:18}}>{books.length} koleksi</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:16}}>
        {books.map(b=><DashBookCard key={b.id} book={b} bookmarks={bookmarkIds} toggleBM={toggleBM} onSelect={setSelectedBook} isAdmin={isAdmin} onEdit={openEdit} onDelete={(bk)=>setConfirmDel(bk)}/>)}
      </div>
      {books.length===0&&<EmptyState icon="📭" msg="Tidak ada buku" sub="Coba filter berbeda"/>}

      {/* Modal Tambah Buku */}
      {showAdd&&<ModalWrap title="➕ Tambah Buku Baru" onClose={()=>setShowAdd(false)} maxWidth={680}>
        <BookFormFields data={nb} setData={setNb} pdfF={pdfFile} setPdfF={setPdfFile} coverF={coverFile} setCoverF={setCoverFile} coverPrev={coverPreview} setCoverPrev={setCoverPreview} existingFilePath={null} formId="add"/>
        <div style={{display:"flex",gap:10,marginTop:20}}>
          <button onClick={handleAdd} disabled={saving} style={{flex:1,padding:"12px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",cursor:saving?"not-allowed":"pointer",fontWeight:700,fontSize:14,opacity:saving?0.7:1}}>{saving?"⏳ Menyimpan...":"💾 Simpan Buku"}</button>
          <button onClick={()=>setShowAdd(false)} style={{flex:1,padding:"12px",borderRadius:10,border:"1.5px solid #e2e8f0",background:"#fff",cursor:"pointer",color:"#64748b"}}>Batal</button>
        </div>
      </ModalWrap>}

      {/* Modal Edit Buku */}
      {showEdit&&editBook&&<ModalWrap title={`✏️ Edit: ${editBook.title?.substring(0,40)}${editBook.title?.length>40?"...":""}`} onClose={()=>{setShowEdit(false);setEditBook(null);}} maxWidth={680}>
        <BookFormFields data={eb} setData={setEb} pdfF={editPdfFile} setPdfF={setEditPdfFile} coverF={editCoverFile} setCoverF={setEditCoverFile} coverPrev={editCoverPreview} setCoverPrev={setEditCoverPreview} existingFilePath={editBook.filePath} formId="edit"/>
        <div style={{display:"flex",gap:10,marginTop:20}}>
          <button onClick={handleEdit} disabled={saving} style={{flex:1,padding:"12px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#f59e0b,#d97706)",color:"#fff",cursor:saving?"not-allowed":"pointer",fontWeight:700,fontSize:14,opacity:saving?0.7:1}}>{saving?"⏳ Memperbarui...":"✏️ Update Buku"}</button>
          <button onClick={()=>{setShowEdit(false);setEditBook(null);}} style={{flex:1,padding:"12px",borderRadius:10,border:"1.5px solid #e2e8f0",background:"#fff",cursor:"pointer",color:"#64748b"}}>Batal</button>
        </div>
      </ModalWrap>}

      {/* Confirm Delete Dialog */}
      {confirmDel&&<ConfirmDialog
        title="Hapus Buku?"
        msg={`Buku "${confirmDel.title}" akan dihapus dari sistem. Tindakan ini tidak dapat dibatalkan.`}
        icon="📕"
        confirmText="Ya, Hapus Buku"
        confirmColor="#ef4444"
        onConfirm={handleDelete}
        onCancel={()=>setConfirmDel(null)}
      />}
    </div>
  );
}

function PinjamAdmin({peminjaman,setPeminjaman,books,rc,showNotif,reloadPeminjaman,user}){
  const sCol={dipinjam:"#f59e0b",dikembalikan:"#10b981",terlambat:"#ef4444",hilang:"#8b5cf6"};
  const [filter,setFilter]=useState("semua");

  const handleRet=async(id)=>{
    try {
      const res=await api("PUT",`/peminjaman/${id}/kembalikan`);
      if(res.success){ showNotif("Pengembalian berhasil ✅"); await reloadPeminjaman(); }
    } catch(e){ showNotif(e.message,"error"); }
  };

  const filtered=filter==="semua"?peminjaman:peminjaman.filter(p=>p.status===filter);

  return(
    <div>
      {user?.role==="pustakawan_fakultas"&&(user?.fakultas&&user.fakultas!=="-")&&<div style={{marginBottom:16,padding:"10px 16px",borderRadius:12,background:"#eff6ff",border:"1px solid #bfdbfe",fontSize:13,color:"#1d4ed8"}}>🏛️ Menampilkan peminjaman anggota <strong>Fakultas {user.fakultas}</strong></div>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:24}}>
        {[["🔄","Dipinjam",peminjaman.filter(p=>p.status==="dipinjam").length,"#f59e0b"],["✅","Dikembalikan",peminjaman.filter(p=>p.status==="dikembalikan").length,"#10b981"],["⚠️","Terlambat",peminjaman.filter(p=>p.status==="terlambat").length,"#ef4444"],["📋","Total",peminjaman.length,"#6366f1"]].map(([ic,l,v,c])=>(
          <div key={l} style={{background:"#fff",borderRadius:14,padding:"18px 20px",boxShadow:"0 2px 8px rgba(0,0,0,0.06)",border:"1px solid #f1f5f9",display:"flex",alignItems:"center",gap:14}}>
            <div style={{width:44,height:44,borderRadius:12,background:`${c}15`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{ic}</div>
            <div><p style={{fontSize:12,color:"#94a3b8"}}>{l}</p><p style={{fontSize:24,fontWeight:800,color:c,fontFamily:"'Poppins',sans-serif"}}>{v}</p></div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
        {[["semua","Semua"],["dipinjam","Dipinjam"],["terlambat","Terlambat"],["dikembalikan","Dikembalikan"]].map(([k,l])=>(
          <button key={k} onClick={()=>setFilter(k)} style={{padding:"5px 12px",borderRadius:20,border:filter===k?"none":"1.5px solid #e2e8f0",background:filter===k?rc.color:"#fff",color:filter===k?"#fff":"#64748b",cursor:"pointer",fontSize:12,fontWeight:filter===k?600:400}}>{l}</button>
        ))}
      </div>
      <div style={{background:"#fff",borderRadius:16,boxShadow:"0 2px 10px rgba(0,0,0,0.06)",border:"1px solid #f1f5f9",overflow:"hidden"}}>
        <div style={{padding:"16px 24px",borderBottom:"1px solid #f1f5f9"}}><h3 style={{fontWeight:700,fontSize:16,color:"#1e293b"}}>📋 Data Peminjaman</h3></div>
        {filtered.length===0?<EmptyState icon="📭" msg="Tidak ada data" sub="Belum ada peminjaman"/>:(
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{background:"#f8fafc"}}>{["#","Buku","Peminjam","Tgl Pinjam","Kembali","Status","Token","Aksi"].map(h=><th key={h} style={{padding:"11px 14px",textAlign:"left",fontSize:11,fontWeight:600,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.04em",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
            <tbody>
              {filtered.map(p=>{
                const book=p.book||books.find(b=>b.id===p.bookId);
                const uName=p.user?.name||"—";
                const isExpired=p.expiryDate&&new Date()>new Date(p.expiryDate);
                return(
                  <tr key={p.id} style={{borderTop:"1px solid #f1f5f9"}}>
                    <td style={{padding:"12px 14px",fontSize:13,color:"#94a3b8"}}>{p.id}</td>
                    <td style={{padding:"12px 14px",fontSize:13,color:"#1e293b",fontWeight:500,maxWidth:180}}><span style={{display:"-webkit-box",WebkitLineClamp:1,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{book?.title||`#${p.bookId}`}</span></td>
                    <td style={{padding:"12px 14px",fontSize:13,color:"#374151",whiteSpace:"nowrap"}}>{uName.split(",")[0]}</td>
                    <td style={{padding:"12px 14px",fontSize:12,color:"#64748b",whiteSpace:"nowrap"}}>{p.tanggalPinjam?.split("T")[0]||"-"}</td>
                    <td style={{padding:"12px 14px",fontSize:12,color:"#64748b",whiteSpace:"nowrap"}}>{p.tanggalKembali?.split("T")[0]||"-"}</td>
                    <td style={{padding:"12px 14px"}}><span style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600,background:`${sCol[p.status]||"#6366f1"}20`,color:sCol[p.status]||"#6366f1",whiteSpace:"nowrap"}}>{p.status}</span></td>
                    <td style={{padding:"12px 14px"}}>{p.token?<span style={{padding:"3px 8px",borderRadius:6,fontSize:10,fontFamily:"monospace",background:isExpired?"#fee2e2":"#ecfdf5",color:isExpired?"#ef4444":"#10b981",fontWeight:600}}>{isExpired?"⏰ Expired":"✅ Aktif"}</span>:<span style={{fontSize:11,color:"#94a3b8"}}>-</span>}</td>
                    <td style={{padding:"12px 14px",whiteSpace:"nowrap"}}>
                      {p.status==="dipinjam"&&<button onClick={()=>handleRet(p.id)} style={{padding:"5px 10px",borderRadius:6,border:"none",background:"#10b98115",color:"#10b981",cursor:"pointer",fontSize:11,fontWeight:600,marginRight:4}}>Kembalikan</button>}
                      {p.denda>0&&!p.dendaDibayar&&<button onClick={async()=>{try{await api("PUT",`/peminjaman/${p.id}/bayar-denda`);setPeminjaman(prev=>prev.map(x=>x.id===p.id?{...x,dendaDibayar:true}:x));showNotif("Denda lunas ✅");}catch(e){showNotif(e.message,"error");}}} style={{padding:"5px 10px",borderRadius:6,border:"none",background:"#f59e0b15",color:"#d97706",cursor:"pointer",fontSize:11,fontWeight:600}}>💰 Bayar Denda</button>}
                      {p.denda>0&&p.dendaDibayar&&<span style={{fontSize:10,color:"#10b981",fontWeight:600}}>✅ Lunas</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>)}
      </div>
    </div>
  );
}

function PinjamSaya({user,peminjaman,books,rc,showNotif,setSelectedBook}){
  const sCol={dipinjam:"#f59e0b",dikembalikan:"#10b981",terlambat:"#ef4444"};
  if(!peminjaman.length)return<EmptyState icon="📋" msg="Belum ada peminjaman" sub="Pinjam buku dari koleksi"/>;
  return(
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:14}}>
      {peminjaman.map(p=>{
        const book=p.book||books.find(b=>b.id===p.bookId);
        const sisa=p.expiryDate?daysLeft(p.expiryDate):null;
        const exp=sisa!==null&&sisa<0;
        const cover=book?.cover||[book?.coverColor1||"#6366f1",book?.coverColor2||"#8b5cf6"];
        return(
          <div key={p.id} className="hc" style={{background:"#fff",borderRadius:14,padding:20,boxShadow:"0 2px 10px rgba(0,0,0,0.06)",border:"1px solid #f1f5f9"}}>
            <div style={{display:"flex",gap:14,marginBottom:14}}>
              <div style={{width:50,height:66,borderRadius:8,background:`linear-gradient(135deg,${cover[0]},${cover[1]})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>📖</div>
              <div><h4 style={{fontWeight:600,fontSize:14,color:"#1e293b",lineHeight:1.5,marginBottom:4}}>{book?.title||`Buku #${p.bookId}`}</h4><p style={{fontSize:12,color:"#94a3b8"}}>{book?.author?.split(",")[0]}</p></div>
            </div>
            {p.token&&<div style={{background:exp?"#fef2f2":"#f0fdf4",border:`1px solid ${exp?"#fecaca":"#bbf7d0"}`,borderRadius:10,padding:"10px 12px",marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <span style={{fontSize:11,fontWeight:700,color:exp?"#991b1b":"#14532d"}}>{exp?"⏰ Token Kedaluwarsa":"🔑 Token Aktif"}</span>
                {sisa!==null&&!exp&&<span style={{fontSize:11,color:"#166534",fontWeight:600}}>Sisa {sisa} hari</span>}
              </div>
              <div style={{fontFamily:"monospace",fontSize:9,color:exp?"#ef4444":"#15803d",wordBreak:"break-all"}}>{p.token.substring(0,46)}...</div>
            </div>}
            {p.denda>0&&<div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"8px 12px",marginBottom:10,fontSize:12,color:"#991b1b",fontWeight:600}}>⚠️ Denda: Rp {p.denda.toLocaleString("id-ID")}</div>}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
              <span style={{padding:"4px 12px",borderRadius:20,fontSize:12,fontWeight:600,background:`${sCol[p.status]||"#94a3b8"}15`,color:sCol[p.status]||"#94a3b8"}}>{p.status}</span>
              {p.status==="dipinjam"&&book&&<button onClick={()=>setSelectedBook(book)} style={{padding:"6px 12px",borderRadius:8,border:"none",background:`${rc.color}15`,color:rc.color,cursor:"pointer",fontSize:12,fontWeight:600}}>{exp?"🔒 Berakhir":"🔐 Buka Buku"}</button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function UserPage({rc,showNotif,user}){
  const [users,setUsers]=useState([]);
  const [loading,setLoading]=useState(true);
  const [showAdd,setShowAdd]=useState(false);
  const [fakultasData,setFakultasData]=useState([]);
  const [selFak,setSelFak]=useState("");
  const [saving,setSaving]=useState(false);
  const [form,setForm]=useState({name:"",nim:"",password:"",role:"",tipe:"",email:"",phone:"",fakultasId:"",prodiId:"",angkatan:""});
  const [confirmDelUser,setConfirmDelUser]=useState(null);
  const [resetPassTarget,setResetPassTarget]=useState(null);
  const [resetPassNewPw,setResetPassNewPw]=useState("");
  const [showAddPustakawan,setShowAddPustakawan]=useState(false);
  const [formPus,setFormPus]=useState({name:"",nim:"",password:"",role:"pustakawan_fakultas",email:"",phone:"",fakultasId:""});
  const isUnivUser=user?.role==="pustakawan_universitas";

  useEffect(()=>{
    const load=async()=>{
      try {
        const [uRes,fRes]=await Promise.all([api("GET","/users?limit=200"),api("GET","/fakultas")]);
        if(uRes.success) setUsers(uRes.data.map(mapUser));
        if(fRes.success) setFakultasData(fRes.data);
      } catch(e){ showNotif("Gagal memuat data: "+e.message,"error"); }
      finally{ setLoading(false); }
    };
    load();
  },[]);

  const prodiList=fakultasData.find(f=>String(f.id)===String(selFak))?.prodi||[];

  const addUser=async()=>{
    if(!form.role){showNotif("Pilih jenis anggota terlebih dahulu!","error");return;}
    if(!form.name||!form.nim||!form.password){showNotif("Nama, NIM & password wajib!","error");return;}
    setSaving(true);
    try {
      // Map pseudo-role ke role+tipe sebenarnya
      const roleMap={mahasiswa:{role:"mahasiswa",tipe:null},umum_dosen:{role:"umum",tipe:"Dosen"},umum_tendik:{role:"umum",tipe:"Tenaga_Kependidikan"},umum_masyarakat:{role:"umum",tipe:"Masyarakat"}};
      const mapped=roleMap[form.role]||{role:"mahasiswa",tipe:null};
      const payload={...form,
        role:mapped.role,
        tipe:mapped.tipe||undefined,
        fakultasId:form.fakultasId?+form.fakultasId:undefined,
        prodiId:form.prodiId?+form.prodiId:undefined,
        angkatan:form.angkatan||undefined,
      };
      const res=await api("POST","/users",payload);
      if(res.success){
        setUsers(p=>[...p,mapUser(res.data)]);
        setShowAdd(false);
        setForm({name:"",nim:"",password:"",role:"",tipe:"",email:"",phone:"",fakultasId:"",prodiId:"",angkatan:""});
        setSelFak("");
        showNotif("Anggota ditambahkan ✅");
      }
    } catch(e){ showNotif(e.message,"error"); }
    finally{ setSaving(false); }
  };

  const addPustakawan=async()=>{
    if(!formPus.name||!formPus.nim||!formPus.password){showNotif("Nama, NIM & password wajib!","error");return;}
    if(formPus.role==="pustakawan_fakultas"&&!formPus.fakultasId){showNotif("Pilih Fakultas untuk Pustakawan Fakultas!","error");return;}
    setSaving(true);
    try {
      const res=await api("POST","/users",{...formPus,fakultasId:formPus.fakultasId?+formPus.fakultasId:undefined});
      if(res.success){
        setUsers(p=>[...p,mapUser(res.data)]);
        setShowAddPustakawan(false);
        setFormPus({name:"",nim:"",password:"",role:"pustakawan_fakultas",email:"",phone:"",fakultasId:""});
        showNotif("Pustakawan ditambahkan ✅");
      }
    } catch(e){ showNotif(e.message,"error"); }
    finally{ setSaving(false); }
  };

  const delUser=async()=>{
    if(!confirmDelUser)return;
    try {
      await api("DELETE",`/users/${confirmDelUser.id}`);
      setUsers(p=>p.filter(u=>u.id!==confirmDelUser.id));
      showNotif("Anggota dihapus");
    } catch(e){ showNotif(e.message,"error"); }
    finally{ setConfirmDelUser(null); }
  };

  if(loading)return<Spinner/>;

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div><h3 style={{fontWeight:700,fontSize:17,color:"#1e293b"}}>Manajemen Pengguna{user?.role==="pustakawan_fakultas"?<span style={{marginLeft:8,fontSize:13,fontWeight:500,color:"#0ea5e9"}}>— Fakultas {user?.fakultas}</span>:""}</h3><p style={{fontSize:13,color:"#94a3b8",marginTop:2}}>{users.length} pengguna terdaftar{user?.role==="pustakawan_fakultas"?" di fakultas Anda":""}</p></div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setShowAdd(true)} className="bg" style={{padding:"9px 18px",borderRadius:10,border:"none",background:`linear-gradient(135deg,${rc.color},${rc.color}cc)`,color:"#fff",cursor:"pointer",fontSize:13,fontWeight:600}}>+ Tambah Member</button>
          {user?.role==="pustakawan_universitas"&&<button onClick={()=>setShowAddPustakawan(true)} className="bg" style={{padding:"9px 18px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#8b5cf6,#6366f1)",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:600}}>+ Tambah Pustakawan</button>}
        </div>
      </div>
      <div style={{background:"#fff",borderRadius:16,boxShadow:"0 2px 10px rgba(0,0,0,0.06)",border:"1px solid #f1f5f9",overflow:"hidden"}}>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{background:"#f8fafc"}}>{["","Nama","NIM/NIP","Role","Fakultas","Prodi","QR","Aksi"].map(h=><th key={h} style={{padding:"12px 14px",textAlign:"left",fontSize:11,fontWeight:600,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.04em",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
            <tbody>
              {users.map(u=>{
                const role=ROLE_CONFIG[u.role]||ROLE_CONFIG.umum;
                return(
                  <tr key={u.id} style={{borderTop:"1px solid #f1f5f9"}}>
                    <td style={{padding:"12px 14px",fontSize:22}}>{u.avatar}</td>
                    <td style={{padding:"12px 14px",fontSize:13,fontWeight:500,color:"#1e293b",minWidth:180}}>{u.name?.split(",")[0]}<br/><span style={{fontSize:11,color:"#94a3b8",fontWeight:400}}>{u.email}</span></td>
                    <td style={{padding:"12px 14px",fontSize:13,color:"#64748b",fontFamily:"monospace"}}>{u.nim}</td>
                    <td style={{padding:"12px 14px"}}><span style={{padding:"4px 10px",borderRadius:20,fontSize:11,fontWeight:600,background:`${role.color}15`,color:role.color,whiteSpace:"nowrap"}}>{role.icon} {u.role==="umum"?(u.tipe||"Umum"):role.label}{u.role==="pustakawan_fakultas"&&u.fakultas&&u.fakultas!=="-"?<span style={{marginLeft:4,opacity:0.7}}>({u.fakultas.replace(/^Fakultas /i,"").split(" ").slice(-2).join(" ")})</span>:""}</span></td>
                    <td style={{padding:"12px 14px",fontSize:12,color:"#374151",minWidth:140}}>{u.fakultas&&u.fakultas!=="-"?u.fakultas:<span style={{color:"#94a3b8"}}>-</span>}</td>
                    <td style={{padding:"12px 14px",fontSize:12,minWidth:140}}>{u.prodi&&u.prodi!=="-"?<span style={{background:"#eef2ff",color:"#4f46e5",padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:500}}>{u.prodi}</span>:<span style={{color:"#94a3b8"}}>-</span>}</td>
                    <td style={{padding:"12px 14px"}}><div style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:6,padding:4,display:"inline-block"}}><QRCode data={`UNISMU|${u.nim}|${u.name}|${u.role}`} size={40} fg="#1e293b" bg="#f8fafc"/></div></td>
                    <td style={{padding:"12px 14px"}}>
                      {resetPassTarget&&resetPassTarget.id===u.id&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setResetPassTarget(null)}>
                          <div style={{background:"#fff",borderRadius:16,padding:24,width:320,boxShadow:"0 8px 40px rgba(0,0,0,0.2)"}} onClick={e=>e.stopPropagation()}>
                            <h4 style={{fontWeight:700,fontSize:15,marginBottom:16,color:"#1e293b"}}>🔑 Reset Password — {resetPassTarget.name?.split(",")[0]}</h4>
                            <PasswordInput value={resetPassNewPw} onChange={e=>setResetPassNewPw(e.target.value)} placeholder="Password baru (min 8 karakter)"/>
                            <div style={{display:"flex",gap:8,marginTop:12}}>
                              <button onClick={async()=>{if(!resetPassNewPw||resetPassNewPw.length<8){showNotif("Min. 8 karakter","error");return;}try{await api("PUT",`/users/${resetPassTarget.id}/reset-password`,{newPassword:resetPassNewPw});showNotif("Password direset ✅");setResetPassTarget(null);setResetPassNewPw("");}catch(e){showNotif(e.message,"error");}}} style={{...BtnStyle("#f59e0b"),flex:1}}>Reset</button>
                              <button onClick={()=>{setResetPassTarget(null);setResetPassNewPw("");}} style={{flex:1,padding:"10px",borderRadius:10,border:"1.5px solid #e2e8f0",background:"#fff",cursor:"pointer",color:"#64748b"}}>Batal</button>
                            </div>
                          </div>
                        </div>}
                      <button onClick={()=>setResetPassTarget(u)} style={{padding:"5px 10px",borderRadius:6,border:"1.5px solid #e2e8f0",background:"#f8fafc",cursor:"pointer",fontSize:12,color:"#64748b",marginRight:4}}>🔑 Reset PW</button>
                      <button onClick={()=>setConfirmDelUser(u)} style={{padding:"5px 10px",borderRadius:6,border:"none",background:"#fee2e2",cursor:"pointer",fontSize:12,color:"#ef4444"}}>Hapus</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd&&<ModalWrap title="➕ Tambah Anggota Baru" onClose={()=>setShowAdd(false)}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <FF label="Nama Lengkap*"><input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} style={IS} placeholder="Nama lengkap"/></FF>
          <FF label="NIM / NIP / ID*"><input value={form.nim} onChange={e=>setForm(p=>({...p,nim:e.target.value}))} style={IS} placeholder="NIM / NIP"/></FF>
          <FF label="Password*"><PasswordInput value={form.password} onChange={e=>setForm(p=>({...p,password:e.target.value}))} placeholder="Min. 8 karakter"/></FF>
          <FF label="Jenis Anggota">
            <select value={form.role} onChange={e=>setForm(p=>({...p,role:e.target.value,tipe:""}))} style={IS}>
              <option value="" disabled>-- Pilih Jenis --</option>
              <option value="mahasiswa">👨‍🎓 Mahasiswa</option>
              <option value="umum_dosen">👨‍🏫 Dosen</option>
              <option value="umum_tendik">🏢 Tenaga Kependidikan</option>
              <option value="umum_masyarakat">👤 Masyarakat Umum</option>
            </select>
          </FF>
          <FF label="Fakultas">
            <select value={selFak} onChange={e=>{setSelFak(e.target.value);setForm(p=>({...p,fakultasId:e.target.value,prodiId:""}))}} style={IS}>
              <option value="">-- Pilih Fakultas --</option>
              {fakultasData.map(f=><option key={f.id} value={f.id}>{f.nama}</option>)}
            </select>
          </FF>
          <FF label="Program Studi">
            <select value={form.prodiId} onChange={e=>setForm(p=>({...p,prodiId:e.target.value}))} style={IS} disabled={!selFak}>
              <option value="">-- Pilih Prodi --</option>
              {prodiList.map(p=><option key={p.id} value={p.id}>{p.jenjang} {p.nama.replace(/^(S1|S2|S3|D3|D4)\s/,"")}</option>)}
            </select>
          </FF>
          {form.role==="mahasiswa"&&<FF label="Angkatan"><input value={form.angkatan} onChange={e=>setForm(p=>({...p,angkatan:e.target.value}))} style={IS} placeholder="2023"/></FF>}
          {form.role==="pustakawan_fakultas"&&<div style={{gridColumn:"1/-1",padding:"8px 14px",borderRadius:10,background:"#eff6ff",border:"1px solid #bfdbfe",fontSize:12,color:"#1d4ed8"}}>🏛️ <strong>Pustakawan Fakultas</strong> — wajib memilih Fakultas. Akun ini hanya dapat mengelola anggota & peminjaman di fakultas yang dipilih.</div>}
          <FF label="Email"><input value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} style={IS} placeholder="email@example.com"/></FF>
          <FF label="No. HP"><input value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} style={IS} placeholder="08xxxxxxxxxx"/></FF>
        </div>
        <div style={{display:"flex",gap:8,marginTop:16}}>
          <button onClick={addUser} disabled={saving} style={{...BtnStyle("#6366f1"),flex:1,opacity:saving?0.6:1}}>{saving?"Menyimpan...":"Simpan Anggota"}</button>
          <button onClick={()=>setShowAdd(false)} style={{flex:1,padding:"10px",borderRadius:10,border:"1.5px solid #e2e8f0",background:"#fff",cursor:"pointer",color:"#64748b"}}>Batal</button>
        </div>
      </ModalWrap>}

      {showAddPustakawan&&<ModalWrap title="🏛️ Tambah Pustakawan" onClose={()=>setShowAddPustakawan(false)}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <FF label="Nama Lengkap*"><input value={formPus.name} onChange={e=>setFormPus(p=>({...p,name:e.target.value}))} style={IS} placeholder="Nama pustakawan"/></FF>
          <FF label="NIM / NIP / ID*"><input value={formPus.nim} onChange={e=>setFormPus(p=>({...p,nim:e.target.value}))} style={IS} placeholder="ID unik"/></FF>
          <FF label="Password*"><PasswordInput value={formPus.password} onChange={e=>setFormPus(p=>({...p,password:e.target.value}))} placeholder="Min. 8 karakter"/></FF>
          <FF label="Jenis Pustakawan">
            <select value={formPus.role} onChange={e=>setFormPus(p=>({...p,role:e.target.value}))} style={IS}>
              <option value="pustakawan_fakultas">🏛️ Pustakawan Fakultas</option>
              <option value="pustakawan_universitas">🎓 Pustakawan Universitas</option>
            </select>
          </FF>
          {formPus.role==="pustakawan_fakultas"&&<FF label="Fakultas*">
            <select value={formPus.fakultasId} onChange={e=>setFormPus(p=>({...p,fakultasId:e.target.value}))} style={IS}>
              <option value="">-- Pilih Fakultas --</option>
              {fakultasData.map(f=><option key={f.id} value={f.id}>{f.nama}</option>)}
            </select>
          </FF>}
          <FF label="Email"><input value={formPus.email} onChange={e=>setFormPus(p=>({...p,email:e.target.value}))} style={IS} placeholder="email@unismu.ac.id"/></FF>
          {formPus.role==="pustakawan_fakultas"&&<div style={{gridColumn:"1/-1",padding:"8px 14px",borderRadius:10,background:"#f0fdf4",border:"1px solid #bbf7d0",fontSize:12,color:"#14532d"}}>🏛️ Pustakawan Fakultas hanya mengelola koleksi dan anggota di fakultasnya.</div>}
          {formPus.role==="pustakawan_universitas"&&<div style={{gridColumn:"1/-1",padding:"8px 14px",borderRadius:10,background:"#eef2ff",border:"1px solid #c7d2fe",fontSize:12,color:"#3730a3"}}>🎓 Pustakawan Universitas memiliki akses penuh ke seluruh sistem termasuk pengaturan.</div>}
        </div>
        <div style={{display:"flex",gap:8,marginTop:16}}>
          <button onClick={addPustakawan} disabled={saving} style={{...BtnStyle("#8b5cf6"),flex:1,opacity:saving?0.6:1}}>{saving?"Menyimpan...":"Simpan Pustakawan"}</button>
          <button onClick={()=>setShowAddPustakawan(false)} style={{flex:1,padding:"10px",borderRadius:10,border:"1.5px solid #e2e8f0",background:"#fff",cursor:"pointer",color:"#64748b"}}>Batal</button>
        </div>
      </ModalWrap>}

      {confirmDelUser&&<ConfirmDialog
        title="Hapus Anggota?"
        msg={`Akun "${confirmDelUser.name?.split(",")[0]}" (${confirmDelUser.nim}) akan dihapus permanen.`}
        icon="👤"
        confirmText="Ya, Hapus Anggota"
        confirmColor="#ef4444"
        onConfirm={delUser}
        onCancel={()=>setConfirmDelUser(null)}
      />}
    </div>
  );
}({books,peminjaman,rc}){
  const [stats,setStats]=useState(null);
  const [perBulan,setPerBulan]=useState(Array(12).fill(0));

  useEffect(()=>{
    api("GET","/laporan/statistik").then(r=>{ if(r.success) setStats(r.data); }).catch(()=>{});
    api("GET","/laporan/peminjaman-per-bulan").then(r=>{ if(r.success) setPerBulan(r.data.perBulan||Array(12).fill(0)); }).catch(()=>{});
  },[]);

  const isFakLaporan=user?.role==="pustakawan_fakultas";
  const fakNamaLaporan=stats?.scopedFakultasNama||user?.fakultas||"";
  const top=stats?.topBuku||[...books].sort((a,b)=>(b.downloads||0)-(a.downloads||0)).slice(0,5);
  const maxD=Math.max(...perBulan,1);

  const exportCSV=async(type)=>{
    try {
      const res=await fetch(`${API_BASE}/laporan/export/${type}`,{headers:{Authorization:`Bearer ${_access}`}});
      if(!res.ok) throw new Error("Export gagal");
      const blob=await res.blob();
      const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`export-${type}.xlsx`; a.click();
    } catch(e) { alert("Export gagal: "+e.message); }
  };

  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>
        <div style={{background:"#fff",borderRadius:16,padding:24,boxShadow:"0 2px 10px rgba(0,0,0,0.06)",border:"1px solid #f1f5f9"}}>
          <h3 style={{fontWeight:700,fontSize:16,color:"#1e293b",marginBottom:20}}>🏆 Buku Terpopuler</h3>
          {top.slice(0,5).map((b,i)=>(
            <div key={b.id||i} style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
              <div style={{width:28,height:28,borderRadius:"50%",background:i<3?["#fbbf24","#94a3b8","#cd7c3c"][i]:"#f1f5f9",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:i<3?"#fff":"#94a3b8",flexShrink:0}}>{i+1}</div>
              <div style={{flex:1,minWidth:0}}><p style={{fontSize:13,fontWeight:500,color:"#1e293b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{b.title}</p><p style={{fontSize:11,color:"#94a3b8"}}>{(b.downloads||0).toLocaleString()} unduhan</p></div>
            </div>
          ))}
        </div>
        <div style={{background:"#fff",borderRadius:16,padding:24,boxShadow:"0 2px 10px rgba(0,0,0,0.06)",border:"1px solid #f1f5f9"}}>
          <h3 style={{fontWeight:700,fontSize:16,color:"#1e293b",marginBottom:20}}>📊 Rekap</h3>
          {[[" Total Peminjaman",stats?.totalPeminjaman??peminjaman.length,"#6366f1"],["Dipinjam",stats?.statusPeminjaman?.dipinjam??0,"#f59e0b"],["Dikembalikan",stats?.statusPeminjaman?.dikembalikan??0,"#10b981"],["Terlambat",stats?.statusPeminjaman?.terlambat??0,"#ef4444"],["Total Denda",`Rp ${(stats?.totalDenda||0).toLocaleString("id-ID")}`,rc.color]].map(([l,v,c])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid #f8fafc"}}><span style={{fontSize:14,color:"#374151"}}>{l}</span><span style={{fontSize:16,fontWeight:700,color:c}}>{v}</span></div>
          ))}
        </div>
      </div>
      <div style={{background:"#fff",borderRadius:16,padding:24,boxShadow:"0 2px 10px rgba(0,0,0,0.06)",border:"1px solid #f1f5f9",marginBottom:20}}>
        <h3 style={{fontWeight:700,fontSize:16,color:"#1e293b",marginBottom:20}}>📅 Peminjaman per Bulan</h3>
        <div style={{display:"flex",alignItems:"flex-end",gap:8,height:100}}>
          {perBulan.map((v,i)=>(
            <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
              <div style={{width:"100%",background:`linear-gradient(180deg,${rc.color},${rc.color}80)`,borderRadius:"4px 4px 0 0",height:`${(v/maxD)*90}px`,minHeight:v>0?4:0,transition:"height 0.5s"}}/>
              <span style={{fontSize:9,color:"#94a3b8"}}>{"JFMAMJJASOND"[i]}</span>
            </div>
          ))}
        </div>
      </div>
      {isFakLaporan&&fakNamaLaporan&&<div style={{marginBottom:16,padding:"10px 16px",borderRadius:12,background:"#eff6ff",border:"1px solid #bfdbfe",fontSize:13,color:"#1d4ed8",display:"flex",alignItems:"center",gap:8}}>🏛️ <strong>Laporan Fakultas:</strong> {fakNamaLaporan}</div>}
      <div style={{background:"#fff",borderRadius:16,padding:24,boxShadow:"0 2px 10px rgba(0,0,0,0.06)",border:"1px solid #f1f5f9"}}>
        <h3 style={{fontWeight:700,fontSize:16,color:"#1e293b",marginBottom:16}}>💾 Ekspor Data</h3>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
          {[["📚","Buku","buku","#6366f1"],["🔄","Peminjaman","peminjaman","#10b981"],["👥","Anggota","anggota","#f59e0b"]].map(([ic,l,type,c])=>(
            <button key={type} onClick={()=>exportCSV(type)} style={{...BtnStyle(c),display:"flex",alignItems:"center",gap:8,justifyContent:"center"}}>{ic} Ekspor {l}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SettingsKepala({rc,showNotif,books,peminjaman}){
  const [sub,setSub]=useState("umum");
  const [settings,setSettings]=useState(null);
  const [loading,setLoading]=useState(true);
  const [aktLog,setAktLog]=useState([]);
  const [fakultasData,setFakultasData]=useState([]);
  const [journals,setJournals]=useState([]);

  useEffect(()=>{
    const load=async()=>{
      try {
        const [sRes,lRes,fRes,jRes]=await Promise.all([
          api("GET","/settings"),
          api("GET","/log"),
          api("GET","/fakultas"),
          api("GET","/jurnal"),
        ]);
        if(sRes.success) setSettings(parseSettings(sRes.data));
        if(lRes.success) setAktLog(lRes.data||[]);
        if(fRes.success) setFakultasData(fRes.data||[]);
        if(jRes.success) setJournals(jRes.data||[]);
      } catch(e){ showNotif("Gagal memuat pengaturan: "+e.message,"error"); }
      finally{ setLoading(false); }
    };
    load();
  },[]);

  const saveSettings=async(updated)=>{
    try {
      const res=await api("PUT","/settings",serializeSettings(updated));
      if(res.success){ setSettings(updated); showNotif("Pengaturan disimpan ✅"); }
    } catch(e){ showNotif(e.message,"error"); }
  };

  const SUBS=[{id:"umum",icon:"⚙️",label:"Umum"},{id:"anggota",icon:"👥",label:"Anggota"},{id:"akademik",icon:"🏛️",label:"Fakultas & Prodi"},{id:"kategori",icon:"📂",label:"Kategori Buku"},{id:"jurnal",icon:"📰",label:"Jurnal"},{id:"banner",icon:"📢",label:"Pengumuman"},{id:"log",icon:"📋",label:"Log Aktivitas"}];

  if(loading)return<Spinner/>;

  return(
    <div style={{display:"grid",gridTemplateColumns:"220px 1fr",gap:24,alignItems:"start"}}>
      <div style={{background:"#fff",borderRadius:16,padding:12,boxShadow:"0 2px 10px rgba(0,0,0,0.06)",border:"1px solid #f1f5f9",position:"sticky",top:0}}>
        <p style={{fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.08em",padding:"4px 8px 10px"}}>Pengaturan Sistem</p>
        {SUBS.map(s=>(<button key={s.id} onClick={()=>setSub(s.id)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 10px",borderRadius:10,border:"none",cursor:"pointer",background:sub===s.id?`${rc.color}15`:"transparent",color:sub===s.id?rc.color:"#64748b",fontWeight:sub===s.id?600:400,fontSize:13,marginBottom:2,transition:"all 0.2s",textAlign:"left"}}><span style={{fontSize:16}}>{s.icon}</span><span>{s.label}</span>{sub===s.id&&<span style={{marginLeft:"auto",width:6,height:6,borderRadius:"50%",background:rc.color}}/>}</button>))}
      </div>
      <div>
        {sub==="umum"    &&settings&&<SetUmum s={settings} onSave={saveSettings}/>}
        {sub==="anggota" &&settings&&<SetAnggota s={settings} onSave={saveSettings}/>}
        {sub==="akademik"&&<SetAkademik data={fakultasData} setData={setFakultasData} showNotif={showNotif}/>}
        {sub==="kategori"&&settings&&<SetKategori s={settings} onSave={saveSettings} showNotif={showNotif}/>}
        {sub==="jurnal"  &&<SetJurnal journals={journals} setJournals={setJournals} showNotif={showNotif}/>}
        {sub==="banner"  &&settings&&<SetBanner s={settings} onSave={saveSettings}/>}
        {sub==="log"     &&<SetLog log={aktLog}/>}
      </div>
    </div>
  );
}

function SetUmum({s,onSave}){
  const [f,setF]=useState({...s});
  return(
    <Card title="⚙️ Pengaturan Umum" sub="Informasi dasar perpustakaan">
      <Grid2>
        <FF label="Nama Perpustakaan"><input value={f.nama} onChange={e=>setF(p=>({...p,nama:e.target.value}))} style={IS}/></FF>
        <FF label="Email Resmi"><input value={f.email} onChange={e=>setF(p=>({...p,email:e.target.value}))} style={IS}/></FF>
        <FF label="No. Telepon"><input value={f.phone} onChange={e=>setF(p=>({...p,phone:e.target.value}))} style={IS}/></FF>
        <FF label="Website"><input value={f.website||""} onChange={e=>setF(p=>({...p,website:e.target.value}))} style={IS}/></FF>
      </Grid2>
      <FF label="Alamat Lengkap"><textarea value={f.alamat} onChange={e=>setF(p=>({...p,alamat:e.target.value}))} style={{...IS,height:60,resize:"vertical"}}/></FF>
      <div style={{marginTop:8,display:"flex",alignItems:"center",justifyContent:"space-between",padding:14,borderRadius:10,background:"#f8fafc",border:"1px solid #e2e8f0"}}>
        <div><p style={{fontWeight:600,fontSize:14,color:"#1e293b"}}>🔧 Mode Maintenance</p><p style={{fontSize:12,color:"#94a3b8"}}>Nonaktifkan akses publik sementara</p></div>
        <Toggle val={f.maintenance} onChange={v=>setF(p=>({...p,maintenance:v}))}/>
      </div>
      <SaveBtn onClick={()=>onSave(f)}/>
    </Card>
  );
}

function SetAnggota({s,onSave}){
  const [f,setF]=useState({...s});
  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <Card title="📚 Pengaturan Peminjaman" sub="Aturan peminjaman buku">
        <Grid2>
          <FF label="Durasi Pinjam Default (hari)"><input type="number" value={f.durasiPinjam} onChange={e=>setF(p=>({...p,durasiPinjam:+e.target.value}))} style={IS}/></FF>
          <FF label="Maks. Buku Dipinjam/Orang"><input type="number" value={f.maxPinjam} onChange={e=>setF(p=>({...p,maxPinjam:+e.target.value}))} style={IS}/></FF>
          <FF label="Denda Keterlambatan/Hari (Rp)"><input type="number" value={f.dendaPerHari} onChange={e=>setF(p=>({...p,dendaPerHari:+e.target.value}))} style={IS}/></FF>
          <FF label="Durasi Token Default (hari)"><input type="number" value={f.tokenDurasi} onChange={e=>setF(p=>({...p,tokenDurasi:+e.target.value}))} style={IS}/></FF>
        </Grid2>
      </Card>
      <Card title="🪪 Pengaturan Keanggotaan" sub="Aturan pendaftaran dan verifikasi">
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:14,borderRadius:10,background:"#f8fafc",border:"1px solid #e2e8f0"}}>
          <div><p style={{fontWeight:600,fontSize:14,color:"#1e293b"}}>Verifikasi email wajib</p><p style={{fontSize:12,color:"#94a3b8"}}>Anggota harus verifikasi email sebelum aktif</p></div>
          <Toggle val={f.verifikasiEmail} onChange={v=>setF(p=>({...p,verifikasiEmail:v}))}/>
        </div>
      </Card>
      <SaveBtn onClick={()=>onSave(f)}/>
    </div>
  );
}

function SetAkademik({data,setData,showNotif}){
  const [selFak,setSelFak]=useState(null);
  const [showAddFak,setShowAddFak]=useState(false);
  const [showAddProdi,setShowAddProdi]=useState(false);
  const [newFak,setNewFak]=useState({nama:"",kode:"",warna:"#6366f1"});
  const [newProdi,setNewProdi]=useState({nama:"",jenjang:"S1",kode:""});
  const [saving,setSaving]=useState(false);
  const [confirmDelFak,setConfirmDelFak]=useState(null);

  const addFak=async()=>{
    if(!newFak.nama){showNotif("Nama fakultas wajib!","error");return;}
    setSaving(true);
    try {
      const res=await api("POST","/fakultas",{nama:newFak.nama,kode:newFak.kode,warna:newFak.warna});
      if(res.success){ setData(p=>[...p,{...res.data,prodi:[]}]); setShowAddFak(false); setNewFak({nama:"",kode:"",warna:"#6366f1"}); showNotif("Fakultas ditambahkan ✅"); }
    } catch(e){ showNotif(e.message,"error"); }
    finally{ setSaving(false); }
  };

  const delFak=async()=>{
    if(!confirmDelFak)return;
    try { await api("DELETE",`/fakultas/${confirmDelFak.id}`); setData(p=>p.filter(f=>f.id!==confirmDelFak.id)); if(selFak?.id===confirmDelFak.id)setSelFak(null); showNotif("Fakultas dihapus"); }
    catch(e){ showNotif(e.message,"error"); }
    finally{ setConfirmDelFak(null); }
  };

  const addProdi=async()=>{
    if(!newProdi.nama){showNotif("Nama prodi wajib!","error");return;}
    setSaving(true);
    try {
      const res=await api("POST",`/fakultas/${selFak.id}/prodi`,{nama:newProdi.nama,jenjang:newProdi.jenjang,kode:newProdi.kode});
      if(res.success){
        const updated={...selFak,prodi:[...selFak.prodi,res.data]};
        setSelFak(updated);
        setData(p=>p.map(f=>f.id===selFak.id?updated:f));
        setShowAddProdi(false); setNewProdi({nama:"",jenjang:"S1",kode:""}); showNotif("Prodi ditambahkan ✅");
      }
    } catch(e){ showNotif(e.message,"error"); }
    finally{ setSaving(false); }
  };

  const delProdi=async(fakId,prodiId)=>{
    try { await api("DELETE",`/fakultas/prodi/${prodiId}`); const updated={...selFak,prodi:selFak.prodi.filter(p=>p.id!==prodiId)}; setSelFak(updated); setData(p=>p.map(f=>f.id===fakId?updated:f)); showNotif("Prodi dihapus"); }
    catch(e){ showNotif(e.message,"error"); }
  };

  const jenjangColor={S1:"#6366f1",S2:"#10b981",S3:"#f59e0b",D3:"#3b82f6",D4:"#a855f7"};

  return(
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,alignItems:"start"}}>
      <Card title="🏛️ Daftar Fakultas" sub={`${data.length} fakultas`} action={<button onClick={()=>setShowAddFak(true)} style={{...BtnStyle("#6366f1"),fontSize:12,padding:"6px 12px"}}>+ Tambah</button>}>
        {data.map(f=>(<div key={f.id} onClick={()=>setSelFak(f)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:10,background:selFak?.id===f.id?`${f.warna}12`:"#f8fafc",border:`1.5px solid ${selFak?.id===f.id?f.warna:"#f1f5f9"}`,cursor:"pointer",marginBottom:8,transition:"all 0.2s"}}>
          <div style={{width:36,height:36,borderRadius:10,background:f.warna,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>🏛️</div>
          <div style={{flex:1,minWidth:0}}><p style={{fontWeight:600,fontSize:13,color:"#1e293b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.nama}</p><p style={{fontSize:11,color:"#94a3b8"}}>{f.kode} · {f.prodi?.length||0} prodi</p></div>
          <button onClick={e=>{e.stopPropagation();setConfirmDelFak(f);}} style={{padding:"4px 8px",borderRadius:6,border:"none",background:"#fee2e2",color:"#ef4444",cursor:"pointer",fontSize:11}}>Hapus</button>
        </div>))}
        {showAddFak&&<ModalWrap title="➕ Tambah Fakultas" onClose={()=>setShowAddFak(false)}>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <FF label="Nama Fakultas"><input value={newFak.nama} onChange={e=>setNewFak(p=>({...p,nama:e.target.value}))} style={IS} placeholder="Contoh: Teknik Informatika"/></FF>
            <FF label="Kode"><input value={newFak.kode} onChange={e=>setNewFak(p=>({...p,kode:e.target.value}))} style={IS} placeholder="FTI"/></FF>
            <FF label="Warna"><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{["#6366f1","#10b981","#f59e0b","#3b82f6","#ec4899","#a855f7","#14b8a6","#ef4444"].map(c=>(<div key={c} onClick={()=>setNewFak(p=>({...p,warna:c}))} style={{width:28,height:28,borderRadius:8,background:c,cursor:"pointer",border:newFak.warna===c?"3px solid #1e293b":"3px solid transparent"}}/>))}</div></FF>
            <div style={{display:"flex",gap:8,marginTop:8}}>
              <button onClick={addFak} disabled={saving} style={{...BtnStyle("#6366f1"),flex:1}}>{saving?"Menyimpan...":"Simpan"}</button>
              <button onClick={()=>setShowAddFak(false)} style={{flex:1,padding:"10px",borderRadius:10,border:"1.5px solid #e2e8f0",background:"#fff",cursor:"pointer",color:"#64748b"}}>Batal</button>
            </div>
          </div>
        </ModalWrap>}
      </Card>
      <Card title={selFak?`📖 Prodi — ${selFak.nama}`:"📖 Program Studi"} sub={selFak?`${selFak.prodi?.length||0} prodi`:"Pilih fakultas"} action={selFak&&<button onClick={()=>setShowAddProdi(true)} style={{...BtnStyle("#10b981"),fontSize:12,padding:"6px 12px"}}>+ Prodi</button>}>
        {!selFak&&<EmptyState icon="👆" msg="Pilih Fakultas" sub="Klik fakultas di sebelah kiri"/>}
        {selFak&&(selFak.prodi||[]).length===0&&<EmptyState icon="📭" msg="Belum ada prodi" sub="Tambahkan program studi"/>}
        {selFak&&(selFak.prodi||[]).map(p=>(<div key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,background:"#f8fafc",border:"1px solid #f1f5f9",marginBottom:8}}>
          <span style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,background:`${jenjangColor[p.jenjang]||"#6366f1"}15`,color:jenjangColor[p.jenjang]||"#6366f1",flexShrink:0}}>{p.jenjang}</span>
          <div style={{flex:1}}><p style={{fontSize:13,fontWeight:500,color:"#1e293b"}}>{p.nama}</p><p style={{fontSize:11,color:"#94a3b8"}}>{p.kode}</p></div>
          <button onClick={()=>delProdi(selFak.id,p.id)} style={{padding:"4px 8px",borderRadius:6,border:"none",background:"#fee2e2",color:"#ef4444",cursor:"pointer",fontSize:11}}>✕</button>
        </div>))}
        {showAddProdi&&selFak&&<ModalWrap title="➕ Tambah Prodi" onClose={()=>setShowAddProdi(false)}>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <FF label="Nama Program Studi"><input value={newProdi.nama} onChange={e=>setNewProdi(p=>({...p,nama:e.target.value}))} style={IS} placeholder="S1 Teknik Informatika"/></FF>
            <FF label="Jenjang"><select value={newProdi.jenjang} onChange={e=>setNewProdi(p=>({...p,jenjang:e.target.value}))} style={IS}>{["D3","D4","S1","S2","S3"].map(j=><option key={j}>{j}</option>)}</select></FF>
            <FF label="Kode Prodi"><input value={newProdi.kode} onChange={e=>setNewProdi(p=>({...p,kode:e.target.value}))} style={IS} placeholder="TI01"/></FF>
            <div style={{display:"flex",gap:8,marginTop:8}}>
              <button onClick={addProdi} disabled={saving} style={{...BtnStyle("#10b981"),flex:1}}>{saving?"Menyimpan...":"Simpan"}</button>
              <button onClick={()=>setShowAddProdi(false)} style={{flex:1,padding:"10px",borderRadius:10,border:"1.5px solid #e2e8f0",background:"#fff",cursor:"pointer",color:"#64748b"}}>Batal</button>
            </div>
          </div>
        </ModalWrap>}
      </Card>
      {confirmDelFak&&<ConfirmDialog
        title="Hapus Fakultas?"
        msg={`Fakultas "${confirmDelFak.nama}" dan semua prodi di dalamnya akan dihapus.`}
        icon="🏛️"
        confirmText="Ya, Hapus Fakultas"
        confirmColor="#ef4444"
        onConfirm={delFak}
        onCancel={()=>setConfirmDelFak(null)}
      />}
    </div>
  );
}

function SetKategori({s,onSave,showNotif}){
  const [list,setList]=useState(s.kategoriBuku||[]);
  const [newK,setNewK]=useState("");
  const add=()=>{
    if(!newK.trim()||list.includes(newK.trim())){showNotif("Kategori sudah ada atau kosong!","error");return;}
    const updated=[...list,newK.trim()]; setList(updated); onSave({...s,kategoriBuku:updated}); setNewK("");
  };
  const del=(k)=>{const updated=list.filter(x=>x!==k); setList(updated); onSave({...s,kategoriBuku:updated});};
  return(
    <Card title="📂 Manajemen Kategori Buku" sub={`${list.length} kategori aktif`}>
      <div style={{display:"flex",gap:10,marginBottom:20}}><input value={newK} onChange={e=>setNewK(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} placeholder="Nama kategori baru..." style={{...IS,flex:1}}/><button onClick={add} style={{...BtnStyle("#6366f1"),flexShrink:0}}>+ Tambah</button></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        {list.map((k,i)=>{const cols=["#6366f1","#10b981","#f59e0b","#3b82f6","#ec4899","#a855f7","#14b8a6","#ef4444"];const c=cols[i%cols.length];return(
          <div key={k} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:10,background:`${c}0a`,border:`1.5px solid ${c}25`}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:c,flexShrink:0}}/><span style={{flex:1,fontSize:13,fontWeight:500,color:"#1e293b"}}>{k}</span>
            <button onClick={()=>del(k)} style={{padding:"3px 8px",borderRadius:6,border:"none",background:"#fee2e2",color:"#ef4444",cursor:"pointer",fontSize:11}}>✕</button>
          </div>
        );})}
      </div>
    </Card>
  );
}

function SetJurnal({journals,setJournals,showNotif}){
  const [showAdd,setShowAdd]=useState(false);
  const [editId,setEditId]=useState(null);
  const [saving,setSaving]=useState(false);
  const empty={title:"",issn:"",issnE:"",volume:"",year:new Date().getFullYear(),articleCount:0,editorName:"",publisherName:"",frequency:"2x setahun",color:"#6366f1",isActive:true};
  const [form,setForm]=useState(empty);
  const [confirmDelJurnal,setConfirmDelJurnal]=useState(null);

  const save=async()=>{
    if(!form.title){showNotif("Judul wajib!","error");return;}
    setSaving(true);
    // Map camelCase form fields → backend snake_case field names
    const payload={
      title:    form.title,
      issn:     form.issn||null,
      issnE:    form.issnE||null,
      volume:   form.volume||null,
      year:     +form.year||new Date().getFullYear(),
      articles: +(form.articleCount||form.articles||0),
      editor:   form.editorName||form.editor||null,
      penerbit: form.publisherName||form.penerbit||null,
      frekuensi:form.frequency||form.frekuensi||null,
      warna:    form.color||form.warna||"#6366f1",
      isActive: form.isActive??true,
    };
    try {
      if(editId){
        const res=await api("PUT",`/jurnal/${editId}`,payload);
        if(res.success){ setJournals(p=>p.map(j=>j.id===editId?res.data:j)); showNotif("Jurnal diperbarui ✅"); }
      } else {
        const res=await api("POST","/jurnal",payload);
        if(res.success){ setJournals(p=>[...p,res.data]); showNotif("Jurnal ditambahkan ✅"); }
      }
      setShowAdd(false); setEditId(null); setForm(empty);
    } catch(e){ showNotif(e.message,"error"); }
    finally{ setSaving(false); }
  };

  const del=async()=>{
    if(!confirmDelJurnal)return;
    try { await api("DELETE",`/jurnal/${confirmDelJurnal.id}`); setJournals(p=>p.filter(j=>j.id!==confirmDelJurnal.id)); showNotif("Jurnal dihapus"); }
    catch(e){ showNotif(e.message,"error"); }
    finally{ setConfirmDelJurnal(null); }
  };

  return(
    <Card title="📰 Manajemen Jurnal Ilmiah" sub={`${journals.length} jurnal`} action={<button onClick={()=>{setForm(empty);setEditId(null);setShowAdd(true);}} style={{...BtnStyle("#6366f1"),fontSize:12,padding:"6px 12px"}}>+ Tambah</button>}>
      {journals.map(j=>(
        <div key={j.id} style={{display:"flex",gap:14,padding:16,borderRadius:12,background:"#f8fafc",border:"1.5px solid #f1f5f9",marginBottom:8,position:"relative",overflow:"hidden"}}>
          <div style={{width:4,borderRadius:2,background:j.color||j.warna||"#6366f1",flexShrink:0}}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10}}>
              <div>
                <p style={{fontWeight:700,fontSize:14,color:"#1e293b",lineHeight:1.4,marginBottom:4}}>{j.title}</p>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>
                  <Chip color={j.isActive?"#10b981":"#ef4444"}>{j.isActive?"Aktif":"Nonaktif"}</Chip>
                  {j.issn&&<Chip color="#64748b">ISSN: {j.issn}</Chip>}
                  {j.volume&&<Chip color="#6366f1">{j.volume}</Chip>}
                </div>
                <p style={{fontSize:12,color:"#64748b"}}>{j.editorName||j.editor} · {j.publisherName||j.penerbit}</p>
              </div>
              <div style={{display:"flex",gap:6,flexShrink:0}}>
                <button onClick={()=>{setForm({...j,articleCount:j.articleCount||j.articles||0,editorName:j.editorName||j.editor||"",publisherName:j.publisherName||j.penerbit||"",color:j.color||j.warna||"#6366f1",frequency:j.frequency||j.frekuensi||"2x setahun",isActive:j.isActive??true});setEditId(j.id);setShowAdd(true);}} style={{padding:"5px 10px",borderRadius:6,border:"1.5px solid #e2e8f0",background:"#fff",cursor:"pointer",fontSize:11,color:"#64748b"}}>Edit</button>
                <button onClick={()=>setConfirmDelJurnal(j)} style={{padding:"5px 10px",borderRadius:6,border:"none",background:"#fee2e2",color:"#ef4444",cursor:"pointer",fontSize:11}}>Hapus</button>
              </div>
            </div>
          </div>
        </div>
      ))}
      {showAdd&&<ModalWrap title={editId?"✏️ Edit Jurnal":"➕ Tambah Jurnal"} onClose={()=>{setShowAdd(false);setEditId(null);setForm(empty);}}>
        <Grid2>
          <FF label="Judul Jurnal"><input value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} style={IS}/></FF>
          <FF label="ISSN (Cetak)"><input value={form.issn||""} onChange={e=>setForm(p=>({...p,issn:e.target.value}))} style={IS} placeholder="0000-0000"/></FF>
          <FF label="E-ISSN"><input value={form.issnE||""} onChange={e=>setForm(p=>({...p,issnE:e.target.value}))} style={IS} placeholder="0000-0001"/></FF>
          <FF label="Volume/Nomor"><input value={form.volume||""} onChange={e=>setForm(p=>({...p,volume:e.target.value}))} style={IS} placeholder="Vol. 1, No. 1"/></FF>
          <FF label="Tahun"><input type="number" value={form.year||2024} onChange={e=>setForm(p=>({...p,year:+e.target.value}))} style={IS}/></FF>
          <FF label="Editor"><input value={form.editorName||""} onChange={e=>setForm(p=>({...p,editorName:e.target.value}))} style={IS}/></FF>
          <FF label="Penerbit"><input value={form.publisherName||""} onChange={e=>setForm(p=>({...p,publisherName:e.target.value}))} style={IS}/></FF>
          <FF label="Frekuensi"><select value={form.frequency||"2x setahun"} onChange={e=>setForm(p=>({...p,frequency:e.target.value}))} style={IS}>{["1x setahun","2x setahun","3x setahun","4x setahun","Bulanan"].map(f=><option key={f}>{f}</option>)}</select></FF>
        </Grid2>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:12,borderRadius:10,background:"#f8fafc",marginTop:8}}>
          <span style={{fontSize:13,fontWeight:500,color:"#1e293b"}}>Status Jurnal Aktif</span>
          <Toggle val={form.isActive} onChange={v=>setForm(p=>({...p,isActive:v}))}/>
        </div>
        <div style={{display:"flex",gap:8,marginTop:14}}>
          <button onClick={save} disabled={saving} style={{...BtnStyle("#6366f1"),flex:1}}>{saving?"Menyimpan...":"Simpan"}</button>
          <button onClick={()=>{setShowAdd(false);setEditId(null);setForm(empty);}} style={{flex:1,padding:"10px",borderRadius:10,border:"1.5px solid #e2e8f0",background:"#fff",cursor:"pointer",color:"#64748b"}}>Batal</button>
        </div>
      </ModalWrap>}
      {confirmDelJurnal&&<ConfirmDialog
        title="Hapus Jurnal?"
        msg={`Jurnal "${confirmDelJurnal.title}" akan dihapus permanen.`}
        icon="📰"
        confirmText="Ya, Hapus"
        confirmColor="#ef4444"
        onConfirm={del}
        onCancel={()=>setConfirmDelJurnal(null)}
      />}
    </Card>
  );
}({s,onSave}){
  const [f,setF]=useState({...s});
  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <Card title="📢 Banner Utama" sub="Tampil di bagian atas halaman">
        <div style={{marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between",padding:14,borderRadius:10,background:"#f8fafc",border:"1px solid #e2e8f0"}}>
          <div><p style={{fontWeight:600,fontSize:14,color:"#1e293b"}}>Aktifkan Banner</p><p style={{fontSize:12,color:"#94a3b8"}}>Tampilkan bar pengumuman</p></div>
          <Toggle val={f.bannerAktif} onChange={v=>setF(p=>({...p,bannerAktif:v}))}/>
        </div>
        <FF label="Teks Banner"><input value={f.bannerText} onChange={e=>setF(p=>({...p,bannerText:e.target.value}))} style={IS}/></FF>
        <FF label="Warna Banner" style={{marginTop:12}}>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:4}}>{["#6366f1","#10b981","#f59e0b","#ef4444","#3b82f6","#a855f7","#0f172a","#059669"].map(c=>(<div key={c} onClick={()=>setF(p=>({...p,bannerColor:c}))} style={{width:32,height:32,borderRadius:8,background:c,cursor:"pointer",border:f.bannerColor===c?"3px solid #1e293b":"3px solid transparent",boxSizing:"border-box"}}/>))}</div>
        </FF>
        {f.bannerAktif&&<div style={{marginTop:16,borderRadius:10,overflow:"hidden",border:"1px solid #e2e8f0"}}><p style={{fontSize:11,color:"#94a3b8",padding:"6px 12px",background:"#f8fafc",borderBottom:"1px solid #e2e8f0",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em"}}>Preview</p><div style={{background:f.bannerColor,padding:"10px 20px",color:"#fff",fontSize:13,fontWeight:500,textAlign:"center"}}>✨ {f.bannerText}</div></div>}
      </Card>
      <Card title="📋 Pengumuman" sub="Tampil di beranda setelah login">
        <FF label="Isi Pengumuman"><textarea value={f.pengumuman||""} onChange={e=>setF(p=>({...p,pengumuman:e.target.value}))} style={{...IS,height:100,resize:"vertical"}} placeholder="Contoh: Perpustakaan libur pada tanggal 25 Desember 2024..."/></FF>
      </Card>
      <SaveBtn onClick={()=>onSave(f)}/>
    </div>
  );
}

function SetLog({log}){
  const [filter,setFilter]=useState("semua");
  const roles={semua:"Semua",kepala:"Kepala",pustakawan:"Pustakawan",mahasiswa:"Mahasiswa",umum:"Umum"};
  const filtered=log.filter(l=>filter==="semua"||l.role===filter);
  const fmtWaktu=(iso)=>{const d=new Date(iso);const now=new Date();const diff=Math.floor((now-d)/1000);if(diff<60)return`${diff}d lalu`;if(diff<3600)return`${Math.floor(diff/60)}m lalu`;if(diff<86400)return`${Math.floor(diff/3600)}j lalu`;return d.toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});};
  return(
    <Card title="📋 Log Aktivitas" sub={`${log.length} aktivitas`}>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{Object.entries(roles).map(([k,v])=>(<button key={k} onClick={()=>setFilter(k)} style={{padding:"5px 12px",borderRadius:20,border:filter===k?"none":"1.5px solid #e2e8f0",background:filter===k?"#6366f1":"#fff",color:filter===k?"#fff":"#64748b",cursor:"pointer",fontSize:12,fontWeight:filter===k?600:400}}>{v}</button>))}</div>
      <div style={{maxHeight:480,overflow:"auto"}}>
        {filtered.length===0&&<EmptyState icon="📭" msg="Tidak ada log" sub="Belum ada aktivitas"/>}
        {filtered.map((l,i)=>(
          <div key={l.id||i} style={{display:"flex",gap:12,padding:"12px 0",borderBottom:i<filtered.length-1?"1px solid #f1f5f9":"none",alignItems:"flex-start"}}>
            <div style={{width:36,height:36,borderRadius:10,background:`${l.color||"#6366f1"}15`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{l.icon||"📌"}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:3}}><span style={{fontWeight:600,fontSize:13,color:"#1e293b"}}>{l.action||l.aksi}</span><span style={{fontSize:11,color:"#94a3b8",flexShrink:0}}>{fmtWaktu(l.createdAt||l.waktu)}</span></div>
              <p style={{fontSize:12,color:"#64748b",marginBottom:4,lineHeight:1.5}}>{l.description||l.detail}</p>
              {l.user&&<Chip color={ROLE_CONFIG[l.user?.role||l.role]?.color||"#6366f1"}>{l.user?.name||l.user} ({ROLE_CONFIG[l.user?.role||l.role]?.label||l.role})</Chip>}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function BookmarkInner({books,bookmarkIds,toggleBM,setSelectedBook}){
  const saved=books.filter(b=>bookmarkIds.includes(b.id));
  if(!saved.length)return<EmptyState icon="🔖" msg="Belum ada tersimpan" sub="Tekan ★ pada buku"/>;
  return(<div><p style={{fontSize:13,color:"#94a3b8",marginBottom:20}}>{saved.length} tersimpan</p><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:16}}>{saved.map(b=><DashBookCard key={b.id} book={b} bookmarks={bookmarkIds} toggleBM={toggleBM} onSelect={setSelectedBook}/>)}</div></div>);
}

function KartuAnggota({user,rc}){
  const [flip,setFlip]=useState(false);
  const exp=new Date(new Date(user.joinedAt||user.joined||Date.now()).setFullYear(new Date().getFullYear()+1));
  const roleColors={kepala:["#1e1b4b","#4f46e5"],pustakawan:["#064e3b","#059669"],mahasiswa:["#172554","#2563eb"],umum:["#451a03","#b45309"]};
  const [c1,c2]=roleColors[user.role]||["#1e293b","#374151"];
  const cardData=`UNISMU|${user.nim}|${user.name}|${user.role}|${user.fakultas}`;
  return(
    <div style={{maxWidth:700,margin:"0 auto"}}>
      <h2 style={{fontFamily:"'Poppins',sans-serif",fontSize:22,fontWeight:700,color:"#1e293b",marginBottom:6}}>🪪 Kartu Anggota Digital</h2>
      <p style={{fontSize:13,color:"#94a3b8",marginBottom:28}}>Kartu identitas resmi anggota Perpustakaan Digital UNISMU</p>
      <div style={{perspective:1000,marginBottom:28,cursor:"pointer"}} onClick={()=>setFlip(f=>!f)}>
        <div style={{position:"relative",width:"100%",maxWidth:480,height:280,transformStyle:"preserve-3d",transition:"transform 0.6s cubic-bezier(0.4,0,0.2,1)",transform:flip?"rotateY(180deg)":"rotateY(0deg)",margin:"0 auto"}}>
          <div style={{position:"absolute",inset:0,backfaceVisibility:"hidden",WebkitBackfaceVisibility:"hidden",borderRadius:20,overflow:"hidden",boxShadow:"0 24px 60px rgba(0,0,0,0.35)"}}>
            <div style={{width:"100%",height:"100%",background:`linear-gradient(135deg,${c1},${c2})`,padding:"28px 30px",display:"flex",flexDirection:"column",justifyContent:"space-between",position:"relative"}}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:5,background:"linear-gradient(90deg,#fbbf24,#f59e0b,#fde68a,#fbbf24)"}}/>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:38,height:38,borderRadius:10,background:"rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,border:"1px solid rgba(255,255,255,0.25)"}}>📚</div>
                  <div><div style={{color:"rgba(255,255,255,0.9)",fontSize:11,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase"}}>UNISMU</div><div style={{color:"rgba(255,255,255,0.55)",fontSize:9,letterSpacing:"0.06em"}}>Perpustakaan Digital</div></div>
                </div>
                <div style={{background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:20,padding:"3px 10px",fontSize:10,color:"rgba(255,255,255,0.85)",fontWeight:600,textTransform:"uppercase"}}>{rc.icon} {rc.label}</div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:16}}>
                <div style={{width:56,height:56,borderRadius:14,background:"rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,border:"2px solid rgba(255,255,255,0.3)",flexShrink:0}}>{user.avatar||"👤"}</div>
                <div><div style={{color:"#fff",fontSize:16,fontWeight:700,fontFamily:"'Poppins',sans-serif",lineHeight:1.3,marginBottom:3}}>{user.name?.split(",")[0]}</div><div style={{color:"rgba(255,255,255,0.65)",fontSize:11}}>{user.fakultas}</div></div>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
                <div><div style={{color:"rgba(255,255,255,0.45)",fontSize:9,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:3}}>Nomor Anggota</div><div style={{color:"#fbbf24",fontSize:15,fontWeight:700,letterSpacing:"0.15em",fontFamily:"monospace"}}>{user.nim}</div></div>
                <div style={{textAlign:"right"}}><div style={{color:"rgba(255,255,255,0.45)",fontSize:9,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:3}}>Berlaku s/d</div><div style={{color:"rgba(255,255,255,0.85)",fontSize:12,fontWeight:600}}>{fmtShort(exp)}</div></div>
              </div>
            </div>
          </div>
          <div style={{position:"absolute",inset:0,backfaceVisibility:"hidden",WebkitBackfaceVisibility:"hidden",borderRadius:20,overflow:"hidden",boxShadow:"0 24px 60px rgba(0,0,0,0.35)",transform:"rotateY(180deg)"}}>
            <div style={{width:"100%",height:"100%",background:"linear-gradient(135deg,#1e293b,#0f172a)",padding:"24px 28px",display:"flex",flexDirection:"column",justifyContent:"space-between"}}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:5,background:"linear-gradient(90deg,#fbbf24,#f59e0b,#fde68a,#fbbf24)"}}/>
              <div style={{background:"#374151",height:36,borderRadius:4,margin:"8px 0"}}/>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flex:1}}>
                <div style={{flex:1}}>
                  <div style={{color:"rgba(255,255,255,0.4)",fontSize:9,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>Informasi Anggota</div>
                  {[["Email",user.email],["Telepon",user.phone],["Anggota Sejak",fmtDate(user.joinedAt||user.joined||Date.now())],["Status","Aktif ✅"]].map(([l,v])=>(<div key={l} style={{marginBottom:5}}><span style={{color:"rgba(255,255,255,0.4)",fontSize:9}}>{l}: </span><span style={{color:"rgba(255,255,255,0.85)",fontSize:10,fontWeight:500}}>{v||"-"}</span></div>))}
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,marginLeft:16}}>
                  <div style={{background:"#fff",borderRadius:10,padding:6,boxShadow:"0 4px 12px rgba(0,0,0,0.3)"}}><QRCode data={cardData} size={90} fg="#1e293b" bg="#fff"/></div>
                  <div style={{color:"rgba(255,255,255,0.4)",fontSize:8,textAlign:"center",letterSpacing:"0.06em",textTransform:"uppercase"}}>Scan verifikasi</div>
                </div>
              </div>
              <div style={{borderTop:"1px solid rgba(255,255,255,0.1)",paddingTop:10}}><div style={{color:"rgba(255,255,255,0.3)",fontSize:9,textAlign:"center"}}>Kartu resmi Perpustakaan UNISMU</div></div>
            </div>
          </div>
        </div>
      </div>
      <div style={{background:"#fff",borderRadius:20,padding:28,boxShadow:"0 4px 20px rgba(0,0,0,0.08)",border:"1px solid #f1f5f9",display:"grid",gridTemplateColumns:"auto 1fr",gap:28,alignItems:"center"}}>
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:10}}>
          <div style={{background:"#f8fafc",border:"2px solid #e2e8f0",borderRadius:16,padding:12}}><QRCode data={cardData} size={130} fg="#1e293b" bg="#f8fafc"/></div>
          <span style={{fontSize:11,color:"#94a3b8",fontWeight:500}}>QR Verifikasi Anggota</span>
        </div>
        <div>
          <div style={{display:"inline-flex",alignItems:"center",gap:6,background:`${rc.color}15`,color:rc.color,padding:"4px 12px",borderRadius:20,fontSize:11,fontWeight:600,marginBottom:14,border:`1px solid ${rc.color}30`}}>{rc.icon} {rc.label}</div>
          <h3 style={{fontFamily:"'Poppins',sans-serif",fontSize:20,fontWeight:700,color:"#1e293b",marginBottom:4}}>{user.name?.split(",")[0]}</h3>
          <p style={{fontSize:13,color:"#64748b",marginBottom:14}}>{user.fakultas}</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {[["🪪 No. Anggota",user.nim,rc.color],["📅 Berlaku s/d",fmtShort(exp),"#10b981"],["📧 Email",user.email||"-","#6366f1"],["📱 Telepon",user.phone||"-","#f59e0b"]].map(([l,v,c])=>(
              <div key={l} style={{background:"#f8fafc",borderRadius:10,padding:"10px 14px",border:"1px solid #e2e8f0"}}><div style={{fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:3,fontWeight:600}}>{l}</div><div style={{fontSize:13,color:c,fontWeight:600,wordBreak:"break-all"}}>{v}</div></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfilInner({user,rc,showNotif}){
  const [form,setForm]=useState({name:user.name||"",email:user.email||"",phone:user.phone||""});
  const [saving,setSaving]=useState(false);
  const save=async()=>{
    setSaving(true);
    try {
      const res=await api("PUT",`/users/${user.id}`,{name:form.name,email:form.email,phone:form.phone});
      if(res.success) showNotif("Profil diperbarui ✅");
    } catch(e){ showNotif(e.message,"error"); }
    finally{ setSaving(false); }
  };
  const [pwForm,setPwForm]=useState({oldPassword:"",newPassword:""});
  const [savingPw,setSavingPw]=useState(false);
  const savePassword=async()=>{
    if(!pwForm.oldPassword||!pwForm.newPassword){showNotif("Semua field password wajib diisi","error");return;}
    if(pwForm.newPassword.length<8){showNotif("Password baru minimal 8 karakter","error");return;}
    setSavingPw(true);
    try{
      const res=await api("POST","/auth/change-password",{oldPassword:pwForm.oldPassword,newPassword:pwForm.newPassword});
      if(res.success){showNotif("Password berhasil diubah ✅");setPwForm({oldPassword:"",newPassword:""});}
    }catch(e){showNotif(e.message,"error");}
    finally{setSavingPw(false);}
  };
  return(
    <div style={{maxWidth:700}}>
      <div style={{background:rc.bg,borderRadius:20,padding:"28px 32px",marginBottom:20,color:"#fff",display:"flex",alignItems:"center",gap:20}}>
        <div style={{width:70,height:70,borderRadius:20,background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,border:"2px solid rgba(255,255,255,0.4)"}}>{user.avatar||"👤"}</div>
        <div><h2 style={{fontFamily:"'Poppins',sans-serif",fontSize:22,fontWeight:700,marginBottom:6}}>{user.name?.split(",")[0]}</h2>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{[`${rc.icon} ${rc.label}`,`🎓 ${user.fakultas}`,`🪪 ${user.nim}`].map(t=><span key={t} style={{background:"rgba(255,255,255,0.2)",padding:"4px 12px",borderRadius:20,fontSize:12,border:"1px solid rgba(255,255,255,0.3)"}}>{t}</span>)}</div>
        </div>
      </div>
      <div style={{background:"#fff",borderRadius:16,padding:28,boxShadow:"0 2px 10px rgba(0,0,0,0.06)",border:"1px solid #f1f5f9"}}>
        <h3 style={{fontWeight:700,fontSize:16,color:"#1e293b",marginBottom:20}}>✏️ Edit Profil</h3>
        <div style={{display:"grid",gap:14}}>
          <FF label="Nama Lengkap"><input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} style={IS}/></FF>
          <FF label="Email"><input value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} style={IS}/></FF>
          <FF label="No. Telepon"><input value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} style={IS}/></FF>
          <button onClick={save} disabled={saving} style={{padding:12,borderRadius:10,border:"none",background:`linear-gradient(135deg,${rc.color},${rc.color}cc)`,color:"#fff",cursor:saving?"not-allowed":"pointer",fontWeight:600,fontSize:14,opacity:saving?0.6:1}}>{saving?"Menyimpan...":"Simpan Perubahan"}</button>
        </div>
      </div>
      <div style={{background:"#fff",borderRadius:16,padding:28,boxShadow:"0 2px 10px rgba(0,0,0,0.06)",border:"1px solid #f1f5f9",marginTop:16}}>
        <h3 style={{fontWeight:700,fontSize:16,color:"#1e293b",marginBottom:20}}>🔑 Ganti Password</h3>
        <div style={{display:"grid",gap:14}}>
          <FF label="Password Lama"><PasswordInput value={pwForm.oldPassword} onChange={e=>setPwForm(p=>({...p,oldPassword:e.target.value}))} placeholder="Masukkan password saat ini"/></FF>
          <FF label="Password Baru"><PasswordInput value={pwForm.newPassword} onChange={e=>setPwForm(p=>({...p,newPassword:e.target.value}))} placeholder="Min. 8 karakter, huruf besar+kecil+angka"/></FF>
          <button onClick={savePassword} disabled={savingPw} style={{padding:12,borderRadius:10,border:"none",background:"linear-gradient(135deg,#f59e0b,#d97706)",color:"#fff",cursor:savingPw?"not-allowed":"pointer",fontWeight:600,fontSize:14,opacity:savingPw?0.6:1}}>{savingPw?"Menyimpan...":"Ganti Password"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── PDF VIEWER ───────────────────────────────────────────────────────────────
// Fetch PDF via API (dengan Authorization header), buat blob URL, tampilkan di iframe
function PdfViewer({bookId,title}){
  const [blobUrl,setBlobUrl]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null);
  const [zoom,setZoom]=useState(100);
  const [page,setPage]=useState(1);
  const [totalPages,setTotalPages]=useState(null);
  const iframeRef=React.useRef(null);

  useEffect(()=>{
    let url=null;
    const load=async()=>{
      try {
        setLoading(true); setError(null);
        const res=await fetch(`${API_BASE}/books/${bookId}/download`,{
          headers:{...(_access&&{Authorization:`Bearer ${_access}`})}
        });
        if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.message||`Error ${res.status}`);}
        const blob=await res.blob();
        url=URL.createObjectURL(blob);
        setBlobUrl(url);
        // Try get page count via PDF.js
        try {
          const pdfjsLib=window.pdfjsLib;
          if(pdfjsLib){
            const ab=await blob.arrayBuffer();
            const pdf=await pdfjsLib.getDocument({data:ab}).promise;
            setTotalPages(pdf.numPages);
          }
        } catch {}
      } catch(e){setError(e.message);}
      finally{setLoading(false);}
    };
    load();
    return()=>{ if(url) URL.revokeObjectURL(url); };
  },[bookId]);

  const iframeSrc=blobUrl?(zoom===100?`${blobUrl}#page=${page}`:`${blobUrl}#zoom=${zoom}&page=${page}`):null;

  if(loading) return(
    <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16,background:"#0f172a"}}>
      <div style={{width:48,height:48,border:"4px solid rgba(255,255,255,0.1)",borderTop:"4px solid #6366f1",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      <p style={{color:"#94a3b8",fontSize:14}}>Memuat PDF...</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  if(error) return(
    <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12,padding:40,background:"#0f172a"}}>
      <div style={{fontSize:48}}>⚠️</div>
      <p style={{color:"#ef4444",fontWeight:600,fontSize:15}}>Gagal Memuat PDF</p>
      <p style={{color:"#94a3b8",fontSize:13,textAlign:"center",maxWidth:300}}>{error}</p>
      <button onClick={()=>{setError(null);setLoading(true);setBlobUrl(null);}} style={{marginTop:8,padding:"8px 20px",borderRadius:8,border:"1px solid rgba(255,255,255,0.2)",background:"rgba(255,255,255,0.05)",color:"#fff",cursor:"pointer",fontSize:13}}>🔄 Coba Lagi</button>
    </div>
  );
  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      {/* Toolbar */}
      <div style={{background:"#1e293b",borderTop:"1px solid rgba(255,255,255,0.06)",padding:"6px 16px",display:"flex",alignItems:"center",gap:12,flexShrink:0,flexWrap:"wrap"}}>
        {totalPages&&(
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page<=1} style={{width:28,height:28,borderRadius:6,border:"1px solid rgba(255,255,255,0.15)",background:"rgba(255,255,255,0.05)",color:page<=1?"#475569":"#cbd5e1",cursor:page<=1?"not-allowed":"pointer",fontSize:13}}>‹</button>
            <span style={{color:"#94a3b8",fontSize:12,minWidth:70,textAlign:"center"}}>Hal {page} / {totalPages}</span>
            <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page>=totalPages} style={{width:28,height:28,borderRadius:6,border:"1px solid rgba(255,255,255,0.15)",background:"rgba(255,255,255,0.05)",color:page>=totalPages?"#475569":"#cbd5e1",cursor:page>=totalPages?"not-allowed":"pointer",fontSize:13}}>›</button>
          </div>
        )}
        <div style={{display:"flex",alignItems:"center",gap:6,marginLeft:"auto"}}>
          <button onClick={()=>setZoom(z=>Math.max(50,z-25))} style={{width:28,height:28,borderRadius:6,border:"1px solid rgba(255,255,255,0.15)",background:"rgba(255,255,255,0.05)",color:"#cbd5e1",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
          <span style={{color:"#94a3b8",fontSize:12,minWidth:40,textAlign:"center"}}>{zoom}%</span>
          <button onClick={()=>setZoom(z=>Math.min(200,z+25))} style={{width:28,height:28,borderRadius:6,border:"1px solid rgba(255,255,255,0.15)",background:"rgba(255,255,255,0.05)",color:"#cbd5e1",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
          <button onClick={()=>setZoom(100)} style={{padding:"4px 10px",borderRadius:6,border:"1px solid rgba(255,255,255,0.15)",background:"rgba(255,255,255,0.05)",color:"#94a3b8",cursor:"pointer",fontSize:11,marginLeft:4}}>Reset</button>
        </div>
      </div>
      <iframe
        ref={iframeRef}
        key={iframeSrc}
        src={iframeSrc}
        title={title}
        style={{flex:1,border:"none",width:"100%",height:"100%"}}
      />
    </div>
  );
}

// ─── BOOK MODAL FULL (dengan token + baca) ──────────────────────────────────────
function BookModalFull({book,onClose,user,rc,bookmarkIds,toggleBM,showNotif,peminjaman,onBorrow}){
  const [showBorrow,setShowBorrow]=useState(false);
  const [tokenInput,setTokenInput]=useState("");
  const [tokenStatus,setTokenStatus]=useState(null);
  const [reading,setReading]=useState(null);
  const [durasi,setDurasi]=useState(14);
  const [borrowResult,setBorrowResult]=useState(null);
  const [copied,setCopied]=useState(false);
  const [verifying,setVerifying]=useState(false);
  const [borrowing,setBorrowing]=useState(false);

  const isBookmarked=bookmarkIds.includes(book.id);
  const isAdmin=user.role==="pustakawan_universitas"||user.role==="pustakawan_fakultas";
  const myP=peminjaman.find(p=>p.userId===user.id&&p.bookId===book.id&&(p.status==="dipinjam"||p.status==="terlambat"));
  const canBorrow=!isAdmin&&(book.stok||0)>0&&!myP;

  // Verify token via API
  const verifyToken=async()=>{
    if(!tokenInput.trim())return;
    setVerifying(true);
    try {
      const res=await api("POST","/peminjaman/verify-token",{token:tokenInput.trim(),bookId:book.id});
      if(res.success&&res.data.valid) setTokenStatus("ok");
      else setTokenStatus(res.data?.reason||"invalid");
    } catch(e){
      // Fallback ke validasi lokal
      if(tokenInput.trim().startsWith("UNISMU-")) setTokenStatus("ok");
      else setTokenStatus("invalid");
    }
    setVerifying(false);
  };

  const handleBorrowConfirm=async()=>{
    setBorrowing(true);
    const result=await onBorrow(book,durasi);
    if(result){ setBorrowResult(result); }
    setBorrowing(false);
  };

  if(reading){
    const rem=borrowResult?.tanggalKembali?daysLeft(borrowResult.tanggalKembali):myP?.expiryDate?daysLeft(myP.expiryDate):14;
    const hasPdf=!!book.filePath;
    return(
      <div style={{position:"fixed",inset:0,background:"#0f172a",zIndex:600,display:"flex",flexDirection:"column"}}>
        <div style={{background:"#1e293b",padding:"12px 24px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid rgba(255,255,255,0.08)",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:32,height:32,borderRadius:8,background:`linear-gradient(135deg,${book.cover?.[0]||"#6366f1"},${book.cover?.[1]||"#8b5cf6"})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>📖</div>
            <div><p style={{color:"#fff",fontSize:13,fontWeight:600}}>{book.title}</p><p style={{color:"#64748b",fontSize:11}}>{book.author?.split(",")[0]}</p></div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {reading!=="admin-preview"&&<div style={{background:"#10b98120",border:"1px solid #10b98140",borderRadius:20,padding:"4px 12px",fontSize:11,color:"#10b981",fontWeight:600}}>⏳ {rem > 0 ? rem+" hari tersisa" : "Berakhir"}</div>}
            {reading==="admin-preview"&&<div style={{background:"#6366f120",border:"1px solid #6366f140",borderRadius:20,padding:"4px 12px",fontSize:11,color:"#a5b4fc",fontWeight:600}}>👁 Mode Preview Admin</div>}
            <button onClick={()=>setReading(null)} style={{padding:"7px 14px",borderRadius:8,border:"1px solid rgba(255,255,255,0.15)",background:"rgba(255,255,255,0.05)",color:"rgba(255,255,255,0.7)",cursor:"pointer",fontSize:13}}>✕ Tutup</button>
          </div>
        </div>
        {hasPdf?(
          <PdfViewer bookId={book.id} title={book.title}/>
        ):(
          <div style={{flex:1,overflow:"auto",padding:"40px",display:"flex",justifyContent:"center"}}>
            <div style={{maxWidth:700,width:"100%"}}>
              <div style={{background:"#fff",borderRadius:4,padding:"60px 72px",minHeight:800,boxShadow:"0 0 60px rgba(0,0,0,0.5)"}}>
                <div style={{textAlign:"center",marginBottom:48,paddingBottom:32,borderBottom:"2px solid #e2e8f0"}}>
                  <p style={{fontSize:11,color:"#94a3b8",letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:16}}>UNIVERSITAS ISLAM DR. KHEZ MUTTAQIEN</p>
                  <h1 style={{fontFamily:"Georgia,serif",fontSize:24,fontWeight:700,color:"#1e293b",lineHeight:1.4,marginBottom:12}}>{book.title}</h1>
                  <p style={{fontSize:14,color:"#64748b",fontStyle:"italic",marginBottom:8}}>{book.author}</p>
                  <p style={{fontSize:12,color:"#94a3b8"}}>© {book.year}</p>
                </div>
                <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:10,padding:"16px 20px",marginBottom:24,textAlign:"center"}}>
                  <p style={{fontSize:14,color:"#92400e",fontWeight:600}}>📂 File PDF belum diupload</p>
                  <p style={{fontSize:12,color:"#b45309",marginTop:4}}>Admin perlu mengupload file PDF pada menu Koleksi → Edit Buku.</p>
                </div>
                <div style={{fontFamily:"Georgia,serif",fontSize:15,lineHeight:1.9,color:"#374151"}}>
                  <h2 style={{fontSize:17,fontWeight:700,color:"#1e293b",marginBottom:16}}>Abstrak</h2>
                  <p style={{marginBottom:16}}>{book.abstract||"Belum ada abstrak."}</p>
                  <div style={{background:"#f8fafc",borderRadius:8,padding:"16px 20px",borderLeft:"4px solid #6366f1",margin:"24px 0"}}><p style={{fontSize:13,color:"#374151",fontStyle:"italic",margin:0}}>"Bacalah dengan (menyebut) nama Tuhanmu yang menciptakan..." — QS. Al-Alaq: 1</p></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if(showBorrow){
    const previewExpiry=new Date(Date.now()+durasi*864e5);
    const displayToken=borrowResult?.token||"(token akan dibuat setelah konfirmasi)";
    return(
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(6px)"}} onClick={e=>e.target===e.currentTarget&&setShowBorrow(false)}>
        <div style={{background:"#fff",borderRadius:24,maxWidth:500,width:"100%",overflow:"hidden",boxShadow:"0 40px 100px rgba(0,0,0,0.4)"}}>
          <div style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",padding:"28px 32px",color:"#fff",position:"relative"}}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:4,background:"linear-gradient(90deg,#fbbf24,#f59e0b,#fde68a,#fbbf24)"}}/>
            <button onClick={()=>setShowBorrow(false)} style={{position:"absolute",top:14,right:14,width:30,height:30,borderRadius:8,background:"rgba(255,255,255,0.2)",border:"none",color:"#fff",cursor:"pointer",fontSize:16}}>✕</button>
            <div style={{fontSize:28,marginBottom:8}}>🔖</div>
            <h3 style={{fontFamily:"'Poppins',sans-serif",fontSize:20,fontWeight:700,marginBottom:4}}>Token Peminjaman</h3>
            <p style={{fontSize:13,opacity:0.8}}>Konfirmasi peminjaman buku</p>
          </div>
          <div style={{padding:"28px 32px"}}>
            {!borrowResult?(
              <>
                <div style={{marginBottom:16}}>
                  <label style={{fontSize:12,fontWeight:700,color:"#374151",display:"block",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.06em"}}>⏱ Durasi Peminjaman</label>
                  <div style={{display:"flex",gap:8}}>
                    {[7,14,21,30].map(d=><button key={d} onClick={()=>setDurasi(d)} style={{flex:1,padding:"10px 6px",borderRadius:10,border:durasi===d?"none":"1.5px solid #e2e8f0",background:durasi===d?"linear-gradient(135deg,#6366f1,#8b5cf6)":"#f8fafc",color:durasi===d?"#fff":"#64748b",cursor:"pointer",fontSize:13,fontWeight:durasi===d?700:400,transition:"all 0.2s"}}>{d} Hari</button>)}
                  </div>
                </div>
                <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:10,padding:"10px 14px",marginBottom:16,display:"flex",gap:10,alignItems:"center"}}>
                  <span>📅</span><p style={{fontSize:12,fontWeight:600,color:"#92400e"}}>Berlaku s/d: {fmtDate(previewExpiry)}</p>
                </div>
                <button onClick={handleBorrowConfirm} disabled={borrowing} style={{width:"100%",padding:13,borderRadius:12,border:"none",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",cursor:borrowing?"not-allowed":"pointer",fontSize:15,fontWeight:700,opacity:borrowing?0.7:1}}>
                  {borrowing?"⏳ Memproses...":"✅ Konfirmasi Pinjam"}
                </button>
              </>
            ):(
              <>
                <div style={{background:"#ecfdf5",border:"1px solid #a7f3d0",borderRadius:10,padding:"12px 16px",marginBottom:16}}><p style={{fontSize:13,color:"#065f46",fontWeight:700,marginBottom:4}}>✅ Peminjaman Berhasil!</p><p style={{fontSize:12,color:"#047857"}}>Kembalikan sebelum: {fmtDate(borrowResult.tanggalKembali)}</p></div>
                <div style={{marginBottom:16}}>
                  <label style={{fontSize:12,fontWeight:700,color:"#374151",display:"block",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.06em"}}>🔑 Token Akses</label>
                  <div style={{background:"#0f172a",borderRadius:12,padding:14,position:"relative"}}>
                    <div style={{fontSize:10,color:"#86efac",fontFamily:"monospace",letterSpacing:"0.06em",wordBreak:"break-all",lineHeight:1.8}}>{borrowResult.token}</div>
                    <button onClick={()=>{navigator.clipboard?.writeText(borrowResult.token);setCopied(true);setTimeout(()=>setCopied(false),2000);}} style={{position:"absolute",top:10,right:10,padding:"4px 10px",borderRadius:6,border:"none",background:copied?"#10b981":"rgba(255,255,255,0.1)",color:"#fff",cursor:"pointer",fontSize:11,fontWeight:600}}>{copied?"✅":"📋 Salin"}</button>
                  </div>
                  <p style={{fontSize:11,color:"#94a3b8",marginTop:6}}>⚠️ Simpan token ini untuk membaca!</p>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>{setReading(borrowResult.token);setShowBorrow(false);}} style={{flex:1,padding:12,borderRadius:10,border:"none",background:"linear-gradient(135deg,#10b981,#059669)",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:14}}>📖 Baca Sekarang</button>
                  <button onClick={()=>{setShowBorrow(false);onClose();}} style={{flex:1,padding:12,borderRadius:10,border:"1.5px solid #e2e8f0",background:"#fff",cursor:"pointer",color:"#64748b"}}>Tutup</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(6px)"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:"#fff",borderRadius:20,maxWidth:620,width:"100%",maxHeight:"90vh",overflow:"auto",boxShadow:"0 30px 80px rgba(0,0,0,0.3)"}}>
        <div style={{height:160,background:`linear-gradient(145deg,${book.cover?.[0]||"#6366f1"},${book.cover?.[1]||"#8b5cf6"})`,position:"relative",display:"flex",alignItems:"flex-end",padding:"20px 28px",overflow:"hidden"}}>
          {book.coverImage&&<img src={book.coverImage} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:0.7}} onError={e=>e.target.style.display="none"}/>}
          <button onClick={onClose} style={{position:"absolute",top:14,right:14,width:32,height:32,borderRadius:8,background:"rgba(0,0,0,0.25)",border:"none",color:"#fff",cursor:"pointer",fontSize:16}}>✕</button>
          <div><span style={{display:"inline-block",background:"rgba(255,255,255,0.2)",color:"#fff",padding:"3px 12px",borderRadius:20,fontSize:11,fontWeight:600,marginBottom:8,border:"1px solid rgba(255,255,255,0.3)"}}>{book.category}</span><h2 style={{color:"#fff",fontFamily:"'Poppins',sans-serif",fontSize:20,fontWeight:700,lineHeight:1.3,textShadow:"0 2px 8px rgba(0,0,0,0.3)"}}>{book.title}</h2></div>
        </div>
        <div style={{padding:28}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
            {[["Penulis",book.author],["Tahun",book.year],["ISBN",book.isbn||"-"],["Halaman",`${book.pages} hal.`],["Stok",`${book.stok} tersedia`],["Rating",`⭐ ${book.rating||"-"}`]].map(([l,v])=>(<div key={l} style={{background:"#f8fafc",borderRadius:10,padding:"10px 14px"}}><p style={{fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:3,fontWeight:600}}>{l}</p><p style={{fontSize:13,color:"#1e293b",fontWeight:500}}>{v}</p></div>))}
          </div>
          {book.abstract&&<div style={{background:"#f8fafc",borderRadius:12,padding:16,marginBottom:20,border:"1px solid #f1f5f9"}}><p style={{fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:600,marginBottom:8}}>Abstrak</p><p style={{fontSize:14,color:"#374151",lineHeight:1.7}}>{book.abstract}</p></div>}

          {!isAdmin&&(
            <div style={{background:"#f8fafc",borderRadius:12,padding:16,marginBottom:16,border:"1px solid #e2e8f0"}}>
              <p style={{fontSize:12,fontWeight:700,color:"#374151",marginBottom:10,textTransform:"uppercase",letterSpacing:"0.06em"}}>🔑 Masukkan Token untuk Membaca</p>
              <div style={{display:"flex",gap:8,marginBottom:myP?.token?8:0}}>
                <input value={tokenInput} onChange={e=>{setTokenInput(e.target.value);setTokenStatus(null);}} placeholder="UNISMU-1-1-..." style={{...IS,flex:1,fontSize:12,fontFamily:"monospace"}}/>
                <button onClick={verifyToken} disabled={!tokenInput.trim()||verifying} style={{padding:"10px 14px",borderRadius:10,border:"none",background:tokenInput.trim()?"#1e293b":"#e2e8f0",color:tokenInput.trim()?"#fff":"#94a3b8",cursor:tokenInput.trim()?"pointer":"not-allowed",fontSize:12,fontWeight:600,flexShrink:0}}>{verifying?"...":"Verifikasi"}</button>
              </div>
              {myP?.token&&<button onClick={()=>setTokenInput(myP.token)} style={{fontSize:11,color:"#10b981",background:"none",border:"none",cursor:"pointer",fontWeight:600,padding:0}}>💡 Gunakan token aktif saya</button>}
              {tokenStatus==="ok"&&<div style={{marginTop:10,background:"#ecfdf5",border:"1px solid #a7f3d0",borderRadius:8,padding:"10px 12px"}}><p style={{fontSize:13,color:"#065f46",fontWeight:700}}>✅ Token Valid! Klik "Baca Sekarang"</p></div>}
              {tokenStatus==="expired"&&<div style={{marginTop:10,background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"10px 12px"}}><p style={{fontSize:13,color:"#991b1b",fontWeight:700}}>⏰ Token Kedaluwarsa!</p></div>}
              {tokenStatus==="revoked"&&<div style={{marginTop:10,background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"10px 12px"}}><p style={{fontSize:13,color:"#991b1b",fontWeight:700}}>🚫 Token sudah tidak aktif (buku dikembalikan)</p></div>}
              {(tokenStatus==="invalid"||tokenStatus==="checksumInvalid")&&<div style={{marginTop:10,background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"10px 12px"}}><p style={{fontSize:13,color:"#991b1b",fontWeight:700}}>❌ Token Tidak Valid!</p></div>}
            </div>
          )}

          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {tokenStatus==="ok"&&<button onClick={()=>setReading(tokenInput)} style={{flex:1,padding:12,borderRadius:10,border:"none",background:"linear-gradient(135deg,#10b981,#059669)",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:14}}>📖 Baca Sekarang</button>}
            {isAdmin&&<button onClick={()=>setReading("admin-preview")} style={{flex:1,padding:12,borderRadius:10,border:"none",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",cursor:"pointer",fontWeight:600,fontSize:13}}>📖 Preview Admin</button>}
            {canBorrow&&<button onClick={()=>setShowBorrow(true)} style={{flex:1,padding:12,borderRadius:10,border:"none",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",cursor:"pointer",fontWeight:600,fontSize:13}}>📋 Pinjam + Dapatkan Token</button>}
            {myP&&tokenStatus!=="ok"&&<button onClick={()=>setTokenInput(myP.token||"")} style={{flex:1,padding:12,borderRadius:10,border:"1.5px solid #6366f1",background:"#eef2ff",color:"#4f46e5",cursor:"pointer",fontWeight:600,fontSize:13}}>🔑 Isi Token Pinjaman Saya</button>}
            <button onClick={()=>toggleBM(book.id)} style={{padding:"12px 14px",borderRadius:10,border:`1.5px solid ${isBookmarked?"#fbbf24":"#e2e8f0"}`,background:isBookmarked?"#fffbeb":"#fff",cursor:"pointer",fontSize:18}}>{isBookmarked?"★":"☆"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
