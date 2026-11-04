const $ = (id) => document.getElementById(id);
const message = $("message");
const preview = $("preview");
const readButton = $("read-page");
const sendButton = $("send");
const editButton = $("edit");
const saveConfirmation = $("save-confirmation");
const saveFeedback = $("save-feedback");
let listing = null;

const themeButton = $("theme-toggle");
const themeIcon = $("theme-icon");

function updateThemeControl(theme) {
  const systemDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches || false;
  const isDark = theme ? theme === "dark" : systemDark;
  themeIcon.textContent = isDark ? "☀" : "☾";
  const label = isDark ? "Cambiar a modo claro" : "Cambiar a modo nocturno";
  themeButton.setAttribute("aria-label", label);
  themeButton.title = label;
}

async function loadTheme() {
  const { theme } = await chrome.storage.local.get("theme");
  if (theme === "dark" || theme === "light") document.documentElement.dataset.theme = theme;
  updateThemeControl(theme);
}

themeButton.addEventListener("click", async () => {
  const current = document.documentElement.dataset.theme;
  const isDark = current ? current === "dark" : window.matchMedia?.("(prefers-color-scheme: dark)").matches || false;
  const theme = isDark ? "light" : "dark";
  document.documentElement.dataset.theme = theme;
  updateThemeControl(theme);
  await chrome.storage.local.set({ theme });
});

const featureLabels = {
  property_type: "Tipo de inmueble",
  rental_type: "Tipo de alquiler",
  availability: "Disponibilidad",
  address: "Ubicación",
  area_m2: "Superficie",
  rooms: "Estancias",
  balcony: "Balcón",
  terrace: "Terraza",
  garage_included: "Garaje incluido",
  pets_allowed: "Admite mascotas",
  smoking_allowed: "Permite fumar",
  heating: "Calefacción",
  climate_other: "Equipamiento",
  constructed_area_m2: "Superficie construida",
  usable_area_m2: "Superficie útil",
  bedrooms: "Habitaciones",
  bathrooms: "Baños",
  property_condition: "Estado del inmueble",
  orientation: "Orientación",
  year_built: "Año de construcción",
  furnished: "Amueblado",
  kitchen_equipped: "Cocina equipada",
  floor: "Planta",
  exterior: "Exterior",
  elevator: "Ascensor",
  air_conditioning: "Aire acondicionado",
  property_age: "Antigüedad",
  garage_type: "Garaje",
};

function renderFeatures(features = {}) {
  const list = $("features-list");
  list.replaceChildren();
  const available = Object.entries(featureLabels).filter(([key]) => features[key] !== undefined && features[key] !== null && features[key] !== "");
  $("features-count").textContent = `(${available.length})`;
  $("features-empty").hidden = available.length > 0;
  $("features-empty").textContent = "No se detectaron características en esta página. Puedes revisar los campos al guardar en CazaPiso.";
  for (const [key, label] of available) {
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = label;
    const value = features[key];
    description.textContent = typeof value === "boolean" ? (value ? "S\u00ed" : "No")
      : key === "area_m2" || key === "constructed_area_m2" || key === "usable_area_m2" ? `${value} m\u00b2`
        : String(value);
    list.append(term, description);
  }
}

function setMessage(text, kind = "") {
  message.hidden = false;
  message.textContent = text;
  message.className = kind ? `message-${kind}` : "";
  message.setAttribute("role", kind === "success" ? "alert" : "status");
}

async function getState() {
  const { config, session } = await chrome.storage.local.get(["config", "session"]);
  return { config, session };
}

async function paintState() {
  const { config, session } = await getState();
  $("setup").hidden = Boolean(config);
  $("auth").hidden = !config || Boolean(session);
  $("connected").hidden = !session;
  $("user-email").textContent = session?.user?.email || "tu cuenta";
  $("read-page").disabled = !session;
  // Keep the button actionable so clicks without a saved session explain what is missing.
  sendButton.disabled = false;
  sendButton.title = session ? "" : "Pulsa para ver cómo conectar o iniciar sesión";
  if (!session && !preview.hidden) setMessage("Inicia sesión en la extensión para guardar este anuncio.");
}

async function request(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = [body.message, body.details, body.hint, body.code].filter(Boolean).join(" — ");
    throw new Error(body.msg || body.error_description || body.error || detail || `Error ${response.status}`);
  }
  return body;
}

async function authenticatedSession() {
  const { config, session } = await getState();
  if (!config || !session) throw new Error("Conecta la extensión e inicia sesión para guardar.");
  if (session.expires_at > Math.floor(Date.now() / 1000) + 60) return { config, session };
  try {
    const refreshed = await request(`${config.url}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: config.anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    const nextSession = { ...refreshed, expires_at: Math.floor(Date.now() / 1000) + refreshed.expires_in };
    await chrome.storage.local.set({ session: nextSession });
    return { config, session: nextSession };
  } catch {
    await chrome.storage.local.remove("session");
    await paintState();
    throw new Error("La sesión venció. Inicia sesión de nuevo.");
  }
}

async function api(path, options = {}) {
  const { config, session } = await authenticatedSession();
  return request(`${config.url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
}

function extractListingFromPage() {
  const normalize = (value) => typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  const normalizeLabel = (value) => normalize(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[²₂]/g, "2").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const scripts = [...document.querySelectorAll('script[type="application/ld+json"]')];
  const structured = [];
  const visit = (value) => {
    if (!value) return;
    if (Array.isArray(value)) return value.forEach(visit);
    if (typeof value !== "object") return;
    structured.push(value);
    if (value["@graph"]) visit(value["@graph"]);
    if (value.mainEntity) visit(value.mainEntity);
    if (value.itemListElement) visit(value.itemListElement);
  };
  for (const script of scripts) {
    try { visit(JSON.parse(script.textContent || "")); } catch { /* Ignore malformed JSON-LD. */ }
  }
  const listingTypes = new Set(["Product", "RealEstateListing", "Apartment", "House", "Residence", "SingleFamilyResidence"]);
  const item = structured.find((entry) => {
    const types = Array.isArray(entry["@type"]) ? entry["@type"] : [entry["@type"]];
    return types.some((type) => listingTypes.has(type));
  }) || structured.find((entry) => entry.name || entry.offers);
  const meta = (selector) => document.querySelector(selector)?.getAttribute("content") || "";
  const title = normalize(meta('meta[property="og:title"]')) || normalize(document.querySelector("h1")?.textContent) || normalize(item?.name) || normalize(document.title);
  const description = normalize(item?.description) || normalize(meta('meta[property="og:description"]')) || normalize(meta('meta[name="description"]'));
  let image = "";
  const itemImage = item?.image;
  if (typeof itemImage === "string") image = itemImage;
  else if (Array.isArray(itemImage)) image = typeof itemImage[0] === "string" ? itemImage[0] : itemImage[0]?.url || "";
  else if (itemImage && typeof itemImage === "object") image = itemImage.url || itemImage.contentUrl || "";
  image ||= meta('meta[property="og:image"]') || document.querySelector('img[src^="http"]')?.src || "";
  const offer = Array.isArray(item?.offers) ? item.offers[0] : item?.offers;
  let price = Number(offer?.price || offer?.lowPrice || meta('meta[property="product:price:amount"]')) || null;
  if (price !== null && (price < 50 || price >= 100000)) price = null;
  if (!price) {
    const priceNodes = [...document.querySelectorAll('[class*="price" i], [data-testid*="price" i], [data-qa*="price" i], [aria-label*="precio" i], [itemprop="price"]')]
      .filter((node) => node.getClientRects().length && normalize(node.textContent || ""))
      .sort((a, b) => normalize(a.textContent || "").length - normalize(b.textContent || "").length)
      .slice(0, 30);
    const candidates = [
      ...priceNodes.map((node) => node.textContent || ""),
      meta('meta[property="og:description"]'),
      meta('meta[name="description"]'),
      document.body.innerText || "",
    ];
    for (const candidate of candidates) {
      const match = normalize(candidate).match(/(?:\p{Sc}\s*)?((?:\d{1,3}(?:[.\s]\d{3})+|\d{1,6})(?:,\d{1,2})?)\s*(?:\p{Sc}|eur)(?:\s*\/?\s*(?:mes(?:es)?|month))?/iu);
      if (!match) continue;
      const value = Number(match[1].replace(/[.\s]/g, "").replace(",", "."));
      if (value >= 50 && value < 100000) { price = value; break; }
    }
  }
  try { image = image ? new URL(image, location.href).href : ""; } catch { image = ""; }
  if (image && !["http:", "https:"].includes(new URL(image).protocol)) image = "";

  const features = {};
  const setFeature = (key, value) => { if (features[key] === undefined && value !== undefined && value !== null && value !== "") features[key] = value; };
  const parseNumber = (raw) => {
    const value = raw.trim();
    const normalized = value.includes(",") ? value.replace(/\./g, "").replace(",", ".") : value.replace(/\.(?=\d{3}(?:\D|$))/g, "");
    const number = Number(normalized);
    return Number.isFinite(number) ? number : undefined;
  };
  const parseBullet = (text, section) => {
    const value = normalize(text);
    const plain = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[²₂]/g, "2").toLowerCase().replace(/[^a-z0-9.,]+/g, " ").trim();
    let match = plain.match(/^(\d+(?:[.,]\d+)?)\s*m\s*2\s*(construidos?|utiles?)$/);
    if (match) {
      setFeature(match[2].startsWith("construid") ? "constructed_area_m2" : "usable_area_m2", parseNumber(match[1]));
      return;
    }
    match = plain.match(/^(\d+)\s+(habitaciones?|dormitorios?|banos?)$/);
    if (match) {
      setFeature(match[2].startsWith("bano") ? "bathrooms" : "bedrooms", Number(match[1]));
      return;
    }
    if (section === "building") {
      match = value.match(/^\s*(bajo|entresuelo|(?:\d{1,2}\s*(?:[.ªº°]{1,2}\s*)?(?:planta|piso)))(?:\s+(exterior|interior))?\s*$/i);
      if (match) {
        setFeature("floor", match[1].trim());
        if (match[2]) setFeature("exterior", normalizeLabel(match[2]) === "exterior");
        return;
      }
      if (/^(?:sin ascensor|no tiene ascensor)$/.test(plain)) { setFeature("elevator", false); return; }
      if (/^(?:con ascensor|ascensor)$/.test(plain)) { setFeature("elevator", true); return; }
      if (/^(?:exterior|interior)$/.test(plain)) { setFeature("exterior", plain === "exterior"); return; }
    }
    if (/^orientacion\s+/.test(plain)) { setFeature("orientation", value.replace(/^\s*orientaci[oó]n\s*/i, "").trim()); return; }
    if (/^construido\s+en\s+\d{4}$/.test(plain)) { setFeature("year_built", Number(plain.match(/\d{4}/)?.[0])); return; }
    if (/^(?:amueblado|amueblada)(?:\s+y\s+cocina equipada)?$/.test(plain)) {
      setFeature("furnished", true);
      if (plain.includes("cocina equipada")) setFeature("kitchen_equipped", true);
      return;
    }
    if (/^cocina equipada$/.test(plain)) { setFeature("kitchen_equipped", true); return; }
    if (/^(?:segunda mano\s*\/\s*buen estado|segunda mano buen estado|a reformar|reformado)$/.test(plain)) { setFeature("property_condition", value); return; }
    if (section === "equipment" && /^aire acondicionado$/.test(plain)) { setFeature("air_conditioning", true); return; }
  };

  for (const heading of document.querySelectorAll("h2, h3")) {
    const headingText = normalizeLabel(heading.textContent || "");
    const section = headingText.includes("edificio") ? "building"
      : headingText.includes("equipamiento") ? "equipment"
        : headingText.includes("caracteristicas basicas") ? "basic" : "";
    if (!section) continue;
    let scope = heading.parentElement;
    let fallback = null;
    for (let depth = 0; depth < 5 && scope; depth += 1, scope = scope.parentElement) {
      const bullets = scope.querySelectorAll("li");
      if (!bullets.length) continue;
      fallback ||= scope;
      if (scope.querySelectorAll("h2, h3").length <= 1) { fallback = scope; break; }
    }
    if (!fallback) continue;
    for (const bullet of fallback.querySelectorAll("li")) parseBullet(bullet.textContent || "", section);

  }

  // Fotocasa presents most property details as label/value pairs rather than
  // Idealista-style bullets. Parse the visible text so these details are saved too.
  const featureLabels = new Map([
    ["tipo de inmueble", "property_type"], ["disponibilidad", "availability"], ["tipo de alquiler", "rental_type"],
    ["calefaccion", "heating"], ["estado", "property_condition"], ["antiguedad", "property_age"],
    ["garaje", "garage_type"], ["planta", "floor"], ["ascensor", "elevator"], ["exterior", "exterior"], ["amueblado", "furnished"],
    ["superficie construida", "constructed_area_m2"], ["superficie util", "usable_area_m2"], ["superficie", "area_m2"],
    ["dormitorios", "bedrooms"], ["habitaciones", "bedrooms"], ["banos", "bathrooms"], ["orientacion", "orientation"],
    ["mascotas", "pets_allowed"], ["permite mascotas", "pets_allowed"], ["fumar", "smoking_allowed"],
  ]);
  const lines = (document.body.innerText || "").split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const knownLabels = new Set(featureLabels.keys());
  const saveVisibleFeature = (key, rawValue) => {
    const value = normalize(rawValue);
    const plain = normalizeLabel(value);
    if (!value || knownLabels.has(plain) || ["caracteristicas", "caracteristicas basicas", "edificio", "equipamiento"].includes(plain)) return;
    const iconNoise = new Set(["window_open", "window_closed", "ac_unit", "check", "check_circle", "close", "done", "kitchen", "apartment", "home", "bed", "bathtub", "elevator", "balcony", "garage", "local_parking", "pets", "smoke_free"]);
    if (iconNoise.has(plain)) {
      if (["heating", "air_conditioning", "elevator", "furnished", "kitchen_equipped"].includes(key)) { setFeature(key, true); }
      return;
    }
    if (["elevator", "exterior", "furnished", "pets_allowed", "smoking_allowed"].includes(key)) {
      if (/^(si|yes|true|disponible)$/.test(plain)) setFeature(key, true);
      else if (/^(no|false|no disponible)$/.test(plain)) setFeature(key, false);
      return;
    }
    if (["constructed_area_m2", "usable_area_m2", "area_m2", "bedrooms", "bathrooms"].includes(key)) {
      const number = value.match(/\d+(?:[.,]\d+)?/);
      if (number) setFeature(key, parseNumber(number[0]));
      return;
    }
    if (key === "garage_type") {
      if (!/^(no|sin garaje|false)$/.test(plain)) {
        setFeature("garage_type", value);
        setFeature("garage_included", true);
      }
      return;
    }
    setFeature(key, value);
  };
  const orderedLabels = [...featureLabels.keys()].sort((a, b) => b.length - a.length);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const plain = normalizeLabel(line);
    const summary = plain.match(/\b(\d+)\s*(?:hab|habitaciones?|dormitorios?)\b/);
    if (summary) setFeature("bedrooms", Number(summary[1]));
    const summaryBathrooms = plain.match(/\b(\d+)\s*banos?\b/);
    if (summaryBathrooms) setFeature("bathrooms", Number(summaryBathrooms[1]));
    const summaryArea = plain.match(/\b(\d+(?:[.,]\d+)?)\s*m\s*2\b/);
    if (summaryArea) setFeature("area_m2", parseNumber(summaryArea[1]));
    const label = orderedLabels.find((candidate) => plain === candidate || plain.startsWith(`${candidate} `));
    if (label) {
      const key = featureLabels.get(label);
      const inlineValue = plain === label ? "" : line.trim().split(/\s+/).slice(label.split(" ").length).join(" ").replace(/^:\s*/, "");
      const rawValue = inlineValue || lines[index + 1] || "";
      saveVisibleFeature(key, rawValue);
      continue;
    }
    const chip = {
      "aire acondicionado": ["air_conditioning", true], "terraza": ["terrace", true], "balcon": ["balcony", true],
      "cocina equipada": ["kitchen_equipped", true], "amueblado": ["furnished", true],
    }[plain];
    if (chip) setFeature(chip[0], chip[1]);
    if (/terraza y balcon/.test(plain)) { setFeature("terrace", true); setFeature("balcony", true); }
    if (plain.length < 100 && /aire acondicionado/.test(plain)) setFeature("air_conditioning", true);
    if (plain.length < 100 && /terraza/.test(plain)) setFeature("terrace", true);
    if (plain.length < 100 && /balcon/.test(plain)) setFeature("balcony", true);
    if (plain.length < 100 && /cocina equipada/.test(plain)) setFeature("kitchen_equipped", true);
    if (plain.length < 100 && /electrodomesticos/.test(plain)) {
      const current = typeof features.climate_other === "string" ? features.climate_other : "";
      setFeature("climate_other", current ? `${current}, Electrodomésticos` : "Electrodomésticos");
    }
  }

  // Spotahome shows core facts in a compact line (e.g. "Piso · 2 Dormitorios · 1 Baño · 82 m2")
  // rather than in Idealista-style feature sections. Parse the rendered page as a fallback,
  // including facts split across separate elements or punctuation.
  const pageText = normalizeLabel(document.body.innerText || "");
  const setFirstNumber = (key, pattern, min, max) => {
    if (features[key] !== undefined) return;
    const match = pageText.match(pattern);
    if (!match) return;
    const value = parseNumber(match[1]);
    if (value !== undefined && value >= min && value <= max) setFeature(key, value);
  };
  setFirstNumber("bedrooms", /\b(\d+(?:[.,]\d+)?)\s*(?:hab(?:itaciones?)?|dormitorios?|bedrooms?)\b/, 0, 50);
  setFirstNumber("bathrooms", /\b(\d+(?:[.,]\d+)?)\s*(?:banos?|cuartos? de bano|bathrooms?|baths?)\b/, 0, 30);
  setFirstNumber("area_m2", /\b(\d+(?:[.,]\d+)?)\s*(?:m\s*2|sqm|metros? cuadrados?)\b/, 10, 10000);
  if (features.balcony === undefined && /\b(?:balcon|balcones|balcony)\b/.test(pageText)) setFeature("balcony", true);
  if (features.terrace === undefined && /\b(?:terraza|terrazas|terrace)\b/.test(pageText)) setFeature("terrace", true);
  if (features.air_conditioning === undefined && /\b(?:aire acondicionado|air conditioning|acondicionado)\b/.test(pageText)) setFeature("air_conditioning", true);
  if (features.kitchen_equipped === undefined && /\b(?:cocina equipada|fully equipped kitchen|equipped kitchen)\b/.test(pageText)) setFeature("kitchen_equipped", true);
  if (features.furnished === undefined && /\b(?:amueblado|amueblada|furnished)\b/.test(pageText)) setFeature("furnished", true);
  if (features.elevator === undefined && /\b(?:ascensor|elevator|lift)\b/.test(pageText)) setFeature("elevator", true);

  return { title: title.slice(0, 300), price, imageUrl: image.slice(0, 2000), description: description.slice(0, 500), originalUrl: location.href.slice(0, 2000), features };
}

$("connect").addEventListener("click", async () => {
  const connectButton = $("connect");
  connectButton.disabled = true;
  setMessage("Comprobando la configuración…");
  try {
    const parsed = new URL($("supabase-url").value.trim());
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
      throw new Error("Introduce la URL https:// de tu proyecto Supabase.");
    }
    const url = parsed.origin;
    const anonKey = $("anon-key").value.trim();
    if (!anonKey) throw new Error("Introduce la clave pública anon de Supabase.");
    const originPattern = `${url}/*`;
    if (!chrome.permissions?.request) throw new Error("Chrome no habilitó permisos para esta extensión. Recárgala en chrome://extensions e inténtalo otra vez.");
    setMessage(`Solicitando permiso para conectar con ${parsed.host}…`);
    const granted = await chrome.permissions.request({ origins: [originPattern] });
    if (!granted) throw new Error("Hace falta permitir la conexión con tu proyecto Supabase.");
    setMessage("Permiso concedido. Verificando la clave de Supabase…");
    await request(`${url}/auth/v1/settings`, { headers: { apikey: anonKey } });
    await chrome.storage.local.set({ config: { url, anonKey } });
    await paintState();
    setMessage("Proyecto conectado. Inicia sesión para continuar.");
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    setMessage(`No se pudo conectar. ${detail}`);
  }
  finally { connectButton.disabled = false; }
});

$("login").addEventListener("click", async () => {
  const button = $("login");
  button.disabled = true;
  try {
    const { config } = await getState();
    const session = await request(`${config.url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: config.anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email: $("email").value.trim(), password: $("password").value }),
    });
    await chrome.storage.local.set({ session: { ...session, expires_at: Math.floor(Date.now() / 1000) + session.expires_in } });
    $("password").value = "";
    await paintState();
    setMessage("Sesión iniciada. Ya puedes guardar anuncios desde el navegador.");
  } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo iniciar sesión."); }
  finally { button.disabled = false; }
});

$("logout").addEventListener("click", async () => {
  await chrome.storage.local.remove("session");
  await paintState();
  setMessage("Sesión cerrada.");
});

readButton.addEventListener("click", async () => {
  setMessage("Leyendo los datos de la pestaña…");
  readButton.disabled = true;
  preview.hidden = true;
  saveFeedback.hidden = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url || !/^https?:/.test(tab.url)) throw new Error("Abre primero la página de un anuncio.");
    const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractListingFromPage });
    listing = result?.result;
    if (!listing) throw new Error("No pude leer esta página. Prueba recargándola.");
    renderFeatures(listing.features);
    $("title").value = listing.title || "";
    $("price").value = listing.price || "";
    $("description").value = listing.description || "";
    $("image-url").value = listing.imageUrl || "";
    $("image-wrap").hidden = !listing.imageUrl;
    $("image").src = listing.imageUrl || "";
    editButton.hidden = true;
    sendButton.hidden = false;
    saveConfirmation.hidden = true;
    message.hidden = false;
    setMessage(listing.title ? "Revisa los datos antes de continuar." : "No encontré el título; puedes escribirlo manualmente.");
    readButton.hidden = true;
    preview.hidden = false;
  } catch (error) {
    readButton.hidden = false;
    setMessage(error instanceof Error ? error.message : "No pude leer esta página.");
  }
  finally { readButton.disabled = false; }
});

sendButton.addEventListener("click", async () => {
  const showSaveFeedback = (text) => {
    saveFeedback.textContent = text;
    saveFeedback.hidden = false;
    setMessage(text);
  };
  const title = $("title").value.trim();
  if (!title) return showSaveFeedback("Escribe el título del anuncio para continuar.");
  const price = Number($("price").value);
  const rawImage = $("image-url").value.trim();
  let imageUrl = "";
  if (rawImage) {
    try {
      const parsed = new URL(rawImage);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
      imageUrl = parsed.href.slice(0, 2000);
    } catch { return showSaveFeedback("La URL de imagen debe empezar por http:// o https://."); }
  }
  if (!listing?.originalUrl) return showSaveFeedback("Lee primero la página del anuncio.");
  const data = {
    title: title.slice(0, 300),
    price: Number.isFinite(price) && price > 0 && price < 100000 ? price : null,
    description: $("description").value.trim().slice(0, 500),
    image_url: imageUrl || null,
    original_url: listing.originalUrl.slice(0, 2000),
    ...(Object.keys(listing.features || {}).length ? { features: Object.fromEntries(Object.entries(listing.features).filter(([, value]) => value !== undefined && value !== null && value !== "")) } : {}),
  };
  sendButton.disabled = true;
  sendButton.textContent = "Guardando…";
  saveFeedback.hidden = true;
  saveConfirmation.hidden = true;
  setMessage("Guardando en tu tablero…");
  try {
    const { config, session } = await getState();
    if (!config) throw new Error("Conecta la extensión con tu proyecto Supabase antes de guardar.");
    if (!session) throw new Error("Inicia sesión en la extensión y vuelve a pulsar Guardar.");
    let boards = await api("boards?select=id&order=created_at.asc&limit=1");
    if (!boards.length) boards = await api("boards?select=id", {
      method: "POST", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ user_id: (await authenticatedSession()).session.user.id, title: "Mi búsqueda" }),
    });
    if (!boards[0]?.id) throw new Error("No encontré un tablero para guardar el anuncio.");
    const existing = await api(`properties?select=id&original_url=eq.${encodeURIComponent(data.original_url)}&limit=1`);
    if (existing[0]?.id) {
      await api(`properties?id=eq.${encodeURIComponent(existing[0].id)}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify(data),
      });
    } else {
      await api("properties?select=id", {
        method: "POST", headers: { Prefer: "return=representation" },
        body: JSON.stringify({ ...data, board_id: boards[0].id }),
      });
    }
    sendButton.hidden = true;
    message.hidden = true;
    saveFeedback.hidden = true;
    saveConfirmation.textContent = existing[0]?.id
      ? "✓ Anuncio actualizado correctamente en CazaPiso."
      : "✓ Piso guardado correctamente en CazaPiso.";
    saveConfirmation.hidden = false;
    editButton.hidden = false;
  } catch (error) {
    const text = error instanceof Error ? error.message : "No se pudo guardar en CazaPiso.";
    console.error("[CazaPiso] Falló el guardado del anuncio:", error);
    if (text.toLowerCase().includes("features")) {
      return showSaveFeedback("Supabase todavía no tiene la columna de características. Ejecuta supabase/migrations/20261026_property_features.sql en SQL Editor y vuelve a intentarlo.");
    }
    showSaveFeedback(text.toLowerCase().includes("invalid") || text.toLowerCase().includes("jwt")
      ? "La sesión venció. Inicia sesión de nuevo."
      : `No se pudo guardar: ${text}`);
  } finally {
    sendButton.disabled = false;
    sendButton.textContent = "Guardar este anuncio";
  }
});
editButton.addEventListener("click", async () => {
  await chrome.tabs.create({ url: "http://localhost:3000/dashboard" });
});

loadTheme().catch(() => updateThemeControl(null));
paintState().catch(() => setMessage("No pude cargar la configuración de la extensión."));
