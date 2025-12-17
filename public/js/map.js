'use strict';

import { Position } from './model/Position.js';

// Import controls
import { CollectionControl } from './controls/collection_control.js';
import { CoordinatesControl } from './controls/coordinates_control.js';
import { LocalCoordinatesControl } from './controls/local_coordinates_control.js';
import { RegionBaseCoordinatesControl } from './controls/region_base_coordinates_control.js';
import { GridControl } from './controls/grid_control.js';
import { LocationLookupControl } from './controls/location_lookup_control.js';
import { MapLabelControl } from './controls/map_label_control.js';
import { PlaneControl } from './controls/plane_control.js';
import { RegionLabelsControl } from './controls/region_labels_control.js';
import { RegionLookupControl } from './controls/region_lookup_control.js';
import { Region } from './model/Region.js';

$(document).ready(function () {

    const currentUrl = new URL(window.location.href);

    const urlCentreX = currentUrl.searchParams.get("centreX");
    const urlCentreY = currentUrl.searchParams.get("centreY");
    const urlCentreZ = currentUrl.searchParams.get("centreZ");
    const urlZoom = currentUrl.searchParams.get("zoom");

    const urlRegionID = currentUrl.searchParams.get("regionID");

    var map = L.map('map', {
        //maxBounds: L.latLngBounds(L.latLng(-40, -180), L.latLng(85, 153))
        zoomControl: false,
        renderer: L.canvas()
    });

    map.plane = 0;

    map.updateMapPath = function () {
        if (map.tile_layer !== undefined) {
            map.removeLayer(map.tile_layer);
        }
        map.tile_layer = L.tileLayer('https://raw.githubusercontent.com/Explv/osrs_map_tiles/master/' + map.plane + '/{z}/{x}/{y}.png', {
            minZoom: 4,
            maxZoom: 11,
            attribution: 'Map data',
            noWrap: true,
            tms: true
        });
        map.tile_layer.addTo(map);
        map.invalidateSize();
    }

    map.updateMapPath();
    map.getContainer().focus();

    map.addControl(new CoordinatesControl());
    map.addControl(new RegionBaseCoordinatesControl());
    map.addControl(new LocalCoordinatesControl());
    map.addControl(L.control.zoom());
    map.addControl(new PlaneControl());
    map.addControl(new LocationLookupControl());
    map.addControl(new MapLabelControl());
    map.addControl(new CollectionControl({ position: 'topright' }));
    map.addControl(new RegionLookupControl());
    map.addControl(new GridControl());
    map.addControl(new RegionLabelsControl());

    // Layer for session markers (added by admin sessions fetcher)
    map.sessionMarkers = L.layerGroup().addTo(map);

    // Utility to escape html for popups
    function escapeHtml(str){
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Expose helpers to add/clear session markers from other scripts
    // Shared popup population function (can be called externally)
    window.populateSessionPopup = function(marker){
        try{
            if(!marker) return false;
            const popup = marker.getPopup && marker.getPopup();
            if(!popup) return false;
            const el = popup.getElement();
            if(!el) return false;
            const safePopupId = 'session-popup-' + String(marker.sessionId).replace(/"/g, '&quot;');
            const root = el.querySelector('[data-popup-id="' + safePopupId + '"]');
            if(!root) return false;

            const sd = marker.sessionData || {};

            // render overview
            const overview = root.querySelector('.tab-panel[data-panel="overview"]');
            if(overview){
                overview.innerHTML = '';
                const title = sd.apiKey || sd.sessionId || 'session';
                const issued = sd.issuedAt ? '<div>Issued: ' + escapeHtml(sd.issuedAt) + '</div>' : '';
                const lastReq = sd.lastRequest && sd.lastRequest.data ? '<div>Last: ' + escapeHtml(String(sd.lastRequest.at || sd.lastRequest.timestamp || '')) + '</div>' : '';
                const coords = sd.lastRequest && sd.lastRequest.data && sd.lastRequest.data.location ?
                    ('<div>Location: x=' + escapeHtml(String(sd.lastRequest.data.location.posX)) + ' y=' + escapeHtml(String(sd.lastRequest.data.location.posY)) + ' z=' + escapeHtml(String(sd.lastRequest.data.location.posZ || 0)) + '</div>') : '';
                overview.innerHTML = '<div style="font-weight:700;margin-bottom:6px">' + escapeHtml(title) + '</div>' + issued + lastReq + coords;
            }

            // render inventory as icon grid
            const invPanel = root.querySelector('.tab-panel[data-panel="inventory"]');
            if(invPanel){
                invPanel.innerHTML = '';
                try{
                    const items = (sd.lastRequest && sd.lastRequest.data && sd.lastRequest.data.inventory && sd.lastRequest.data.inventory.items) || [];
                    if(items.length === 0) {
                        invPanel.innerHTML = '<div class="text-muted">No inventory items</div>';
                    } else {
                        const grid = document.createElement('div');
                        grid.className = 'items-grid';
                        items.forEach(it => {
                            const box = document.createElement('div'); box.className = 'item-box';
                            const iconWrap = document.createElement('div'); iconWrap.className = 'item-icon';
                            const img = document.createElement('img');
                            img.alt = String(it.itemId);
                            // candidate icon sources (try each in order)
                            const srcs = [
                                // try osrsreboxed raw github first (user-provided source)
                                'https://raw.githubusercontent.com/0xNeffarion/osrsreboxed-db/master/docs/items-icons/' + encodeURIComponent(String(it.itemId)) + '.png',
                                'https://www.osrsbox.com/osrsbox-db/items-icons/' + encodeURIComponent(String(it.itemId)) + '.png',
                                'https://raw.githubusercontent.com/osrsbox/osrsbox-db/master/items-icons/' + encodeURIComponent(String(it.itemId)) + '.png'
                            ];
                            let tryIndex = 0;
                            const tryNext = () => {
                                if(tryIndex >= srcs.length){
                                    // all failed -> fallback to showing id text
                                    try{ img.style.display = 'none'; iconWrap.textContent = String(it.itemId); console.warn('[items] icon not found for', it.itemId); }catch(e){}
                                    return;
                                }
                                const src = srcs[tryIndex++];
                                img.src = src;
                            };
                            img.onerror = function(){ console.warn('[items] icon load failed for', img.src); tryNext(); };
                            // start trying
                            tryNext();
                            iconWrap.appendChild(img);
                            box.appendChild(iconWrap);
                            if(it.amount && it.amount > 1){ const qty = document.createElement('div'); qty.className = 'item-qty'; qty.textContent = String(it.amount); box.appendChild(qty); }
                            grid.appendChild(box);
                        });
                        invPanel.appendChild(grid);
                    }
                }catch(e){ invPanel.innerHTML = '<div class="text-danger">Error showing inventory</div>'; }
            }

            // render bank
            const bankPanel = root.querySelector('.tab-panel[data-panel="bank"]');
            if(bankPanel){
                bankPanel.innerHTML = '';
                try{
                    const bankItems = (sd.lastRequest && sd.lastRequest.data && sd.lastRequest.data.bank && sd.lastRequest.data.bank.items) || [];
                    if(bankItems.length === 0){
                        bankPanel.innerHTML = '<div class="text-muted">No bank items</div>';
                    } else {
                        const grid = document.createElement('div');
                        grid.className = 'items-grid bank-grid';
                        // bank may have slots out of order; sort by slot
                        bankItems.slice().sort((a,b)=> (Number(a.slot)||0) - (Number(b.slot)||0)).forEach(it => {
                            const box = document.createElement('div'); box.className = 'item-box';
                            const iconWrap = document.createElement('div'); iconWrap.className = 'item-icon';
                            const img = document.createElement('img');
                            img.alt = String(it.itemId);
                            const srcs = [
                                'https://raw.githubusercontent.com/0xNeffarion/osrsreboxed-db/master/docs/items-icons/' + encodeURIComponent(String(it.itemId)) + '.png',
                                'https://www.osrsbox.com/osrsbox-db/items-icons/' + encodeURIComponent(String(it.itemId)) + '.png',
                                'https://raw.githubusercontent.com/osrsbox/osrsbox-db/master/items-icons/' + encodeURIComponent(String(it.itemId)) + '.png'
                            ];
                            let tryIndex = 0;
                            const tryNext = () => {
                                if(tryIndex >= srcs.length){
                                    try{ img.style.display = 'none'; iconWrap.textContent = String(it.itemId); console.warn('[items] bank icon not found for', it.itemId); }catch(e){}
                                    return;
                                }
                                const src = srcs[tryIndex++];
                                img.src = src;
                            };
                            img.onerror = function(){ console.warn('[items] bank icon load failed for', img.src); tryNext(); };
                            tryNext();
                            iconWrap.appendChild(img);
                            box.appendChild(iconWrap);
                            // show slot label
                            if(it.amount && it.amount > 1){ const qty = document.createElement('div'); qty.className = 'item-qty'; qty.textContent = String(it.amount); box.appendChild(qty); }
                            grid.appendChild(box);
                        });
                        // make bank panel scrollable if content exceeds available space
                        bankPanel.appendChild(grid);
                    }
                }catch(e){ bankPanel.innerHTML = '<div class="text-danger">Error showing bank</div>'; }
            }

            // render skills
            const skillsPanel = root.querySelector('.tab-panel[data-panel="skills"]');
            if(skillsPanel){
                skillsPanel.innerHTML = '';
                try{
                    const skillsObj = (sd.lastRequest && sd.lastRequest.data && sd.lastRequest.data.skillList && sd.lastRequest.data.skillList.skills) || (sd.skillList && sd.skillList.skills) || {};
                    const keys = Object.keys(skillsObj || {});
                    if(keys.length === 0){
                        skillsPanel.innerHTML = '<div class="text-muted">No skill data</div>';
                    } else {
                        // sort by level desc then name
                        keys.sort((a,b)=>{ const la = Number(skillsObj[a]||0); const lb = Number(skillsObj[b]||0); if(la===lb) return a.localeCompare(b); return lb-la; });
                        const grid = document.createElement('div');
                        grid.className = 'skills-grid';

                        // mapping skill name -> wiki icon filename (best-effort)
                        const iconMap = {
                            'Attack':'Attack_icon.png','Strength':'Strength_icon.png','Defence':'Defence_icon.png','Ranged':'Ranged_icon.png','Prayer':'Prayer_icon.png','Magic':'Magic_icon.png','Runecraft':'Runecraft_icon.png','Construction':'Construction_icon.png','Hitpoints':'Hitpoints_icon.png','Agility':'Agility_icon.png','Herblore':'Herblore_icon.png','Thieving':'Thieving_icon.png','Crafting':'Crafting_icon.png','Fletching':'Fletching_icon.png','Slayer':'Slayer_icon.png','Hunter':'Hunter_icon.png','Mining':'Mining_icon.png','Smithing':'Smithing_icon.png','Fishing':'Fishing_icon.png','Cooking':'Cooking_icon.png','Firemaking':'Firemaking_icon.png','Woodcutting':'Woodcutting_icon.png','Farming':'Farming_icon.png','Sailing':'Sailing_icon.png'
                        };

                        let total = 0;
                        keys.forEach(name => {
                            const lvl = Number(skillsObj[name] || 0);
                            total += lvl;
                            const box = document.createElement('div');
                            box.className = 'skill-box';

                            // icon element
                            const iconWrap = document.createElement('div'); iconWrap.className = 'skill-icon';
                            const iconFile = iconMap[name];
                            if(iconFile){
                                const img = document.createElement('img');
                                img.src = 'https://oldschool.runescape.wiki/images/' + encodeURIComponent(iconFile);
                                img.alt = name;
                                // fallback to initials if image fails
                                img.onerror = function(){
                                    try{ iconWrap.textContent = name.split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase(); }
                                    catch(e){ iconWrap.textContent = '?'; }
                                    img.style.display = 'none';
                                };
                                iconWrap.appendChild(img);
                            } else {
                                iconWrap.textContent = name.split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase();
                            }

                            const meta = document.createElement('div'); meta.className = 'skill-meta';
                            const nm = document.createElement('div'); nm.className = 'skill-name'; nm.textContent = name;
                            nm.style.marginBottom = '4px';
                            const lv = document.createElement('div'); lv.className = 'skill-level'; lv.textContent = String(lvl);
                            lv.style.alignSelf = 'flex-start';
                            lv.style.textAlign = 'left';

                            // append name then level on the next line (level right-aligned)
                            meta.appendChild(nm);
                            meta.appendChild(lv);
                            const spacer = document.createElement('div'); spacer.style.height = '6px';
                            meta.appendChild(spacer);

                            box.appendChild(iconWrap);
                            box.appendChild(meta);
                            grid.appendChild(box);
                        });

                        // wrap grid and total so total stays inside the panel
                        const wrapper = document.createElement('div');
                        wrapper.style.display = 'flex';
                        wrapper.style.flexDirection = 'column';
                        wrapper.style.height = '100%';
                        grid.style.flex = '1 1 auto';
                        grid.style.overflow = 'hidden';
                        wrapper.appendChild(grid);
                        // total level display
                        const totalEl = document.createElement('div'); totalEl.className = 'skills-total'; totalEl.textContent = 'Total level: ' + total;
                        totalEl.style.flex = '0 0 auto';
                        totalEl.style.marginTop = '8px';
                        wrapper.appendChild(totalEl);
                        skillsPanel.appendChild(wrapper);
                    }
                }catch(e){ skillsPanel.innerHTML = '<div class="text-danger">Error showing skills</div>'; }
            }

            // wire tab switching (set overview active by default)
            try{
                const buttons = root.querySelectorAll('.tab-btn');
                buttons.forEach(b => {
                    // remove previous listeners by cloning
                    const nb = b.cloneNode(true);
                    nb.addEventListener('click', function(){
                        const tab = nb.getAttribute('data-tab');
                        const panels = root.querySelectorAll('.tab-panel');
                        panels.forEach(p => p.style.display = (p.getAttribute('data-panel') === tab) ? '' : 'none');
                    });
                    b.parentNode.replaceChild(nb, b);
                });

                const panels = root.querySelectorAll('.tab-panel');
                panels.forEach(p => p.style.display = (p.getAttribute('data-panel') === 'overview') ? '' : 'none');
            }catch(e){}

            try{ console.log('[map] populateSessionPopup completed for', marker.sessionId); }catch(e){}
            return true;
        }catch(e){ console.error('populateSessionPopup error', e); return false; }
    };

    window.addSessionMarkers = function(sessions){
        try{
            if(!map.sessionMarkers) map.sessionMarkers = L.layerGroup().addTo(map);
            map.sessionMarkers.clearLayers();
            // map of sessionId -> marker for external access
            window.sessionMarkersById = {};
            if(!Array.isArray(sessions)) return;
            sessions.forEach(s => {
                try{
                    const loc = s && s.lastRequest && s.lastRequest.data && s.lastRequest.data.location;
                    if(!loc || typeof loc.posX !== 'number' || typeof loc.posY !== 'number') return;
                    const p = new Position(Number(loc.posX), Number(loc.posY), Number(loc.posZ || 0));
                    const latlng = p.toLatLng(map);
                    const marker = L.circleMarker(latlng, { radius: 6, color: '#ff5722', fillColor: '#ff8a50', fillOpacity: 0.95, interactive: true, pane: 'markerPane' });
                    marker.sessionId = s.sessionId || s.sessionId === 0 ? s.sessionId : (s.apiKey || ('session-' + Math.random().toString(36).slice(2,7)));
                    marker.sessionData = s;

                    // Build popup skeleton with tabs
                    const popupId = 'session-popup-' + String(marker.sessionId);
                    const safePopupId = popupId.replace(/"/g, '&quot;');
                    const content = `
                        <div data-popup-id="${safePopupId}" class="session-popup" style="min-width:240px;max-width:800px;min-height:120px;max-height:600px;">
                                <div style="display:flex;gap:6px;margin-bottom:8px">
                                <button class="btn btn-xs btn-default tab-btn" data-tab="overview">Overview</button>
                                <button class="btn btn-xs btn-default tab-btn" data-tab="inventory">Inventory</button>
                                <button class="btn btn-xs btn-default tab-btn" data-tab="bank">Bank</button>
                                <button class="btn btn-xs btn-default tab-btn" data-tab="skills">Skills</button>
                            </div>
                            <div class="tab-content">
                                <div class="tab-panel" data-panel="overview"></div>
                                <div class="tab-panel" data-panel="inventory" style="display:none"></div>
                                <div class="tab-panel" data-panel="bank" style="display:none;overflow:auto"></div>
                                <div class="tab-panel" data-panel="skills" style="display:none"></div>
                            </div>
                        </div>`;

                    marker.bindPopup(content, { maxWidth: 520, minWidth: 520, maxHeight: 420, minHeight: 420 });

                    // When popup opens, populate panels and wire tab switching
                    marker.on('popupopen', function(e){
                        console.log('[map] popupopen for', marker.sessionId);
                        // delegate to shared populator
                        try{ if(window.populateSessionPopup) { window.populateSessionPopup(marker); } }catch(e){ console.error('popupopen populate error', e); }
                    });

                    marker.addTo(map.sessionMarkers);
                    // Ensure marker renders above overlays (like the hover rectangle)
                    try{ if(marker.bringToFront) marker.bringToFront(); }catch(e){}
                    // make marker visually interactive (pointer) when rendered
                    marker.on('add', function(){
                        try{ if(marker._path) marker._path.style.cursor = 'pointer'; }catch(e){}
                    });

                    // clicking marker will open popup and sync with sidebar
                    marker.on('click', function(e){
                        try{
                            console.log('[map] marker click', marker.sessionId);
                            // Ensure sessions panel visible
                            try{ const panel = document.getElementById('sessions-panel'); if(panel && (panel.style.display === 'none' || panel.style.display === '')) panel.style.display = 'block'; }catch(e){}

                            // Prefer calling shared opener directly (more deterministic)
                            try{
                                if(window.openSessionById){
                                    console.log('[map] delegating to openSessionById', marker.sessionId);
                                    window.openSessionById(marker.sessionId);
                                    return;
                                }
                            }catch(e){ console.error('openSessionById call failed', e); }

                            // Fallback: try finding sidebar entry and simulate click
                            try{
                                const sid = marker.sessionId;
                                var selector = '#sessions-list [data-session-id="' + String(sid).replace(/"/g, '\\"') + '"]';
                                const el = document.querySelector(selector);
                                if(el){ el.click(); return; }
                                if(window.fetchAdminSessions){
                                    window.fetchAdminSessions();
                                    setTimeout(()=>{ try{ const el2 = document.querySelector(selector); if(el2) el2.click(); }catch(_){ } }, 400);
                                    return;
                                }
                            }catch(e){ console.error('marker -> session-entry click', e); }

                            // Final fallback: open popup directly
                            try{ marker.openPopup(); }catch(e){ try{ (e && e.target && e.target.openPopup && e.target.openPopup()) }catch(_){} }
                        }catch(e){ console.error('marker click', e); }
                    });

                    if(marker.sessionId) window.sessionMarkersById[marker.sessionId] = marker;
                }catch(e){ console.error('session marker error', e); }
            });
        }catch(e){ console.error('addSessionMarkers', e); }
    };

    window.clearSessionMarkers = function(){ if(map.sessionMarkers) map.sessionMarkers.clearLayers(); window.sessionMarkersById = {}; };

    var prevMouseRect, prevMousePos;
    map.on('mousemove', function (e) {
        var mousePos = Position.fromLatLng(map, e.latlng, map.plane);

        if (prevMousePos !== mousePos) {

            prevMousePos = mousePos;

            if (prevMouseRect !== undefined) {
                map.removeLayer(prevMouseRect);
            }

            prevMouseRect = mousePos.toLeaflet(map);
            prevMouseRect.addTo(map);
        }
    });

    const setUrlParams = () => {
        const mapCentre = map.getBounds().getCenter()
        const centrePos = Position.fromLatLng(map, mapCentre, map.plane);

        const zoom = map.getZoom();

        window.history.replaceState(null, null, `?centreX=${centrePos.x}&centreY=${centrePos.y}&centreZ=${centrePos.z}&zoom=${zoom}`);
    };

    map.on('move', setUrlParams);
    map.on('zoom', setUrlParams);

    let zoom = 7;
    let centreLatLng = [-79, -137]

    if (urlZoom) {
        zoom = urlZoom;
    }

    if (urlCentreX && urlCentreY && urlCentreZ) {
        const centrePos = new Position(Number(urlCentreX), Number(urlCentreY), Number(urlCentreZ));
        centreLatLng = centrePos.toLatLng(map);
    } else if (urlRegionID) {
        const region = new Region(Number(urlRegionID));
        const centrePos = region.toCentrePosition()
        centreLatLng = centrePos.toLatLng(map);
        zoom = urlZoom || 9;
    }

    map.setView(centreLatLng, zoom)
});
