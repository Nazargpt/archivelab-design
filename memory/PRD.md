# ARCHIVE LAB — PRD

## Problema / visión
Plataforma editorial y de e-commerce para ARCHIVE LAB (Camila "Cami" Guerra, Buenos Aires): un "museo de piezas de archivo" de moda de autor. Flujo de marca: ARCHIVO → PIEZA → EXPEDIENTE → EDICIÓN → LIBERACIÓN → ADQUISICIÓN. Español argentino (voseo), estética editorial oscura.

## Arquitectura
- Backend: FastAPI (`/app/backend/server.py`), rutas con prefijo `/api`, MongoDB (motor).
- Frontend: React + React Router + Tailwind + shadcn/ui + framer-motion. Token Bearer en `localStorage['archive_token']`.
- Integraciones: Mercado Pago (ARS) con confirmación desde el servidor; en modo DEMO/prueba sin credenciales (aprobación vía `/api/demo/approve`). Emergent Object Storage para imágenes/video. Auth: JWT email+password + Emergent Google login (colección `users` unificada, rol customer/admin).

## Personas
- Clienta de marca (compra invitada o registrada), Clienta VIP registrada, Camila (admin).

## Core requirements (estático)
- Catálogo con filtros (categoría/talle/disponibilidad) y expediente de pieza completo.
- Código único permanente por unidad física con estados (disponible/reservada/vendida/retirada) e historial; ficha pública por código/QR sin datos personales.
- Carrito + checkout + pedidos con reserva temporal anti-doble-venta (20 min) e inventario en servidor.
- Mi Archivo: pedidos, piezas adquiridas con su código, certificado imprimible, claim de pedido de invitada.
- Sección VIP "Camila Guerra" para registradas.
- Panel admin: piezas/ediciones/unidades, upload de imágenes/video, generación de códigos, QR, export CSV, pedidos, contenido y ajustes.
- Páginas legales (contacto, privacidad, condiciones, cambios) configurables.

## Implementado (2026-06)
- [x] Fase 1 MVP completa: inicio editorial con video de marca, archivo con filtros, expediente, 4 zonas, VIP con gating, carrito/checkout/Mercado Pago demo, código único + ficha pública/QR, Mi Archivo + certificado, panel admin completo, legales configurables.
- [x] Datos demo seedeados (DNM01, INT01, CAR01, CG01 VIP, VST01 sin precio) con unidades.
- [x] Eventos y Entradas (Fase 2): admin crea/edita eventos, control de cupos, inscripción gratuita y compra de entrada con el mismo pago (Mercado Pago demo). Vista pública /eventos, "Mis eventos" en Mi Archivo.
- [x] Fase 2 completa: Archivo histórico (solapa en /archivo con ediciones agotadas/archivadas y "avisame si vuelve"); Próximas liberaciones (/liberaciones) con lista de espera (email+nombre+talle+consentimiento); ficha/certificado descargable en PDF (reportlab, con QR); emails reales con Resend (gestionado por Emergent) para confirmación de lista de espera y avisos de novedades (liberación/vuelta de pieza) desde el panel.
- [x] Testing e2e: MVP 35/35 + eventos 12/12 + fase 2 23/23 backend; frontend verificado (bug de Mi Archivo mezclando eventos/piezas, corregido).

## Backlog (próximas fases)
- P2 Certificados/fichas descargables en PDF enriquecido.
- P2 Mercado Pago a producción + verificación de dominio archivelab.design.
- P2 Integración de transportista (Andreani/OCA/Correo) y emails transaccionales (Resend).
- P3 Escalar release_expired() a TTL/background task.

## Credenciales de prueba
Ver `/app/memory/test_credentials.md` (admin camila@archivelab.design / Archive2026!, clienta cliente@test.com / Cliente123!).

## Changelog
- 2026-06: Reponer y avisar rápido (un solo paso). En ProductEditor, al generar unidades (`UnitsManager.gen`), si quedan personas en la lista de espera sin avisar, aparece un confirm ("Repusiste stock. Hay N persona(s)… ¿Les avisamos ahora?") que dispara `/admin/products/{id}/notify` en el acto. Estado compartido `wlVersion` refresca `ProductWaitlist` tras avisar. Sin cambios de backend (reusa endpoints existentes). Probado end-to-end con Playwright: diálogo aparece con el conteo correcto, al aceptar notifica y la lista pasa a "todas avisadas".
- 2026-06: Notificar lista de espera (mejora anti-spam). El botón "Avisar que volvió" por pieza (ProductEditor → sección Lista de espera) ya existía; ahora `/admin/products/{id}/notify` usa `only_unnotified=True`, así solo contacta a quienes todavía no fueron avisados (no reenvía a los ya notificados). El botón muestra el conteo de pendientes ("Avisar que volvió (N)") y pasa a "todas avisadas" cuando no quedan pendientes. Releases mantienen el comportamiento de notificar a todos. Probado end-to-end: 1ª notificación marca avisadas, al sumar una persona nueva la 2ª solo la contacta a ella.
- 2026-06: Aviso de agotado. `check_low_stock` ahora también detecta total==0 → envía email a SELLER_EMAIL avisando que la pieza se agotó y pasó al Archivo Histórico, incluyendo los contactos de la lista de espera (nombre · email · talle) listos para contactar. Dedupe con flag `sold_out_notified` (una sola vez) y se rearma al reponer stock. Función `send_sold_out_email`. El Archivo Histórico sigue siendo dinámico (piezas con `edition_total` y 0 disponibles; VIP excluidas del listado público por diseño). Probado end-to-end: dispara al llegar a 0 con waitlist, guardrails OK, rearma al reponer. Entrega bloqueada en preview por clave Resend test (422), funciona en prod.
- 2026-06: Alerta de stock bajo. Setting `low_stock_threshold` (default 5, configurable en panel Ajustes). `check_low_stock(product_id)` se dispara tras cada venta (`mark_order_paid`), al generar unidades y al cambiar estado de unidad. Envía email a SELLER_EMAIL una sola vez al cruzar el umbral (flag `low_stock_notified` en el producto) y se rearma al reponer stock (total > umbral). Funciones `send_low_stock_email` / `check_low_stock`. Probado end-to-end: dispara al cruzar, no reenvía (anti-spam), rearma al reponer. Entrega bloqueada en preview por clave Resend test (422), funciona en prod.
- 2026-06: Resumen diario + API de transporte (preparada).
  - **Resumen Diario**: cron `.emergent/crons.yml` (daily-summary, `0 7 * * *` America/Argentina/Buenos_Aires) → `POST /api/cron/daily-summary` (Bearer `WEBHOOK_CRON_SECRET`, ack 2xx + background task, idempotente por X-Webhook-Id vía `db.cron_runs`). Envía a SELLER_EMAIL el resumen del día anterior (pedidos pagados, ingresos, piezas/entradas vendidas, envíos pendientes, nuevos en waitlist + detalle). Se envía todos los días. Funciones `build_daily_summary` / `send_daily_summary_email`. Probado end-to-end (401/200/duplicado); entrega bloqueada en preview por clave Resend test (422), funciona en prod.
  - **API Transporte (ready-to-activate)**: funciones `andreani_quote` (login Basic→token, GET /v1/tarifas) y `oca_quote` (ePak Tarifar_Envio_Corporativo, XML) + unificador `quote_shipping(province, postal_code, subtotal)` usado por `/shipping/quote` y checkout. Nuevos settings `origin_postal_code` + `default_weight_kg` y campo CP en checkout. Si hay transportista habilitado+configurado+CP origen+CP destino → cotiza en vivo; si no, cae a zonas/costo base (comportamiento actual). SIN credenciales aún → NO probado contra APIs reales de los carriers; se activa al cargar credenciales + CP origen + peso. Correo Argentino: pendiente de endpoint (queda en fallback).

