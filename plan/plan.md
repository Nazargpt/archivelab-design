# ARCHIVE LAB — Plan de la web

Plataforma editorial y de comercio para ARCHIVE LAB, marca de moda de autor de Camila Guerra, con catálogo de piezas, venta online, código único por prenda física y panel de administración. Destino previsto: archivelab.fashion (no se asume registrado ni conectado hasta verificarlo).

## Para quién es

- **Clienta de la marca:** ya tiene buenos básicos y conoce su estilo; busca una pieza especial de autor que aporte arte, carácter y personalidad. Navega, compra como invitada o registrada, y consulta sus piezas y códigos en "Mi archivo".
- **Clienta VIP registrada:** accede a la sección exclusiva "Camila Guerra" con colecciones muy reducidas.
- **Camila (administración):** publica piezas y ediciones, gestiona unidades, pedidos, eventos, listas de espera y contenidos desde un panel protegido.

## Funciones y experiencia

**Catálogo y expediente de pieza**
- Archivo disponible con filtros por categoría, talle y disponibilidad.
- Cada ficha: imagen, nombre, referencia de edición y precio cuando esté definido.
- Expediente de pieza: nombre y código de diseño, edición, galería y video opcional, concepto, intervenciones/materiales/avíos, talles y medidas reales (cargadas por la marca), cuidados, cantidad de la edición, disponibilidad por talle, precio, información de envío y acción para comprar/agregar al carrito.
- No se inventan composiciones, medidas ni procesos. Si una pieza no tiene precio/condiciones suficientes, no se habilita su checkout: se ofrece consulta o lista de interés.

**Categorías y zonas**
- Jeans/denim intervenido como punto de partida, con arquitectura preparada para crecer.
- Zona íntima (ropa interior, corsetería).
- Accesorios.
- Carteras y bolsos exclusivos.
- Sección exclusiva "Camila Guerra" (VIP): colecciones super reducidas, abierta a clientas registradas, con stock muy limitado.

**Código único por unidad física** (función central)
- Se diferencia Diseño (modelo), Edición (serie/lanzamiento), Unidad (prenda física) y Número de ejemplar dentro de la edición.
- Cada unidad tiene un identificador único permanente garantizado en base de datos; no se reutiliza si la prenda se devuelve o retira, y conserva su código si vuelve al inventario.
- Por unidad se registra: diseño y edición, talle y color, número de ejemplar, estado (disponible/reservada/vendida/retirada) y pedido asociado con historial de cambios/devoluciones.
- Reserva temporal con expiración para evitar doble venta; inventario controlado en el servidor.
- Ficha pública por QR o código copiable con información de la pieza, sin datos personales ni pedidos. Se presenta como registro, no como prueba infalible de autenticidad.

**Comercio**
- Carrito, checkout, pedidos e inventario persistente. Moneda inicial: pesos argentinos (configurable).
- Pagos con **Mercado Pago**: creación y confirmación de pago desde el servidor (un pedido solo se marca pagado cuando el servidor lo confirma, no por llegar a una página de éxito). Credenciales fuera del frontend.
- Si faltan credenciales, entorno de prueba claramente identificado; no se simulan cobros reales.
- Compra como invitada; sumar una compra a una cuenta verifica la titularidad del pedido.

**Mi archivo (espacio privado de la clienta)**
- Pedidos y estado, piezas adquiridas, código individual de cada unidad, ficha digital y cuidados, certificado/ficha descargable cuando exista.

**Eventos**
- Creación y gestión de eventos (desfiles, lanzamientos, exposiciones, presentaciones) desde el panel.
- Las clientas pueden anotarse; si el evento es con entrada, pueden comprarla (mismo mecanismo de pago que las piezas).

**Panel de administración (protegido)**
- Productos, ediciones y unidades; fotos y videos; precios, talles, materiales y cuidados; publicación/borradores/archivo histórico; pedidos y devoluciones; listas de espera y suscripciones; contenidos de inicio y de la creadora; generación y exportación de códigos, QR y fichas; eventos; configuración comercial y de contacto.
- Permisos separados de administración y clientas, validados en el servidor.

**Packaging y fichas**
- Exportación de datos de unidades para producir etiquetas y tarjetas.
- Ficha imprimible con logo, nombre de la pieza, diseño, edición, código individual, número de ejemplar y QR.
- Campo opcional para cargar una firma autorizada (no se fabrica una firma de Camila).

**Archivo histórico**
- Ediciones agotadas visibles con su historia y fotos, indicando claramente que no están disponibles; se permite anotarse para novedades sin prometer reposición.

**Próximas liberaciones**
- Sección administrable con lista de espera; solo datos necesarios y consentimiento; sin fechas inventadas.

## Flujo de uso

1. La persona llega al Inicio: imagen/video real de gran impacto, logo y "Construí tu propio archivo", con acción principal **Explorar el archivo**.
2. Recorre el archivo disponible y las zonas (denim, íntima, accesorios, carteras), filtra y abre el expediente de una pieza.
3. Agrega al carrito y hace checkout; paga con Mercado Pago; el pedido se confirma desde el servidor.
4. Se registra o compra como invitada; en "Mi archivo" ve pedidos, piezas y el código único de cada unidad.
5. Las clientas registradas acceden a la sección VIP "Camila Guerra"; cualquiera puede anotarse a eventos o comprar entradas.
6. Camila administra todo desde el panel: publica piezas/ediciones/unidades, genera códigos/QR/fichas, gestiona pedidos y eventos.

## Estética y tono

- Carácter de editorial de moda y archivo de piezas de autor. Paleta negro/blanco y neutros; los colores de fotos y prendas pueden aparecer.
- Titulares contundentes, tipografía de lectura clara, detalles manuscritos ligados al logo original (ARCHIVE fuerte + "lab" manuscrito), composiciones asimétricas controladas, fotografía grande y acercamientos a materiales, numeración y referencias de expediente.
- Equilibrio entre crudeza urbana y presentación cuidada: ni "todo destruido/punk genérico" ni "boutique beige con dorados y estética corporativa".
- Navegación, precios, talles y compra siempre claros aunque la composición sea expresiva.
- Español argentino con voseo; voz segura, auténtica, sensual, rebelde y cercana. Vocabulario: "archivo", "pieza", "edición", "expediente", "liberación", conservando "talle", "precio", "carrito", "envío", "pedido". Sin urgencia falsa, contadores inventados, reseñas ficticias ni descuentos permanentes.
- Video en reproducción silenciosa con portada y controles accesibles; formato vertical respetado en celular; audio activable por acción de la persona.
- Accesibilidad: contraste, navegación por teclado, etiquetas de formularios, mensajes de error claros y respeto por movimiento reducido. Funciona bien en celular y escritorio.

## Fases de implementación

**Fase 1 — MVP (se construye ahora)**
- Inicio editorial con material real (una vez cargados los archivos) y las frases de marca.
- Archivo disponible con filtros + expediente de pieza completo.
- Zonas: denim intervenido, íntima, accesorios, carteras/bolsos.
- Carrito, checkout y pedidos con Mercado Pago (modo prueba identificado si faltan credenciales), moneda ARS, inventario en servidor con reserva temporal anti-doble-venta.
- Código único por unidad física con estados e historial; ficha pública por QR/código.
- "Mi archivo" con login propio (email + contraseña) y login con Google; compra como invitada.
- Panel de administración: piezas, ediciones, unidades, pedidos, contenidos, generación/exportación de códigos, QR y fichas imprimibles.
- Sección VIP "Camila Guerra" abierta a clientas registradas con stock reducido.
- Páginas de contacto, privacidad, condiciones de compra y cambios/devoluciones con campos pendientes marcados.

**Fase 2 — Eventos, histórico y liberaciones**
- Eventos (desfiles, lanzamientos, exposiciones) con inscripción y compra de entradas.
- Archivo histórico de ediciones agotadas con su historia.
- Próximas liberaciones con listas de espera y suscripción a novedades.
- Certificados/fichas descargables en "Mi archivo".

**Fase 3 — Logística y operación avanzada**
- Integración con un transportista argentino específico (a definir: Andreani, OCA, Correo Argentino u otro) para cálculo de envío y seguimiento; hasta entonces, envío por zonas configurable + retiro en persona.
- Envío real de confirmaciones y mensajes transaccionales por email.
- Datos estructurados de producto para compartir en redes (solo con datos reales) y optimización de rendimiento de imágenes/video.
- Pase de Mercado Pago a producción y verificación del dominio archivelab.fashion.

## Identidad extraída del brand deck (fuente de verdad)

**Definido (se usa tal cual):**
- **Posicionamiento:** piezas de autor / moda de autor. Territorio: arte + diseño + exclusividad + identidad + estilo. Promesa: "crear las piezas que hacen que un look pase de lindo a inolvidable".
- **Concepto rector:** ARCHIVE LAB funciona como un MUSEO de piezas de archivo; cada drop es una "liberación", cada pieza tiene identidad propia, cada edición es limitada, cada adquisición entra al archivo personal de quien la compra.
- **Flujo de marca:** ARCHIVO → PIEZA → EXPEDIENTE → EDICIÓN → LIBERACIÓN → ADQUISICIÓN (guía la arquitectura del sitio).
- **Autoría:** diseños exclusivos de la artista Cami Guerra; el valor no está en el logo sino en siluetas, acabados, intervenciones, texturas, detalles, construcción, materiales y combinaciones ("que alguien vea una prenda y diga: esto es Archive / esta es de Cami").
- **La belleza de los opuestos:** clásico+inesperado, formal+rebelde, femenino+poderoso, minimalista+statement, sofisticado+canchero. La contradicción es parte de la identidad.
- **Exclusividad real:** pocas unidades, ediciones numeradas, drops seleccionados, reposición limitada o inexistente, piezas identificadas.
- **Clienta:** ya tiene su guardarropa resuelto y conoce su estilo; compra con intención, valora diseño y detalles, quiere diferenciarse. Su problema no es "no sé qué ponerme" sino "quiero esa pieza que hace mi look increíble".
- **Frases rectoras (se asignan por sección, sin repetirlas todas):** "Construí tu propio archivo" · "Una pieza puede cambiarlo todo" · "No necesitás más ropa. Necesitás mejores piezas." · "No todo el mundo puede tenerla." · "Que tu ropa tenga tanta personalidad como vos." · "No creamos prendas para llenar tu closet. Creamos piezas para que se queden."
- **Paleta:** negro, blanco y un gris/taupe cálido y neutro (sin códigos exactos en el deck).
- **Logo:** ARCHIVE en tipografía fuerte + "lab" manuscrito.
- **Experiencia de producto / packaging:** packaging de archivo, etiqueta de pieza de archivo, y ficha con número de artículo, nombre de la pieza, color, edición, talle, nombre de la creadora y certificado/ficha de pieza.
- **Visión de expansión (ya nombrada en el deck):** accesorios de autor, básicos con firma propia, experiencias y eventos, colaboraciones con otras disciplinas, comunidad Archive. Esto respalda las zonas (accesorios, íntima, carteras) y los eventos pedidos.

**Pendiente en el deck (queda configurable, no se inventa):** precios y valores; códigos de color exactos (HEX/RGB); nombres de tipografías; contenido y formato de "expediente", "certificado/ficha de pieza" y "packaging de archivo"; detalle de accesorios/básicos futuros; gestión de la comunidad; calendario de drops; email/WhatsApp/dirección; textos legales.

## Voz y comunicación (del documento de marketing)

**Definido (se aplica en los textos del sitio):**
- **Voz:** como una persona con criterio pensando en voz alta, no como una marca anunciando. Primera persona, tiempo presente; comparte el proceso de decisión ("por qué esta tela sí y esta no"); nunca pide la venta directamente, contagia el gusto; tono calmo, entre pares; selectiva (muestra también lo que descarta). Personalidad: auténtica, rebelde, única, misteriosa y sensual.
- **Vocabulario de marca (se usa en toda la interfaz donde aporte sentido):** "acceder" en vez de comprar · "miembros del archivo" en vez de clientas · "nuevo al archivo" en vez de nuevo artículo · "agotaron archivo" en vez de agotaron stock · cada lanzamiento es una "liberación"/drop · cada pieza tiene su "expediente". Se conservan términos claros de compra: talle, precio, carrito, envío, pedido.
- **FOMO narrativo, no de precio:** la urgencia viene de la historia y de la escasez real (pocas unidades, sin reposición, coleccionabilidad), nunca de "últimas unidades" falsas, contadores inventados ni descuentos permanentes.
- **Estética de museo/laboratorio:** cada drop cuenta una historia (el descubrimiento o análisis de una pieza); el sitio sostiene siempre una estética de museo de archivo.
- **Ritual de inducción:** el unboxing/entrega se trata como "apertura de expediente" (packaging + ficha); se refleja en "Mi archivo" y en la ficha descargable.
- **FOMO y comunidad (respaldan VIP y eventos):** acceso anticipado para miembros ("archive nombres"), listas de espera, invitación a eventos y contenido exclusivo como beneficios.
- **La creadora (texto real del documento):** Camila Guerra / "Cami Guerra" — creadora digital, asesora de imagen y modelo; "La ropa correcta cambia cómo te ven y cómo te sentís"; Buenos Aires; cierre "A brillar, amores". Perfiles reales: marca @archivelab, creadora @camila_guerraa. Canales foco: Instagram y Pinterest (no TikTok).

**Pendiente en marketing (queda configurable, no se decide ni se inventa):** mecánica paso a paso del drop (anticipación, hora de apertura, piezas por drop, acceso anticipado); rango de precios por categoría; métodos de pago y envío definitivos; beneficios concretos de comunidad/retención; calendario y cadencia de contenido; presupuesto y producción. El sitio deja todo esto como configuración del panel y lista lo que falta para operar.

## Supuestos

- La identidad, el logo, las frases y el material real se tomarán de los 6 archivos que vas a subir; hasta tenerlos, Inicio y fichas usan contenido provisional claramente identificado y productos de demostración eliminables antes del lanzamiento.
- Pagos: Mercado Pago como pasarela, en modo prueba mientras no haya credenciales de producción; las entradas de eventos usan el mismo mecanismo.
- Envíos en el MVP: configurables por zona + retiro en persona; la integración con un transportista real queda para Fase 3 porque todavía no definiste cuál.
- Login: se ofrecen ambos métodos (email + contraseña y Google).
- VIP: acceso para cualquier clienta registrada, diferenciado por stock muy reducido en la sección "Camila Guerra".
- No se inventan datos comerciales (precios, cantidades, plazos, costos), trayectoria de la autora, email/WhatsApp/dirección ni textos legales revisados profesionalmente: se dejan configurables y se lista lo que falta para operar.
- Las decisiones comerciales pendientes en los documentos (precios, cantidades, pagos, logística, calendario, beneficios de membresía) quedan configurables desde el panel.
