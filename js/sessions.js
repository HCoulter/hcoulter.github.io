// Fetch and render admin sessions into the `#sessions-list` element.
(function(){
    function getBaseUrl() {
      const host = localStorage.getItem('apiHost');
      if (!host) throw new Error('API host not configured');
      return host;
    }

    const SESSIONS_URL = () =>
      getBaseUrl() + '/api/admin/sessions';

    function openSessionById(id){
        try{
            console.log('[sessions.js] openSessionById called', id);
            if(!id) return;
            // ensure sessions panel visible
            try{ const panel = document.getElementById('sessions-panel'); if(panel && (panel.style.display === 'none' || panel.style.display === '')) panel.style.display = 'block'; }catch(e){}

            // Try several forms of id lookup (number/string) to be robust
            let marker = null;
            try{ marker = window.sessionMarkersById && (window.sessionMarkersById[id] || window.sessionMarkersById[String(id)] || window.sessionMarkersById[Number(id)]); }catch(e){ marker = null; }
            console.log('[sessions.js] marker lookup', !!marker, marker && marker.sessionId);
            if(marker){
                const latlng = marker.getLatLng();
                if(latlng) (window.map && window.map.panTo) ? window.map.panTo(latlng) : map && map.panTo && map.panTo(latlng);
                try{ console.log('[sessions.js] opening popup for marker', marker.sessionId, 'hasSessionData', !!marker.sessionData); marker.openPopup(); }catch(e){ try{ marker.fire && marker.fire('click'); }catch(_){} }
                // Ensure popup populated after open (covering event-order races)
                try{ setTimeout(()=>{ if(window.populateSessionPopup) window.populateSessionPopup(marker); }, 60); }catch(e){}
            } else {
                // if marker not found, refresh sessions (which will eventually add markers)
                fetchSessions();
            }

            // remove previous active
            const prev = document.querySelector('#sessions-list .session-entry.active');
            if(prev) prev.classList.remove('active');

            // highlight matching sidebar entry
            try{
                var selector = '#sessions-list [data-session-id="' + String(id).replace(/"/g, '\\"') + '"]';
                const el = document.querySelector(selector);
                if(el){ el.classList.add('active'); el.scrollIntoView({behavior:'smooth', block: 'center'}); }
            }catch(e){}
        }catch(e){ console.error('openSessionById', e); }
    }

    // Export helper for external use
    window.openSessionById = openSessionById;

    function renderSessions(list){
        const container = document.getElementById('sessions-list');
        if(!container) return;
        container.innerHTML = '';
        if(!Array.isArray(list) || list.length === 0){
            container.innerHTML = '<div class="text-muted">No active sessions</div>';
            return;
        }
        list.forEach(s => {
            const el = document.createElement('div');
            el.className = 'session-entry';
            el.style.padding = '6px 8px';
            el.style.borderBottom = '1px solid #eee';
            const api = document.createElement('div'); api.textContent = s.apiKey || '(unknown)'; api.style.fontWeight = '600';
            const meta = document.createElement('div');
            meta.style.fontSize = '12px'; meta.style.color = '#666';
            const sid = (s.sessionId || s.sessionId === 0) ? s.sessionId : (s.apiKey || s.sessionName || ('session-' + Math.random().toString(36).slice(2,7)));
            const issued = s.issuedAt ? (' • issued ' + new Date(s.issuedAt).toLocaleString()) : '';
            meta.textContent = sid + issued;
            el.appendChild(api); el.appendChild(meta);
            // clickable: pan to marker and open popup if available
            el.style.cursor = 'pointer';
            el.setAttribute('data-session-id', sid);
            el.addEventListener('click', function(){
                const id = this.getAttribute('data-session-id');
                openSessionById(id);
            });
            container.appendChild(el);
        });
    }

    async function fetchSessions(){
        console.log('[sessions.js] fetchSessions called');
        try{
            const res = await fetch(SESSIONS_URL(), { method: 'GET' });
            if(!res.ok){
                renderError('HTTP ' + res.status);
                return;
            }
            const data = await res.json();
            console.log('[sessions.js] fetched', data && data.length ? data.length : 0);
            renderSessions(data);
            try{ 
                // If map/addSessionMarkers isn't ready yet, retry a few times until it is.
                const tryAddMarkers = (sessions, attempt)=>{
                    try{
                        if(window.addSessionMarkers){
                            window.addSessionMarkers(sessions);
                            return true;
                        }
                    }catch(e){ console.error('addSessionMarkers error', e); }
                    if(attempt <= 0) return false;
                    setTimeout(()=> tryAddMarkers(sessions, attempt-1), 500);
                    return false;
                };
                tryAddMarkers(data, 10);
            }catch(e){ console.error('failed to schedule adding session markers', e); }
        }catch(e){
            console.log('[sessions.js] fetching sessions from', SESSIONS_URL());
            renderError(e && e.message ? e.message : String(e));
        }
    }

    function renderError(msg){
        const c = document.getElementById('sessions-list');
        if(!c) return;
        c.innerHTML = '<div class="text-danger">Error loading sessions: ' + String(msg) + '</div>';
    }

    document.addEventListener('DOMContentLoaded', function(){
        const btn = document.getElementById('refresh-sessions');
        if(btn) btn.addEventListener('click', fetchSessions);
        const toggle = document.getElementById('toggle-sessions');
        if(toggle){
            toggle.addEventListener('click', function(){
                const panel = document.getElementById('sessions-panel');
                if(!panel) return;
                if(panel.style.display === 'block' || panel.style.display === 'flex'){
                    panel.style.display = 'none';
                } else {
                    panel.style.display = 'block';
                    fetchSessions();
                }
            });
        }
        const closeBtn = document.getElementById('sessions-close');
        if(closeBtn){
            closeBtn.addEventListener('click', function(){
                const panel = document.getElementById('sessions-panel'); if(panel) panel.style.display = 'none';
            });
        }
        // Try to fetch once on load — only if currently authenticated (jwt present)
        try{
            const token = window.getJwtToken && window.getJwtToken();
            if(token) {
                // don't automatically show panel, but preload sessions list
                fetchSessions();
            }
        }catch(e){}
    });

    // Export for manual usage
    window.fetchAdminSessions = fetchSessions;
})();
