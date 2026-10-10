/**
 * Aviso de recarga del panel de Keystatic.
 *
 * POR QUÉ EXISTE. En modo GitHub, Keystatic no actualiza su puntero al commit después de
 * guardar: el camino de almacenamiento local llama a `setTreeSha(...)` y el camino
 * github/cloud no (ver `useUpsertItem` en
 * node_modules/@keystatic/core/dist/keystatic-core-ui.js). Así que `baseCommit`,
 * `initialFiles` y `currentLocalTreeKey` se quedan congelados en el estado de cuando se
 * abrió la entrada, y volver a guardar la MISMA entrada falla con "This entry has been
 * updated since it was opened" o con el error de borrado de GitHub. Recargar la página es
 * el único reinicio fiable. Diagnóstico completo: docs/keystatic-upstream.md (§2).
 *
 * QUÉ HACE. Tras cada guardado exitoso muestra este overlay a pantalla completa y recarga
 * el panel, para que el editor no tenga que acordarse de pulsar F5. El overlay sobrevive a
 * la recarga (bandera en sessionStorage) y se retira cuando el panel ya pintó.
 *
 * ES MITIGACIÓN, NO ARREGLO. El arreglo de verdad es upstream, una línea; está descrito
 * como opción B en docs/keystatic-upstream.md (§6).
 *
 * NOTAS DE IMPLEMENTACIÓN, para quien lo toque después:
 *
 * - Sin dependencias y sin GSAP, a diferencia del resto del sitio. El overlay tiene que
 *   pintar durante el ciclo de descarga y carga de la página, y un script externo en ese
 *   momento puede llegar tarde o no llegar. El proyecto ya tiene este precedente en
 *   ArchivoCascade.astro (puro @keyframes, cero JS).
 * - La detección del guardado mira la RESPUESTA, no el cuerpo de la petición: urql usa
 *   @urql/exchange-persisted, así que la petición puede llevar solo un hash y no el nombre
 *   de la mutación. Tampoco se detecta por el texto del aviso "Saved": cambia con el
 *   idioma y con cualquier rediseño.
 * - Falla abierto: si Keystatic cambia de endpoint, esto deja de avisar y volvemos a la
 *   situación anterior. Nunca debe bloquear sin salida; de ahí el temporizador de
 *   seguridad que retira el overlay pase lo que pase.
 */

// El gradiente y la capa de ruido vienen del prototipo del cliente (gradientefullsize.htm);
// el gradiente va copiado literal. Lo que cambia es que el stagger y el yoyo de GSAP pasan a
// animation-delay y a `alternate infinite`, y que los tiempos se reajustan: el prototipo
// arrancaba con 3 s de espera, inservible para un overlay que vive algo más de un segundo.
const FRANJAS = 27;
const ESPERA_MS = 1200;

const CSS = `
@font-face{font-family:'Lekton';font-style:normal;font-weight:400;font-display:swap;src:url('/fonts/lekton-400.woff2') format('woff2')}
#aviso-recarga{position:fixed;inset:0;z-index:2147483647;background:#141414;overflow:hidden;display:flex;align-items:center;justify-content:center;font-family:'Lekton',ui-monospace,monospace;color:#f5f5f5;-webkit-font-smoothing:antialiased}
#aviso-recarga .ar-franjas{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;overflow:hidden}
#aviso-recarga .ar-franja{flex:0 0 36px;height:36px;opacity:0;background:linear-gradient(90deg,rgba(255,0,0,0) 0%,rgba(255,0,0,.019) 4.4%,rgba(255,0,0,.07) 8.55%,rgba(255,0,0,.138) 12.1%,rgba(255,0,0,.212) 15.25%,rgba(255,0,0,.291) 18.15%,rgba(255,0,0,.373) 20.9%,rgba(255,0,0,.455) 23.55%,rgba(255,0,0,.538) 26.2%,rgba(255,0,0,.62) 28.85%,rgba(255,0,0,.701) 31.6%,rgba(255,0,0,.781) 34.5%,rgba(255,0,0,.857) 37.65%,rgba(255,0,0,.925) 41.15%,rgba(255,0,0,.978) 45.25%,rgba(255,0,0,1) 50%,rgba(255,0,0,.978) 54.75%,rgba(255,0,0,.925) 58.85%,rgba(255,0,0,.857) 62.35%,rgba(255,0,0,.781) 65.5%,rgba(255,0,0,.701) 68.4%,rgba(255,0,0,.62) 71.15%,rgba(255,0,0,.538) 73.8%,rgba(255,0,0,.455) 76.45%,rgba(255,0,0,.373) 79.1%,rgba(255,0,0,.291) 81.85%,rgba(255,0,0,.212) 84.75%,rgba(255,0,0,.138) 87.9%,rgba(255,0,0,.07) 91.45%,rgba(255,0,0,.019) 95.6%,rgba(255,0,0,0) 100%);animation:ar-aparecer .35s ease-in-out both,ar-barrido 3s ease-in-out infinite alternate;animation-delay:calc(var(--i) * .02s),calc(var(--i) * -.19s)}
#aviso-recarga .ar-ruido{position:absolute;inset:0;background:transparent;filter:url(#ar-ruido);mix-blend-mode:overlay;pointer-events:none}
#aviso-recarga .ar-texto{position:relative;z-index:2;text-align:center;padding:0 24px;animation:ar-subir .5s ease-out .1s both}
#aviso-recarga .ar-titulo{margin:0;font-size:clamp(1.5rem,5vw,2.5rem);font-weight:700;letter-spacing:.02em}
#aviso-recarga .ar-pie{margin:.6em 0 0;font-size:clamp(.85rem,2.5vw,1rem);opacity:.75}
#aviso-recarga svg{position:absolute;width:0;height:0}
@keyframes ar-aparecer{from{opacity:0}to{opacity:1}}
@keyframes ar-barrido{from{transform:translateX(-35%)}to{transform:translateX(35%)}}
@keyframes ar-subir{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){#aviso-recarga .ar-franja{animation:ar-aparecer .2s ease-out both;animation-delay:0s}#aviso-recarga .ar-texto{animation:none}}
`;

// Se sirve como script clásico inline, así que va en ES5 llano y sin optional chaining:
// no pasa por el bundler y tiene que funcionar en cuanto el parser lo encuentra.
const JS = `
(function(){
  var CLAVE='recarga-admin', ID='aviso-recarga', FRANJAS=${FRANJAS}, ESPERA=${ESPERA_MS};
  var MINIMO=400, SEGURIDAD=8000;

  function montar(){
    try{
      if(document.getElementById(ID)) return;
      var raiz=document.createElement('div');
      raiz.id=ID;
      raiz.setAttribute('role','status');
      raiz.setAttribute('aria-live','polite');
      var franjas='';
      for(var i=0;i<FRANJAS;i++) franjas+='<div class="ar-franja" style="--i:'+i+'"></div>';
      raiz.innerHTML=
        '<div class="ar-franjas">'+franjas+'</div>'+
        '<div class="ar-ruido"></div>'+
        '<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs>'+
        '<filter id="ar-ruido"><feTurbulence type="fractalNoise" baseFrequency="0.4" />'+
        '<feColorMatrix type="saturate" values="0" /></filter></defs></svg>'+
        '<div class="ar-texto"><p class="ar-titulo">Espera un momento</p>'+
        '<p class="ar-pie">Guardando los cambios y recargando el panel</p></div>';
      // Al documentElement y no al body: en la carga de la página este script corre antes
      // de que el body exista, y así el overlay pinta sin parpadeo previo.
      document.documentElement.appendChild(raiz);
    }catch(e){}
  }

  function quitar(){
    try{
      var el=document.getElementById(ID);
      if(el && el.parentNode) el.parentNode.removeChild(el);
    }catch(e){}
  }

  // ¿Ya pintó el panel? Se mide por volumen de nodos y no por selectores de @keystar/ui,
  // que son clases generadas y cambian sin avisar.
  function panelListo(){
    try{
      return !!document.body && document.body.querySelectorAll('*').length>40;
    }catch(e){ return true; }
  }

  function esperarPanel(){
    var desde=Date.now(), obs=null, cerrado=false;
    function cerrar(){
      if(cerrado) return; cerrado=true;
      if(obs){ try{ obs.disconnect(); }catch(e){} }
      var resta=Math.max(0, MINIMO-(Date.now()-desde));
      setTimeout(quitar, resta);
    }
    if(panelListo()){ cerrar(); return; }
    try{
      obs=new MutationObserver(function(){ if(panelListo()) cerrar(); });
      obs.observe(document.documentElement,{childList:true,subtree:true});
    }catch(e){}
    setTimeout(cerrar, SEGURIDAD);   // seguro: el overlay nunca se queda pegado
  }

  // 1. Venimos de un guardado: el overlay ya tiene que estar en pantalla.
  var veniaDeGuardar=false;
  try{
    veniaDeGuardar=sessionStorage.getItem(CLAVE)==='1';
    if(veniaDeGuardar) sessionStorage.removeItem(CLAVE);
  }catch(e){}
  if(veniaDeGuardar){
    montar();
    esperarPanel();
  }

  // 2. Detectar el siguiente guardado y recargar.
  var programado=false;
  function programarRecarga(){
    if(programado) return; programado=true;
    try{ sessionStorage.setItem(CLAVE,'1'); }catch(e){}
    montar();
    setTimeout(function(){ try{ location.reload(); }catch(e){} }, ESPERA);
  }

  if(typeof window.fetch!=='function') return;
  var original=window.fetch;
  window.fetch=function(){
    var args=arguments;
    var destino='';
    try{
      var uno=args[0];
      destino=typeof uno==='string'?uno:(uno&&uno.url)?uno.url:String(uno);
    }catch(e){}
    var promesa=original.apply(this,args);
    try{
      var esGithub=destino.indexOf('api.github.com/graphql')!==-1;
      var esLocal=destino.indexOf('/api/keystatic/update')!==-1;
      if(esGithub||esLocal){
        promesa.then(function(res){
          try{
            if(esLocal){ if(res && res.ok) programarRecarga(); return; }
            // En GitHub se mira la respuesta, no la petición: con consultas persistidas el
            // cuerpo puede llevar solo un hash y no el nombre de la mutación.
            res.clone().json().then(function(d){
              try{
                if(d && !d.errors && d.data && d.data.createCommitOnBranch &&
                   d.data.createCommitOnBranch.ref && d.data.createCommitOnBranch.ref.target){
                  programarRecarga();
                }
              }catch(e){}
            })['catch'](function(){});
          }catch(e){}
        })['catch'](function(){});
      }
    }catch(e){}
    return promesa;
  };
})();
`;

/**
 * Markup para inyectar dentro del <head> que `src/middleware.ts` añade a la página de
 * Keystatic. El <svg> con el filtro no va aquí: lo crea el script dentro del overlay, porque
 * un <svg> no es válido dentro de <head> y el navegador lo movería o lo descartaría.
 */
export const AVISO_RECARGA_ADMIN =
  `<style>${CSS.replace(/\n/g, '')}</style><script>${JS}</script>`;
