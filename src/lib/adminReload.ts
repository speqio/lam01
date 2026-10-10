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
/* aviso-recarga v4 */
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

  // Modos de diagnóstico, solo con un parámetro en la URL (el cliente nunca los ve):
  //   ?aviso=prueba   monta el overlay 5 s, para comprobar que se ve y cómo queda.
  //   ?aviso=registro no recarga y muestra abajo a la izquierda qué peticiones ve, para
  //                   averiguar por qué no se detecta un guardado.
  var modo='';
  try{ modo=(String(location.search).match(/[?&]aviso=([a-z]+)/)||[])[1]||''; }catch(e){}

  var caja=null;
  function apuntar(texto){
    if(modo!=='registro') return;
    try{
      if(!caja){
        caja=document.createElement('div');
        caja.style.cssText='position:fixed;left:8px;bottom:8px;z-index:2147483646;max-width:46ch;'+
          'max-height:45vh;overflow:auto;background:#000;color:#0f0;font:11px/1.35 ui-monospace,monospace;'+
          'padding:8px;border:1px solid #0f0;white-space:pre-wrap';
        (document.body||document.documentElement).appendChild(caja);
      }
      caja.appendChild(document.createTextNode(new Date().toISOString().slice(11,19)+'  '+texto+'\\n'));
      caja.scrollTop=caja.scrollHeight;
    }catch(e){}
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

  if(modo==='prueba'){
    montar();
    setTimeout(quitar, 5000);
  }
  if(modo==='registro'){
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', function(){ apuntar('modo registro activo; no se recargará'); });
    else apuntar('modo registro activo; no se recargará');
  }

  // 2. Detectar el siguiente guardado y recargar.
  var temporizador=null;
  function programarRecarga(motivo){
    apuntar('GUARDADO DETECTADO por '+motivo+(modo==='registro'?' (no recargo: modo registro)':''));
    if(modo==='registro') return;
    if(temporizador!==null) return;
    try{ sessionStorage.setItem(CLAVE,'1'); }catch(e){}
    montar();
    temporizador=setTimeout(function(){ try{ location.reload(); }catch(e){} }, ESPERA);
  }

  // Si llega otra petición de commit antes de que la recarga dispare, es un reintento de
  // Keystatic (su camino de STALE_DATA vuelve a pedir la cabeza de la rama y reintenta).
  // Se cancela lo programado y decide el resultado del reintento, para no recargar encima
  // de un guardado que aún no ha terminado.
  function cancelarPorReintento(){
    if(temporizador===null) return;
    clearTimeout(temporizador);
    temporizador=null;
    try{ sessionStorage.removeItem(CLAVE); }catch(e){}
    quitar();
    apuntar('llega otro commit: se cancela la recarga y manda el reintento');
  }

  if(typeof window.fetch!=='function'){ apuntar('sin window.fetch: no se puede detectar'); return; }
  var original=window.fetch;
  window.fetch=function(){
    var args=arguments;
    var destino='', metodo='', cuerpo='';
    try{
      var uno=args[0], init=args[1];
      destino=typeof uno==='string'?uno:(uno&&uno.url)?uno.url:String(uno);
      metodo=((init&&init.method)||(uno&&uno.method)||'GET').toUpperCase();
      // El cuerpo se lee ANTES de lanzar la petición y solo si es un string, que es lo que
      // manda urql. Nada de clonar respuestas: urql aborta la petición al terminar y eso
      // cancela la rama clonada del cuerpo, así que leerla falla (medido en producción).
      if(init && typeof init.body==='string') cuerpo=init.body;
    }catch(e){}
    var esGithub=destino.indexOf('api.github.com/graphql')!==-1;
    var esLocal=destino.indexOf('/api/keystatic/update')!==-1;
    // Se busca el NOMBRE de la operación, "CreateCommit", y no "createCommitOnBranch": el
    // cliente de Keystatic monta urql con persistedExchange, así que la petición normal
    // lleva solo {operationName, variables, extensions.persistedQuery.sha256Hash} y el
    // documento GraphQL no viaja. "CreateCommit" aparece en las dos formas: como
    // operationName en la persistida y como "mutation CreateCommit" cuando manda el
    // documento completo (el reintento tras PersistedQueryNotFound).
    var esCommit=(esGithub && cuerpo.indexOf('CreateCommit')!==-1)||esLocal;
    if(esCommit) cancelarPorReintento();
    var promesa=original.apply(this,args);
    try{
      if(modo==='registro' && (esGithub||esLocal||destino.indexOf('graphql')!==-1||destino.indexOf('keystatic')!==-1||destino.indexOf('github')!==-1)){
        apuntar(metodo+' '+destino.slice(0,90)+(esCommit?'  <= COMMIT':(esGithub?'  (github, no commit)':'')));
        // Con el cuerpo delante se ve por qué encaja o no, sin tener que adivinar.
        if(esGithub){
          var tipo=(init&&init.body)?(typeof init.body):'(sin cuerpo)';
          apuntar('   cuerpo: '+tipo+', '+cuerpo.length+' bytes: '+cuerpo.slice(0,110));
        }
      }
      if(esCommit){
        promesa.then(function(res){
          try{
            apuntar('respuesta del commit: '+(res?res.status:'?')+(res&&res.ok?' ok':' NO ok'));
            // Solo el código de estado: no se toca el cuerpo. GitHub devuelve 200 también
            // cuando el GraphQL trae errores, pero ese caso lo cubre el reintento de
            // Keystatic, que dispara otra petición de commit y cancela esta recarga.
            if(res && res.ok) programarRecarga('mutación en la petición, respuesta '+res.status);
          }catch(e){}
        })['catch'](function(){ apuntar('la petición de commit falló (red)'); });
      }
    }catch(e){}
    return promesa;
  };
  apuntar('envoltorio de fetch instalado');
})();
`;

/**
 * Markup para inyectar dentro del <head> que `src/middleware.ts` añade a la página de
 * Keystatic. El <svg> con el filtro no va aquí: lo crea el script dentro del overlay, porque
 * un <svg> no es válido dentro de <head> y el navegador lo movería o lo descartaría.
 */
export const AVISO_RECARGA_ADMIN =
  `<style>${CSS.replace(/\n/g, '')}</style><script>${JS}</script>`;
