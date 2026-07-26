# Zampa · Rediseño iOS Native

## Problem Statement
Rediseño completo del frontend de la app "Zampa" (POS + Inventario, vanilla HTML/CSS/JS + Firebase) para lucir 100% como aplicación nativa iPhone (iOS Human Interface Guidelines / glassmorphism).

## User Choices (2026-01)
- Paleta: **Black/Gold premium** (acorde al logo cursivo).
- Modo: **Light + Dark auto-switch** vía `prefers-color-scheme`.
- Tipografía: **Inter** (weights 400-900).
- Estructura: estáticos servidos desde `/app/frontend/public/`.
- Se permitió modificar `app.js` (además de HTML y CSS).

## Architecture
- Estáticos vanilla servidos por `serve` en puerto 3000 (supervisor `frontend`).
- Backend FastAPI stub en 8001 (`/api/health`) para mantener supervisor healthy.
- Datos en Firebase Realtime DB + localStorage (cola offline). No se tocó la lógica de datos.

## Files
- `/app/frontend/public/index.html` – Layout iOS + safe-areas + Inter/Material Icons Round.
- `/app/frontend/public/style.css` – Sistema de diseño Black/Gold, glassmorphism, dark auto.
- `/app/frontend/public/app.js` – Render actualizado: tarjetas de productos, stepper iOS, badges píldora, agrupación en carrito, nueva función `quitarDelCarrito()`.
- `/app/frontend/package.json` – yarn start → `serve` static.
- `/app/backend/server.py` – FastAPI stub.

## What's implemented (2026-01-26)
- Balance card negro con gradiente radial dorado, glow y "shine" (iOS premium).
- Productos como tarjetas con nombre en negrita, precio prominente y **badge píldora** de stock (dorado normal / naranja bajo / rojo agotado).
- **Stepper iOS** (− qty +) al añadir producto al carrito, con vibración táctil.
- Carrito flotante con agrupación por producto + botón dorado "Cobrar Venta".
- Modal de vueltos rediseñado como **bottom-sheet iOS** con grabber, quick-money grid, botón "Exacto" dorado.
- Modal historial de cierres estilo iOS sheet.
- Dock inferior **flotante translúcido** con backdrop-filter blur 30px, indicador de pestaña activa (círculo dorado) y micro-animación de escala del icono.
- Header sticky glass con avatar de rol y estado de nube.
- Splash screen negro con glow dorado y "escritura" del logo animada.
- Toasts iOS translúcidos con blur, colores semánticos.
- Auto Light/Dark via `@media (prefers-color-scheme: dark)`.
- Compatibilidad con safe-area-inset (notch/home-indicator).
- Se preserva la lógica: Firebase sync, PIN admin `1234`, WhatsApp report, offline queue, cierre de caja, ajuste manual del acumulado.

## Backlog / Next Actions
- P1: Añadir gesto swipe-to-delete iOS en las tarjetas del historial de ventas.
- P2: Haptics más ricos (patrones distintos por acción) via `navigator.vibrate`.
- P2: Service worker para PWA offline completo (manifest ya listo).
- P2: Segmented control iOS para filtrar historial (Hoy / Ayer / Semana).

## Business Enhancement (sugerencia)
El logo cursivo dorado y la estética "diner premium" abre la puerta a un pequeño **modal "Gracias por tu compra" con animación de logo + botón compartir por WhatsApp** al terminar cada venta — convierte cada transacción en marketing orgánico y fideliza al cliente ambulante.
