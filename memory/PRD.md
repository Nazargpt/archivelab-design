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
- [x] Eventos y Entradas (Fase 2 parcial): admin crea/edita eventos (desfile/lanzamiento/exposición/presentación), control de cupos, inscripción gratuita y compra de entrada con el mismo pago (Mercado Pago demo). Vista pública /eventos, "Mis eventos" en Mi Archivo, inscriptas por evento en el panel.
- [x] Testing e2e: 35/35 backend MVP + 12/12 eventos, 100% flujos frontend críticos.

## Backlog (próximas fases)
- P1 Archivo histórico de ediciones agotadas con su historia.
- P1 Próximas liberaciones + listas de espera / suscripción a novedades.
- P2 Certificados/fichas descargables en PDF enriquecido.
- P2 Mercado Pago a producción + verificación de dominio archivelab.fashion.
- P2 Integración de transportista (Andreani/OCA/Correo) y emails transaccionales (Resend).
- P3 Escalar release_expired() a TTL/background task.

## Credenciales de prueba
Ver `/app/memory/test_credentials.md` (admin camila@archivelab.fashion / Archive2026!, clienta cliente@test.com / Cliente123!).
