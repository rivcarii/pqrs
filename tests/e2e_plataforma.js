const { chromium } = require("playwright");
const path = require("path");
const CAP = path.join(__dirname, "salida", "capturas") + "/";
require("fs").mkdirSync(CAP, { recursive: true });
(async () => {
  const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const url = "file://" + path.resolve(__dirname, "salida", "Vista_Previa_Plataforma.html");
  const errores = [];
  for (const w of [1600, 1366, 820, 390]) {
    const p = await b.newPage({ viewport: { width: w, height: w < 500 ? 844 : 900 } });
    p.on("pageerror", e => errores.push(w + " pageerror: " + e.message));
    p.on("console", m => { if (m.type() === "error" && !/ERR_TUNNEL|Failed to load resource/.test(m.text())) errores.push(w + " console: " + m.text()); });
    const desb = async (v) => { const o = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); if (o > 0) errores.push(w + " desborde " + v + ": " + o + "px"); };
    await p.goto(url);
    await p.waitForSelector("#formAcceso #a_usuario", { timeout: 20000 });
    await desb("acceso"); if (w === 1366 || w === 390) await p.screenshot({ path: CAP + `z_${w}_acceso.png` });
    // v8.5 · la medalla del ingreso (centro de las órbitas) no se distorsiona y las 4 letras orbitan (cada una con su propia órbita)
    if (w >= 1001) {
      const m = await p.evaluate(() => { const i = document.getElementById("medallaHero"), r = i.getBoundingClientRect(); return { nat: i.naturalWidth / i.naturalHeight, vis: r.width / r.height, orb: document.querySelectorAll(".orb").length, anim: getComputedStyle(document.querySelector(".orb.o1")).animationName }; });
      if (Math.abs(m.nat - m.vis) > 0.02) errores.push(w + " la medalla del ingreso se deforma: natural " + m.nat + " vs visible " + m.vis);
      const fl = await p.evaluate(() => { const i = document.getElementById("medallaHero"), c = getComputedStyle(i), o = getComputedStyle(document.querySelector(".orb i"));
        return { bg: c.backgroundColor, radio: c.borderRadius, sombra: c.boxShadow, brillo: o.backgroundImage, pill: !!document.querySelector(".hero-pill"), leyenda: !!document.querySelector(".hero-leyenda") }; });
      if (fl.bg !== "rgba(0, 0, 0, 0)" || fl.sombra !== "none") errores.push(w + " la medalla del ingreso tiene fondo o sombra: " + JSON.stringify(fl));
      if (fl.brillo !== "none") errores.push(w + " los planetas no son planos (2D): " + fl.brillo);
      if (fl.pill || fl.leyenda) errores.push(w + " siguen el rótulo «La mejora comienza contigo» o la leyenda de tipos");
      if (m.orb !== 4 || m.anim !== "orbitar") errores.push(w + " las órbitas P-Q-R-S no están animadas");
    }
    // v9.3 · el ingreso cabe en una pantalla: sin desplazarse en escritorio y con el botón visible en celular y tableta
    const ing = await p.evaluate(() => ({ alto: document.documentElement.scrollHeight, vp: window.innerHeight, boton: document.getElementById("btnAcceso").getBoundingClientRect().bottom }));
    if (w >= 1366 && ing.alto > ing.vp + 1) errores.push(w + " el ingreso obliga a desplazarse: " + ing.alto + " > " + ing.vp);
    if (ing.boton > ing.vp) errores.push(w + " el botón Ingresar queda fuera de la pantalla: " + Math.round(ing.boton) + " > " + ing.vp);
    const entrar = async (u) => {
      await p.fill("#a_usuario", u); await p.fill("#a_clave", "Demo2026"); await p.click("#btnAcceso");
      try { await p.waitForSelector("#v-inicio:not([hidden]) .hero", { timeout: 15000 }); }
      catch (e) { await p.screenshot({ path: CAP + "z_fallo_" + w + ".png" }); console.log(JSON.stringify(await p.evaluate(() => ({ app: document.getElementById("app").hidden, acc: document.getElementById("acceso").hidden, aviso: document.getElementById("accAviso").textContent, arr: document.getElementById("arranque").hidden, rect: document.querySelector("#v-inicio .hero") && JSON.stringify(document.querySelector("#v-inicio .hero").getBoundingClientRect()) })))); console.log(errores.join("\n")); throw e; } await p.waitForSelector("#meses .mes", { timeout: 15000 }); await p.waitForTimeout(900);
    };
    await entrar("siau.admin");

    // v9.5 · el logo y la cuenta quedan fijos en la barra lateral; solo el menú se desplaza
    if (w >= 1001) {
      await p.setViewportSize({ width: w, height: 520 }); await p.waitForTimeout(300);
      const lat = async () => p.evaluate(() => { const l = document.getElementById("lateral"), m = document.getElementById("menu"), u = document.querySelector(".lat-usuario").getBoundingClientRect(), k = document.querySelector(".lat-marca").getBoundingClientRect();
        return { lscroll: l.scrollHeight - l.clientHeight, mscroll: m.scrollHeight - m.clientHeight, uBottom: Math.round(u.bottom), uTop: Math.round(u.top), kTop: Math.round(k.top), alto: innerHeight }; });
      const a1 = await lat(); await p.evaluate(() => { document.getElementById("menu").scrollTop = 9999; }); await p.waitForTimeout(150); const a2 = await lat();
      if (a1.lscroll > 1) errores.push(w + " la barra lateral entera se desplaza (debe desplazarse solo el menú): " + JSON.stringify(a1));
      if (a1.mscroll <= 0) errores.push(w + " con poca altura el menú no se desplaza por sí solo: " + JSON.stringify(a1));
      if (a1.uBottom > a1.alto || a2.uTop !== a1.uTop || a2.kTop !== a1.kTop) errores.push(w + " la cuenta o el logo se mueven con el menú: " + JSON.stringify([a1, a2]));
      await p.setViewportSize({ width: w, height: 900 }); await p.waitForTimeout(200);
    }
    // v9.8 · Seguimiento SIAU: solo administradores; abre la plataforma de evidencias en otra pestaña
    {
      const irS = async () => { if (w <= 1000) { await p.click("#btnMenu"); await p.waitForTimeout(300); } await p.click('#menu button[data-v="seguimiento"]'); await p.waitForTimeout(500); };
      await irS(); await p.waitForSelector("#segCuerpo .seg-card", { timeout: 8000 }).catch(() => errores.push(w + " el módulo Seguimiento SIAU no se pinta"));
      const enl = await p.$$eval("#segCuerpo .seg-card a.b", els => els.map(e => ({ h: e.getAttribute("href"), t: e.target, r: e.rel })));
      if (enl.length !== 2 || !/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(enl[0].h) || !/\?pagina=admin$/.test(enl[1].h) || enl.some(x => x.t !== "_blank" || !/noopener/.test(x.r)))
        errores.push(w + " los enlaces de Seguimiento SIAU no son los esperados: " + JSON.stringify(enl));
      await p.waitForSelector("#segResumen .aviso", { timeout: 6000 }).catch(() => errores.push(w + " Seguimiento SIAU no explica cómo conectar el puente"));
      if (!/Conecta el puente/.test(await p.textContent("#segResumen").catch(() => ""))) errores.push(w + " sin el aviso de conexión pendiente del puente");
      await desb("seguimiento"); if (w === 1366 || w === 390) await p.screenshot({ path: CAP + `z_${w}_seguimiento.png`, fullPage: true });
      await p.fill("#segUrl", "https://ejemplo.com/exec"); await p.click("#btnSegGuardar");
      await p.waitForSelector("#segAviso .aviso.err", { timeout: 5000 }).catch(() => errores.push(w + " Seguimiento SIAU acepta una dirección que no es de Apps Script"));
      await p.evaluate(() => ver("inicio"));
    }
    // v9.3 · Riverino: botón, búsqueda, «Llévame», recorrido de bienvenida y consejos de primera vez
    await p.waitForSelector("#riverino", { timeout: 6000 }).catch(() => errores.push(w + " no aparece el botón de Riverino"));
    await p.click("#riverino"); await p.waitForSelector("#rvPanel", { timeout: 4000 }).catch(() => errores.push(w + " Riverino no abre su panel"));
    await desb("riverino");
    await p.fill("#rvQ", "cómo radico una queja"); await p.press("#rvQ", "Enter");
    await p.waitForSelector("#rvRes .rv-res", { timeout: 4000 }).catch(() => errores.push(w + " Riverino no encontró «cómo radicar»"));
    if (!/Radicar/i.test(await p.textContent("#rvRes").catch(() => ""))) errores.push(w + " la respuesta de Riverino no habla de radicar");
    await p.waitForTimeout(500); if (w === 1366 || w === 390) await p.screenshot({ path: CAP + `z_${w}_riverino.png` });
    await p.click('#rvRes [data-rv-ir]'); await p.waitForTimeout(600);
    if (await p.$eval("#v-radicar", e => e.hidden)) errores.push(w + " «Llévame» no abrió el apartado");
    await p.click("#riverino"); await p.fill("#rvQ", "zzzxxyy"); await p.press("#rvQ", "Enter");
    if (!/No encontré/.test(await p.textContent("#rvRes").catch(() => ""))) errores.push(w + " Riverino no responde a lo que no entiende");
    for (const [q, tit] of [["cómo radico", /radicar/i], ["dónde descargo el excel", /Tablero/i], ["quiero cambiar mi clave", /contraseña/i], ["que es el semaforo", /semáforo/i]]) {
      await p.fill("#rvQ", q); await p.press("#rvQ", "Enter");
      if (!tit.test(await p.textContent("#rvRes h4").catch(() => ""))) errores.push(w + " Riverino no entiende «" + q + "»");
    }
    await p.click("#rvTour"); await p.waitForSelector("#rvTour2", { timeout: 4000 }).catch(() => errores.push(w + " el recorrido de bienvenida no abre"));
    let nPasos = 0; while (await p.$("#rvSig") && nPasos < 20) { const ult = /Terminar/.test(await p.textContent("#rvSig")); if (nPasos === 2 && w === 1366) await p.screenshot({ path: CAP + `z_${w}_recorrido.png` }); await p.click("#rvSig"); nPasos++; await p.waitForTimeout(150); if (ult) break; }
    if (nPasos < 6) errores.push(w + " el recorrido es muy corto: " + nPasos + " pasos");
    if (await p.$("#rvTour2")) errores.push(w + " el recorrido no se cerró al terminar");
    const gu = await p.evaluate(() => JSON.parse(localStorage.getItem("pqrs_guia_siau.admin") || "null"));
    if (!gu || !gu.tour || !gu.activa) errores.push(w + " no se guardó que el recorrido ya se vio");
    if (await p.evaluate(() => /(clave|password|token)/i.test(localStorage.getItem("pqrs_guia_siau.admin") || ""))) errores.push(w + " la guía guarda datos sensibles");
    await p.evaluate(() => ver("bandeja")); await p.waitForSelector(".rv-tip", { timeout: 4000 }).catch(() => errores.push(w + " no aparece el consejo de primera vez"));
    await p.click('.rv-tip [data-rv="ok"]'); await p.evaluate(() => ver("inicio")); await p.evaluate(() => ver("bandeja")); await p.waitForTimeout(300);
    if (await p.$(".rv-tip")) errores.push(w + " el consejo se repite después de «Entendido»");
    await p.evaluate(() => ver("inicio")); await p.waitForTimeout(300);

    // v8.7 · temas, fondo sin franja blanca, pantalla de inicio y aviso de carga
    for (const t of ["oscuro", "mono", "calido", "claro"]) {
      await p.click("#btnPerfil"); await p.click('#menuPerfil .temas button[data-tema="' + t + '"]'); await p.waitForTimeout(250);
      const r = await p.evaluate(() => ({ t: document.documentElement.dataset.tema, g: localStorage.getItem("pqrs_tema"), bg: getComputedStyle(document.body).backgroundColor, ground: getComputedStyle(document.documentElement).getPropertyValue("--ground").trim(),
        cabeza: document.querySelector("html").scrollHeight >= innerHeight }));
      if (r.t !== t || r.g !== t) errores.push(w + " el tema " + t + " no se aplicó o no se guardó: " + JSON.stringify(r));
      if (!(await p.evaluate(() => !document.getElementById("splash") || document.getElementById("splash").hidden))) errores.push(w + " la pantalla de inicio sigue cubriendo la aplicación");
      await p.keyboard.press("Escape"); await p.evaluate(() => { const m = document.getElementById("menuPerfil"); if (m) m.hidden = true; });
    }
    if (!(await p.evaluate(() => document.documentElement.dataset.so && document.documentElement.dataset.form))) errores.push(w + " el dispositivo no se detectó (data-so / data-form)");
    if (!(await p.evaluate(() => /::before/.test("") || getComputedStyle(document.documentElement, "::before").position === "fixed"))) errores.push(w + " el fondo no es fijo: puede quedar una franja blanca");
    await desb("inicio"); await p.screenshot({ path: CAP + `z_${w}_inicio.png`, fullPage: true });
    const irA = async (v) => {
      if (w <= 1000) { await p.click("#btnMenu"); await p.waitForTimeout(300); }
      await p.click('#menu button[data-v="' + v + '"]'); await p.waitForTimeout(500);
    };
    // v8 · vista de prioritarias con el comando de identificación
    await irA("prioritarias"); await p.waitForSelector("#prioLista .pr-card", { timeout: 10000 }).catch(() => errores.push(w + " sin tarjetas de prioritarias"));
    await p.click("#btnIdentificar"); await p.waitForSelector("#prioAviso .aviso", { timeout: 10000 }).catch(() => errores.push(w + " el comando Identificar no respondió"));
    await p.waitForTimeout(400); await desb("prioritarias");
    if (!/Riesgo vital · menor de edad/.test(await p.textContent("#prioLista"))) errores.push(w + " no aparece el caso de riesgo vital en menor de edad");
    if (w === 1366 || w === 390) await p.screenshot({ path: CAP + `z_${w}_prioritarias.png`, fullPage: true });
    await irA("bandeja"); await p.click('#etapas button[data-e="todas"]'); await p.waitForSelector("#listaBandeja .fila", { timeout: 8000 }); await p.waitForTimeout(400);
    await desb("bandeja"); await p.screenshot({ path: CAP + `z_${w}_bandeja.png` });
    await p.click("#listaBandeja .fila"); await p.waitForSelector(".det-head .cod", { timeout: 8000 }); await p.waitForTimeout(400);
    await desb("detalle"); if (w === 1366) await p.screenshot({ path: CAP + `z_${w}_detalle.png`, fullPage: true });
    await irA("correo"); await p.waitForSelector("#segCorreo button", { timeout: 10000 }); await p.waitForTimeout(400);
    await desb("correo"); await p.screenshot({ path: CAP + `z_${w}_correo.png`, fullPage: true });
    const inst = await p.$$eval("#listaCorreos .hilo", els => els.length);
    if (inst) { await p.click("#listaCorreos .hilo"); await p.waitForSelector("#vistaHilo .msg", { timeout: 8000 }); await p.waitForTimeout(400);
      if (!(await p.$("#x_cat"))) errores.push(w + " sin selector de categoría para EPS");
      if (!(await p.$("#vistaHilo .analisis"))) errores.push(w + " el hilo de la EPS no muestra el análisis detallado");
      else if (!/Qué hacer/.test(await p.textContent("#vistaHilo .analisis"))) errores.push(w + " el análisis no trae las acciones sugeridas");
      await desb("hilo eps"); if (w === 1366 || w === 390) await p.screenshot({ path: CAP + `z_${w}_hilo_eps.png`, fullPage: true }); }
    await irA("radicar"); await p.selectOption("#r_tipoPqrs", { index: 5 });
    await p.fill("#r_descripcion", "Quiero felicitar al médico pero la recepcionista fue grosera, me gritó y hubo mucha demora. Pésima atención.");
    await p.waitForSelector("#usarSug", { timeout: 6000 }).catch(() => errores.push(w + " sin sugerencia de tipo"));
    await desb("radicar"); if (w === 1366) await p.screenshot({ path: CAP + `z_${w}_radicar.png` });
    // v8.2 · el radicado aparece al instante y el acuse llega en un segundo paso
    await p.fill("#r_correo", "e2e.usuario@correo.com"); await p.click("#btnRadicar");
    await p.waitForSelector("#radExito:not([hidden]) .cod", { timeout: 15000 }).catch(() => errores.push(w + " no se mostró el radicado"));
    if (!/^SIAU-\d{4}-\d{2}-\d{4,}$/.test((await p.textContent("#radExito .cod")).trim())) errores.push(w + " radicado con formato inesperado");
    await p.waitForFunction(() => /enviado a e2e\.usuario@correo\.com/.test((document.getElementById("radAcuse") || {}).textContent || ""), null, { timeout: 15000 })
      .catch(() => errores.push(w + " el acuse en segundo plano no se completó"));
    await desb("radicado");
    await irA("tablero"); await p.waitForSelector("#gMesTipo", { timeout: 8000 }); await p.waitForTimeout(1200); await desb("tablero");
    if (!(await p.waitForSelector("#npsCard .nps", { timeout: 6000 }).catch(() => null))) errores.push(w + " el tablero no muestra la tarjeta de satisfacción (NPS)");
    if (await p.$eval("#bloqueExcel", e => e.hidden)) errores.push(w + " el administrador no ve «Exportar a Excel»");
    else {
      const [descarga] = await Promise.all([p.waitForEvent("download", { timeout: 15000 }).catch(() => null), p.click("#btnExportarExcel")]);
      if (!descarga || !/^Consolidado_PQRS_.*\.xlsx$/.test(descarga.suggestedFilename())) errores.push(w + " no se descargó el Excel del tablero");
      await p.waitForFunction(() => /Consolidado listo/.test(document.getElementById("toasts").textContent), null, { timeout: 15000 }).catch(() => errores.push(w + " sin aviso de Excel listo"));
    }
    await irA("usuarios"); await p.waitForSelector("#usrLista .ufila:not(.cab)", { timeout: 8000 }); await p.waitForTimeout(300);
    if (!/github\.io\/DEFINIDO\/portal\//.test(await p.textContent("#enlaceActual").catch(() => ""))) errores.push(w + " el enlace de ingreso para los técnicos no es el del portal de GitHub");
    await p.waitForSelector("#audLista .aud-fila:not(.aud-cab)", { timeout: 8000 }).catch(() => errores.push(w + " la auditoría de accesos no muestra eventos"));
    if (!/Ingreso correcto/.test(await p.textContent("#audLista"))) errores.push(w + " la auditoría no registra el ingreso del administrador");
    if (await p.locator("#usrLista .usr").count()) errores.push(w + " los usuarios siguen en tarjetas: deben verse como lista");
    if (w >= 1366 && !(await p.locator("#usrLista .ufila.cab").isVisible())) errores.push(w + " la lista de usuarios no muestra su encabezado de columnas");
    await desb("usuarios"); await p.screenshot({ path: CAP + `z_${w}_usuarios.png`, fullPage: true });
    await p.click("#btnNuevoUsr"); await p.waitForSelector("#u_sedes", { timeout: 5000 });
    if (!(await p.$("#u_telefono"))) errores.push(w + " el formulario de usuario no pide el WhatsApp"); await p.waitForTimeout(300);
    await desb("modal usuario"); if (w === 1366 || w === 390) await p.screenshot({ path: CAP + `z_${w}_usuario_nuevo.png` });
    await p.keyboard.press("Escape");
    // v8.6 · directorio de áreas: explicación visible y botón Guardar siempre a la vista, con contador de cambios
    await irA("responsables"); await p.waitForSelector("#respLista .resp-fila[data-i]", { timeout: 8000 }); await p.waitForTimeout(400);
    if (!(await p.locator(".dir-guia").isVisible())) errores.push(w + " el directorio no explica qué es");
    const guardar = await p.evaluate(() => { const r = document.getElementById("btnGuardarResp").getBoundingClientRect(); return { abajo: r.bottom, vp: innerHeight, vis: r.width > 0 }; });
    if (!guardar.vis || guardar.abajo > guardar.vp + 1) errores.push(w + " el botón Guardar del directorio no está a la vista sin desplazarse (" + Math.round(guardar.abajo) + " > " + guardar.vp + ")");
    await p.fill('#respLista .resp-fila[data-i] input[data-k="cargo"]', "Cargo de prueba");
    if (!/1 cambio sin guardar/.test(await p.textContent("#respEstado"))) errores.push(w + " el directorio no cuenta los cambios pendientes");
    await desb("responsables"); await p.screenshot({ path: CAP + `z_${w}_directorio.png` });
    await irA("config"); await p.waitForSelector("#tablaEntidades .cfg-fila[data-ent]", { timeout: 8000 }); await p.waitForTimeout(300);
    await p.waitForSelector("#qrImagen svg", { timeout: 8000 }).catch(() => errores.push(w + " sin código QR del formulario"));
    if (!(await p.$("#aj_pushTema")) || (await p.$("#aj_acuseInstitucional"))) errores.push(w + " configuración de push ausente o con el acuse automático a EPS todavía visible");
    else { await p.fill("#aj_pushTema", ""); await p.click("#btnGenerarPush"); if (!/^pqrs-miredips-[a-z2-9]{14}$/.test(await p.inputValue("#aj_pushTema"))) errores.push(w + " el generador del tema del push no funcionó"); }
    await p.click("#btnRespaldarAhora"); await p.waitForFunction(() => /Respaldo guardado en Drive/.test((document.getElementById("respAviso") || {}).textContent || ""), null, { timeout: 15000 })
      .catch(() => errores.push(w + " el respaldo ahora no respondió"));
    if (!(await p.$("#btnGuardarWa")) || (await p.getAttribute("#wa_token", "type")) !== "password") errores.push(w + " falta la configuración de WhatsApp (o el token no está oculto)");
    await p.click("#btnDiagnostico"); await p.waitForSelector("#diagCuerpo .dg", { timeout: 8000 }).catch(() => errores.push(w + " sin diagnóstico"));
    await desb("config"); if (w === 1366) await p.screenshot({ path: CAP + `z_${w}_config.png`, fullPage: true });
    // técnico
    if (w >= 1366) {   // barra lateral fija al desplazarse
      await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(200);
      const top = await p.evaluate(() => document.getElementById("lateral").getBoundingClientRect().top);
      await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(150);
      const top0 = await p.evaluate(() => document.getElementById("lateral").getBoundingClientRect().top);
      if (Math.abs(top - top0) > 1) errores.push(w + " la barra lateral se desplaza: top=" + top + " (en reposo " + top0 + ")");
      await p.evaluate(() => window.scrollTo(0, 0));
    }
    if (w === 1366) {   // afiche del QR: todo cabe en la hoja A4
      const html = await p.evaluate(() => htmlAficheQR("https://forms.gle/PQRSMiRedIPS"));
      const q = await b.newPage({ viewport: { width: 794, height: 1123 } });
      await q.setContent(html); await q.waitForTimeout(300);
      const fuera = await q.evaluate(() => { const h = document.querySelector(".hoja").getBoundingClientRect(); let n = 0; document.querySelectorAll(".hoja *:not(.aro)").forEach(e => { const r = e.getBoundingClientRect(); if (r.width && (r.bottom > h.bottom + 1 || r.right > h.right + 1)) n++; }); return n; });
      if (fuera) errores.push("el afiche del QR se sale de la hoja A4 (" + fuera + " elementos)");
      await q.screenshot({ path: CAP + "z_afiche_qr.png" }); await q.close();
    }
    await p.click("#btnPerfil"); await p.click("#btnSalir");
    await p.waitForSelector("#formAcceso #a_usuario", { timeout: 15000 });
    if (!/Cerraste sesión/.test(await p.textContent("#accAviso"))) errores.push(w + " sin mensaje al cerrar sesión");
    if (!(await p.$eval("#app", e => e.hidden))) errores.push(w + " la app sigue visible tras cerrar sesión");
    if ((await p.textContent("#detalleCuerpo")).trim()) errores.push(w + " quedaron datos del usuario anterior");
    await entrar("tecnico.playa");
    const visibles = await p.$$eval('#menu button[data-v]', els => els.filter(e => !e.hidden).map(e => e.dataset.v));
    if (visibles.includes("usuarios") || visibles.includes("correo") || visibles.includes("seguimiento")) errores.push(w + " técnico ve módulos de administración: " + visibles);
    { const rr = await p.evaluate(() => srv("apiSeguimiento").then(r => JSON.stringify(r), e => "rechazado"));
      if (/script\.google\.com/.test(rr)) errores.push(w + " el técnico pudo pedir el enlace de Seguimiento SIAU por la API: " + rr); }
    await desb("inicio técnico"); if (w === 1366 || w === 390) await p.screenshot({ path: CAP + `z_${w}_inicio_tecnico.png`, fullPage: true });
    // v8.7.3 · el técnico descarga solo indicadores (sin datos de casos); el consolidado completo es del administrador
    await irA("tablero"); await p.waitForSelector("#gMesTipo", { timeout: 8000 });
    if (await p.isVisible("#btnExportarExcel") || !(await p.isVisible("#btnExportarIndicadores"))) errores.push(w + " el técnico debe ver solo el botón de indicadores en el tablero");
    const [desc] = await Promise.all([p.waitForEvent("download", { timeout: 20000 }).catch(() => null), p.click("#btnExportarIndicadores")]);
    if (!desc || !/^Indicadores_PQRS_.*\.xlsx$/.test(desc.suggestedFilename())) errores.push(w + " el técnico no pudo descargar el Excel de indicadores");
    await irA("bandeja"); await p.click('#etapas button[data-e="todas"]'); await p.waitForSelector("#listaBandeja .fila", { timeout: 8000 });
    const sedes = await p.$$eval("#listaBandeja .fila .med b", els => els.map(e => e.textContent));
    if (sedes.some(t => !/Camino La Playa|Camino Luz Chinita/.test(t))) errores.push(w + " el técnico ve sedes ajenas");
    if (!visibles.includes("radicar")) errores.push(w + " el técnico no ve Radicar");
    if (await p.isVisible("#btnExportarExcel")) errores.push(w + " el técnico ve el botón del consolidado completo");
    await p.click("#listaBandeja .fila"); await p.waitForSelector(".det-head .cod", { timeout: 8000 }); await p.waitForTimeout(300);
    if (!/Seguimiento de la gestión/.test(await p.textContent("#detalleCuerpo")) || (await p.$("#btnEnviarArea"))) errores.push(w + " el técnico ve acciones de gestión");
    if (w === 1366 || w === 390) await p.screenshot({ path: CAP + `z_${w}_detalle_tecnico.png`, fullPage: w === 390 });
    await irA("bandeja"); await p.click('#etapas button[data-e="todas"]'); await p.waitForSelector("#listaBandeja .fila", { timeout: 8000 });
    if (w === 1366) {
      await p.waitForFunction(() => /Prioridad|Nueva PQRS/.test(document.getElementById("toasts").textContent), null, { timeout: 20000 }).catch(() => errores.push("sin aviso en segundo plano"));
      await p.screenshot({ path: CAP + `z_${w}_toast.png` });
    }
    await p.close();
  }
  console.log(errores.length ? errores.join("\n") : "SIN ERRORES");
  if (errores.length) process.exitCode = 1;
  await b.close();
})();
