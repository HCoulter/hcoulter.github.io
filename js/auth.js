// Lightweight auth helper. Exposes window.getJwtToken(), window.authFetch(),
// and patches global fetch to include Authorization: Bearer <token> when present.
(function(){
    const TOKEN_KEY = 'jwtToken';
    const API_HOST_KEY = 'apiHost';

    function getJwtToken(){ return localStorage.getItem(TOKEN_KEY); }

    function getApiHost() {
      return localStorage.getItem(API_HOST_KEY);
    }

    async function authFetch(input, init){
        init = init || {};
        // normalize headers into a Headers instance so we can use has/set
        init.headers = new Headers(init.headers || {});
        const token = getJwtToken();
        if(token && !init.headers.has('Authorization')){
            init.headers.set('Authorization', 'Bearer ' + token);
        }
        return fetch(input, init);
    }

    // Patch global fetch to attach token automatically when available and not already present.
    const nativeFetch = window.fetch.bind(window);
    window.fetch = function(input, init){
        init = init || {};
        try{
            init.headers = new Headers(init.headers || {});
            if(!init.headers.has('Authorization')){
                const token = getJwtToken();
                if(token) init.headers.set('Authorization', 'Bearer ' + token);
            }
        }catch(e){
            // If creating Headers fails (very old browsers), just continue without header normalization
        }
        return nativeFetch(input, init);
    };

    // Export helpers
    window.getJwtToken = getJwtToken;
    window.authFetch = authFetch;
})();

// Attach a robust logout handler to the top bar after DOM is ready.
document.addEventListener('DOMContentLoaded', function(){
    try{
        const btn = document.getElementById('top-logout');
        if(!btn) return;
        btn.addEventListener('click', function(){
            try{ localStorage.removeItem('jwtToken'); }catch(e){}
            // Reloading ensures the inline auth logic runs and shows the login overlay.
            location.reload();
        });
    }catch(e){ /* swallow */ }
});
