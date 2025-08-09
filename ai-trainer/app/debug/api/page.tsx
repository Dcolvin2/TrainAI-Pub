'use client';
import { useState } from 'react';

export default function ApiDebug() {
  const [user, setUser] = useState('');
  const [msg, setMsg] = useState('kettlebell workout 30 min');
  const [out, setOut] = useState<any>(null);

  return (
    <div style={{padding:20, fontFamily:'ui-sans-serif'}}>
      <h2>API Debug</h2>

      <label> User UUID:&nbsp;
        <input value={user} onChange={e=>setUser(e.target.value)} placeholder="951f7485-..." style={{width:360}} />
      </label>

      <div style={{marginTop:12}}>
        <button onClick={async ()=>{
          const r = await fetch(`/api/debug/equipment?user=${encodeURIComponent(user)}`);
          setOut(await r.json());
        }}>Check Equipment</button>
      </div>

      <div style={{marginTop:24}}>
        <label> Message:&nbsp;
          <input value={msg} onChange={e=>setMsg(e.target.value)} style={{width:360}} />
        </label>
        <div>
          <button onClick={async ()=>{
            const r = await fetch(`/api/chat-workout?user=${encodeURIComponent(user)}`, {
              method: 'POST',
              headers: {'Content-Type':'application/json'},
              body: JSON.stringify({ message: msg })
            });
            setOut(await r.json());
          }}>Send to Chat</button>
        </div>
      </div>

      <pre style={{marginTop:24, background:'#0b1220', color:'#9cff9c', padding:12, borderRadius:8, overflow:'auto'}}>
        {out ? JSON.stringify(out, null, 2) : '// responses appear here'}
      </pre>
    </div>
  );
}


