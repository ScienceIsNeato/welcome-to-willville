import type { Metadata } from "next";
import "./globals.css";
import { TownStage } from "@/components/TownStage";
import { buildInitialStops } from "@/lib/town";

export const metadata: Metadata = {
  title: "Welcome to Willville",
  description:
    "A purely-visual town where Will's projects live. Wander the districts, watch the trains run.",
  icons: {
    icon: [{ url: "/icon.svg?eye=1", type: "image/svg+xml" }],
    shortcut: [{ url: "/icon.svg?eye=1", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg?eye=1", type: "image/svg+xml" }],
  },
};

// On-screen mobile debug console, activated only with ?debug=1. Installed as an
// inline (non-module) script so its error handlers run BEFORE the deferred app
// bundle hydrates — a white-screen hydration error then shows up in a red
// overlay on the device, and eruda gives a full Console/Network panel.
const DEBUG_CONSOLE_SCRIPT = `(function(){try{if(!/[?&]debug=1/.test(location.search))return;function ts(){return new Date().toISOString().slice(11,19)}var box;function ensure(){if(!box){box=document.createElement('pre');box.id='__dbg';box.style.cssText='position:fixed;z-index:2147483647;left:0;right:0;bottom:0;max-height:55vh;overflow:auto;margin:0;padding:8px;background:rgba(110,0,0,.94);color:#fff;font:11px/1.35 monospace;white-space:pre-wrap'}if(document.body&&!box.parentNode){document.body.appendChild(box)}return box}function add(m){var b=ensure();if(b){b.textContent+=ts()+' '+m+'\\n'}}if(document.body){ensure()}else{document.addEventListener('DOMContentLoaded',ensure)}add('[debug] '+navigator.userAgent);try{add('jsHeap='+(performance.memory?Math.round(performance.memory.usedJSHeapSize/1048576)+'/'+Math.round(performance.memory.jsHeapSizeLimit/1048576)+'MB':'n/a'))}catch(e){}window.addEventListener('error',function(e){add('ERROR '+(e.message||(e.error&&e.error.message)||e.type)+' @'+(e.filename||'')+':'+(e.lineno||0)+(e.error&&e.error.stack?'\\n'+e.error.stack:''))},true);window.addEventListener('unhandledrejection',function(e){var r=e.reason;add('REJECT '+((r&&(r.stack||r.message))||r))});setTimeout(function(){try{function mq(q){return matchMedia(q).matches}var st=document.getElementById('willville-stage');var hs=[].slice.call(document.querySelectorAll('image')).map(function(i){return i.getAttribute('href')||''});var mob=hs.filter(function(h){return h.indexOf('.mobile.webp')>-1}).length;var full=hs.filter(function(h){return h.indexOf('-render/')>-1&&h.indexOf('.webp')>-1&&h.indexOf('.mobile.webp')<0}).length;add('DIAG coarse='+mq('(pointer: coarse)')+' hoverNone='+mq('(hover: none)')+' fine='+mq('(pointer: fine)')+' hoverHover='+mq('(hover: hover)'));add('DIAG stage=['+(st?(st.className||'(empty)'):'(no el)')+']');add('DIAG art mobile='+mob+' full='+full);add('DIAG view='+innerWidth+'x'+innerHeight+' dpr='+devicePixelRatio)}catch(e){add('DIAG fail '+e)}},3500);var s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/eruda';s.onload=function(){try{eruda.init();add('[eruda ready - tap the gear -> Console / Network]')}catch(x){add('eruda init fail '+x)}};s.onerror=function(){add('[eruda CDN blocked; basic overlay only]')};(document.head||document.documentElement).appendChild(s)}catch(x){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const month = new Date().getMonth();
  const seasonClass = month === 9 ? "is-october" : "";
  const initialStops = buildInitialStops();
  return (
    <html lang="en" className="h-full antialiased">
      <body className={seasonClass}>
        <script dangerouslySetInnerHTML={{ __html: DEBUG_CONSOLE_SCRIPT }} />
        <TownStage initialStops={initialStops} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 5,
          }}
        >
          {children}
        </div>
      </body>
    </html>
  );
}
