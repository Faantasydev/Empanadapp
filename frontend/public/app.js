// ========================================================
// 🎬 ANIMACIÓN DE INICIO (SPLASH SCREEN)
// ========================================================
document.addEventListener("DOMContentLoaded", () => {
    const splashScreen = document.getElementById("splash-screen");

    if (sessionStorage.getItem("zampa_animado")) {
        if (splashScreen) splashScreen.style.display = "none";
    } else {
        sessionStorage.setItem("zampa_animado", "true");
        setTimeout(() => {
            if (splashScreen) {
                splashScreen.classList.add("ocultar-splash");
                setTimeout(() => splashScreen.remove(), 500);
            }
        }, 2200);
    }
});

// ========================================================
// ☁️ CONFIGURACIÓN DE FIREBASE EN LA NUBE
// ========================================================
const firebaseConfig = {
    apiKey: "AIzaSyAkt5K2tWbbr9QdUaJhZx0rLeDbaiEs98Q",
    authDomain: "empanadacontrol.firebaseapp.com",
    databaseURL: "https://empanadacontrol-default-rtdb.firebaseio.com",
    projectId: "empanadacontrol",
    storageBucket: "empanadacontrol.firebasestorage.app",
    messagingSenderId: "97127633277",
    appId: "1:97127633277:web:a32e2b8b7c5b64e0efbc14"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ========================================================
// 💾 ESTADO INICIAL (MEMORIA LOCAL)
// ========================================================
let inventario = JSON.parse(localStorage.getItem('empanadas_inventario')) || [];
let insumos = JSON.parse(localStorage.getItem('empanadas_insumos')) || [];
let balance = parseFloat(localStorage.getItem('empanadas_balance')) || 0;
let historial = JSON.parse(localStorage.getItem('empanadas_historial')) || [];
let historicoAcumulado = JSON.parse(localStorage.getItem('empanadas_historico_general')) || [];
let deudores = JSON.parse(localStorage.getItem('zampa_deudores')) || [];
let gastos = JSON.parse(localStorage.getItem('zampa_gastos')) || [];
let carrito = [];
let nubeLista = false;
let chartProductos = null; // instancia Chart.js
let chartDeudores = null;
let chartGastos = null;

// Utilidad: formatea número a moneda COP corta ($1.234)
function fmtMoney(n) {
    const v = Number(n || 0);
    return '$' + v.toLocaleString('es-CO');
}

// Utilidad: escapa HTML para nombres de productos
function esc(str) {
    return String(str).replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
}

// Renderizado inicial inmediato con memoria local para evitar parpadeos
document.addEventListener("DOMContentLoaded", () => {
    actualizarPantalla();
});

// ========================================================
// ☁️ SINCRONIZACIÓN EN TIEMPO REAL CON FIREBASE
// ========================================================
db.ref('empanada_control/').on('value', (snapshot) => {
    const data = snapshot.val();

    if (data) {
        if (data.inventario && Array.isArray(data.inventario)) inventario = data.inventario;
        if (data.insumos && Array.isArray(data.insumos)) insumos = data.insumos;
        if (data.balance !== undefined) balance = data.balance;
        if (data.historial && Array.isArray(data.historial)) historial = data.historial;
        if (data.deudores && Array.isArray(data.deudores)) deudores = data.deudores;
        if (data.gastos && Array.isArray(data.gastos)) gastos = data.gastos;

        if (data.historicoAcumulado && Array.isArray(data.historicoAcumulado)) {
            historicoAcumulado = data.historicoAcumulado;
            localStorage.setItem('empanadas_historico_general', JSON.stringify(historicoAcumulado));
        }
    }

    nubeLista = true;
    actualizarPantalla();
}, (error) => {
    console.error("Error conectando a Firebase en tiempo real:", error);
    nubeLista = true;
    actualizarPantalla();
});

// ========================================================
// 🔄 GUARDADO Y RENDER PRINCIPAL
// ========================================================
function guardarEnMemoria() {
    localStorage.setItem('empanadas_inventario', JSON.stringify(inventario));
    localStorage.setItem('empanadas_insumos', JSON.stringify(insumos));
    localStorage.setItem('empanadas_balance', balance.toString());
    localStorage.setItem('empanadas_historial', JSON.stringify(historial));
    localStorage.setItem('empanadas_historico_general', JSON.stringify(historicoAcumulado));
    localStorage.setItem('zampa_deudores', JSON.stringify(deudores));
    localStorage.setItem('zampa_gastos', JSON.stringify(gastos));

    const nube = document.getElementById('icono-nube');
    if (nube) {
        nube.className = "material-icons-round nube-cargando";
        nube.innerText = "cloud_upload";
    }

    if (!nubeLista) return;

    db.ref('empanada_control/').set({
        inventario, insumos, balance, historial, historicoAcumulado, deudores, gastos
    }, (error) => {
        if (error) {
            if (nube) {
                nube.className = "material-icons-round nube-error";
                nube.innerText = "cloud_off";
            }
        } else {
            if (nube) {
                setTimeout(() => {
                    nube.className = "material-icons-round nube-sincronizada";
                    nube.innerText = "cloud_done";
                }, 500);
            }
        }
    });
}

function actualizarPantalla() {
    aplicarPermisosRol();

    // ------- Balance principal -------
    const elemBalance = document.getElementById('balance-total');
    if (elemBalance) elemBalance.innerHTML = fmtMoney(balance);

    let dineroDiasAnteriores = 0;
    if (Array.isArray(historicoAcumulado)) {
        dineroDiasAnteriores = historicoAcumulado.reduce((sum, dia) => sum + (parseFloat(dia.balanceFinal) || 0), 0);
    }
    let saldoGranTotal = dineroDiasAnteriores + balance;

    const divGranTotal = document.getElementById('saldo-gran-total');
    if (divGranTotal) {
        const esAdminNow = (rolActual === 'admin');
        const inner = esAdminNow
            ? `<span onclick="editarAcumuladoTotal(event)" data-testid="acumulado-editable" title="Toca para editar">${fmtMoney(saldoGranTotal)}</span>`
            : `<span data-testid="acumulado-editable">${fmtMoney(saldoGranTotal)}</span>`;
        divGranTotal.innerHTML = `Acumulado Total: ${inner}`;
    }

    // ------- Lista de Ventas (Productos como tarjetas iOS) -------
    const divVentas = document.getElementById('lista-ventas-disponibles');
    if (divVentas) {
        if (inventario.length === 0) {
            divVentas.innerHTML = `
                <div class="empty-state" data-testid="empty-ventas">
                    <span class="material-icons-round">shopping_basket</span>
                    No hay productos en inventario aún.
                </div>`;
        } else {
            divVentas.innerHTML = inventario.map(prod => {
                const qtyEnCarrito = carrito.filter(p => p.id === prod.id).length;
                const stockActual = prod.stock;
                const badgeClass = stockActual === 0 ? 'agotado' : (stockActual <= 5 ? 'bajo' : '');
                const stockText = stockActual === 0 ? 'Agotado' : `${stockActual} disp.`;

                const controlHtml = qtyEnCarrito > 0
                    ? `<div class="stepper" data-testid="stepper-${prod.id}">
                          <button onclick="event.stopPropagation(); quitarDelCarrito(${prod.id})" data-testid="btn-menos-${prod.id}">−</button>
                          <span class="qty" data-testid="qty-${prod.id}">${qtyEnCarrito}</span>
                          <button onclick="event.stopPropagation(); agregarAlCarrito(${prod.id})" data-testid="btn-mas-${prod.id}" ${qtyEnCarrito >= stockActual ? 'disabled style="opacity:.35;pointer-events:none;"' : ''}>+</button>
                       </div>`
                    : `<button class="btn-add ${stockActual === 0 ? 'disabled' : ''}" onclick="event.stopPropagation(); agregarAlCarrito(${prod.id})" data-testid="btn-agregar-${prod.id}" ${stockActual === 0 ? 'disabled' : ''}>
                          <span class="material-icons-round" style="font-size:15px;">add</span> Agregar
                       </button>`;

                return `
                <div class="product-card" data-testid="product-card-${prod.id}">
                    <div class="product-info">
                        <span class="product-name">${esc(prod.nombre)}</span>
                        <span class="product-price">${fmtMoney(prod.precio)}</span>
                        <div class="product-meta-row">
                            <span class="badge-stock ${badgeClass}" data-testid="badge-stock-${prod.id}">
                                <span class="material-icons-round">inventory_2</span> ${stockText}
                            </span>
                        </div>
                    </div>
                    <div class="product-actions">
                        ${controlHtml}
                    </div>
                </div>`;
            }).join('');
        }
    }

    // ------- Carrito -------
    const divCarrito = document.getElementById('seccion-carrito');
    const divListaCarrito = document.getElementById('lista-carrito');

    if (divCarrito && divListaCarrito) {
        if (carrito.length > 0) {
            divCarrito.style.display = 'block';
            // Agrupar por producto
            const conteo = {};
            carrito.forEach(p => {
                if (!conteo[p.id]) conteo[p.id] = { nombre: p.nombre, precio: p.precio, cant: 0 };
                conteo[p.id].cant += 1;
            });
            divListaCarrito.innerHTML = Object.values(conteo).map(p => `
                <div class="cart-row">
                    <span><span class="qty">${p.cant}×</span>${esc(p.nombre)}</span>
                    <span class="price">${fmtMoney(p.precio * p.cant)}</span>
                </div>
            `).join('');

            let totalCarrito = carrito.reduce((sum, p) => sum + p.precio, 0);
            const totalCarritoElem = document.getElementById('total-carrito');
            if (totalCarritoElem) totalCarritoElem.innerText = fmtMoney(totalCarrito);
        } else {
            divCarrito.style.display = 'none';
        }
    }

    // ------- Receta / insumos selección (form nuevo producto) -------
    const divRecetaSelec = document.getElementById('receta-insumos-seleccion');
    if (divRecetaSelec) {
        if (insumos.length === 0) {
            divRecetaSelec.innerHTML = '<p>Registra tus insumos primero en la pestaña "Insumos" para calcular la ganancia real.</p>';
        } else {
            divRecetaSelec.innerHTML = '<p style="margin-bottom:6px; font-weight:600; color:var(--text-secondary);">¿Qué gasta 1 unidad?</p>' +
                insumos.map(ins => `
                    <div class="receta-row">
                        <input type="checkbox" id="check-insumo-${ins.id}" data-testid="check-insumo-${ins.id}">
                        <label for="check-insumo-${ins.id}" style="flex:1; cursor:pointer;">${esc(ins.nombre)}</label>
                        <input type="number" id="cant-insumo-${ins.id}" placeholder="¿Cuánto?" data-testid="cant-insumo-${ins.id}">
                    </div>
                `).join('');
        }
    }

    // ------- Inventario completo (tarjetas con métricas) -------
    const divInventario = document.getElementById('lista-inventario-completo');
    if (divInventario) {
        if (inventario.length === 0) {
            divInventario.innerHTML = `
                <div class="empty-state" data-testid="empty-inventario">
                    <span class="material-icons-round">inventory</span>
                    Sin productos registrados.
                </div>`;
        } else {
            divInventario.innerHTML = inventario.map(prod => {
                const costo = prod.costoProduccion || 0;
                const ganancia = (prod.ganancia !== undefined ? prod.ganancia : prod.precio) || 0;
                const porcentaje = prod.precio > 0 ? ((ganancia / prod.precio) * 100).toFixed(0) : 0;
                const stockActual = prod.stock;
                const badgeClass = stockActual === 0 ? 'agotado' : (stockActual <= 5 ? 'bajo' : '');
                const stockText = stockActual === 0 ? 'Agotado' : `${stockActual} disp.`;

                return `
                <div class="product-card inv-card" data-testid="inv-card-${prod.id}">
                    <div class="inv-header">
                        <div class="product-info">
                            <span class="product-name">${esc(prod.nombre)}</span>
                            <div class="product-meta-row">
                                <span class="badge-stock ${badgeClass}">
                                    <span class="material-icons-round">inventory_2</span> ${stockText}
                                </span>
                            </div>
                        </div>
                        <div class="product-actions">
                            <button class="icon-btn success" onclick="editarStockProducto(${prod.id})" title="Editar stock" data-testid="btn-edit-stock-${prod.id}">
                                <span class="material-icons-round">edit</span>
                            </button>
                            <button class="icon-btn danger" onclick="eliminarProducto(${prod.id})" title="Eliminar" data-testid="btn-eliminar-inv-${prod.id}">
                                <span class="material-icons-round">delete</span>
                            </button>
                        </div>
                    </div>
                    <div class="inv-metrics">
                        <div class="inv-metric">
                            <span class="lbl">Costo</span>
                            <span class="val danger">${fmtMoney(costo.toFixed(0))}</span>
                        </div>
                        <div class="inv-metric">
                            <span class="lbl">Precio</span>
                            <span class="val">${fmtMoney(prod.precio)}</span>
                        </div>
                        <div class="inv-metric">
                            <span class="lbl">Ganancia (${porcentaje}%)</span>
                            <span class="val success">${fmtMoney(ganancia.toFixed(0))}</span>
                        </div>
                    </div>
                </div>`;
            }).join('');
        }
    }

    // ------- Historial de ventas del día -------
    const divHistorial = document.getElementById('historial-lista');
    if (divHistorial) {
        if (historial.length === 0) {
            divHistorial.innerHTML = `
                <div class="empty-state" style="border:none; box-shadow:none; padding:22px 10px;" data-testid="empty-historial">
                    <span class="material-icons-round">receipt_long</span>
                    Aún no hay ventas registradas hoy.
                </div>`;
        } else {
            divHistorial.innerHTML = historial.map((factura, index) => `
                <div class="factura-item" data-testid="factura-${index}">
                    <div class="factura-detalle">
                        <strong>${esc(factura.detalle)}</strong>
                        <div class="factura-hora">${factura.hora}</div>
                    </div>
                    <div class="factura-right">
                        <span class="factura-total">${fmtMoney(factura.total)}</span>
                        <button class="btn-deshacer" onclick="deshacerVenta(${index})" title="Deshacer" data-testid="btn-deshacer-${index}">
                            <span class="material-icons-round">delete_forever</span>
                        </button>
                    </div>
                </div>
            `).join('');
        }
    }

    // ------- Lista de insumos -------
    const divInsumosLista = document.getElementById('lista-insumos-completa');
    if (divInsumosLista) {
        if (insumos.length === 0) {
            divInsumosLista.innerHTML = `
                <div class="empty-state" data-testid="empty-insumos">
                    <span class="material-icons-round">layers</span>
                    Sin insumos registrados aún.
                </div>`;
        } else {
            divInsumosLista.innerHTML = insumos.map(ins => `
                <div class="product-card" data-testid="insumo-card-${ins.id}">
                    <div class="product-info">
                        <span class="product-name">${esc(ins.nombre)}</span>
                        <span class="product-price">${fmtMoney(ins.costoUnitario.toFixed(2))} <small>costo unit.</small></span>
                    </div>
                    <div class="product-actions">
                        <button class="icon-btn danger" onclick="eliminarInsumo(${ins.id})" title="Eliminar" data-testid="btn-eliminar-insumo-${ins.id}">
                            <span class="material-icons-round">delete</span>
                        </button>
                    </div>
                </div>
            `).join('');
        }
    }

    // ------- Deudores -------
    renderDeudores();
    renderChartTopDeudores();

    // ------- Gastos e Inversiones (solo admin ve el accordion) -------
    renderGastos();
    const accordionGastos = document.getElementById('acc-gastos');
    if (accordionGastos) {
        accordionGastos.style.display = (rolActual === 'admin') ? 'block' : 'none';
    }

    // ------- Contadores dinámicos de accordions -------
    const nProds = inventario.length;
    const stockTotal = inventario.reduce((s, p) => s + (parseInt(p.stock) || 0), 0);
    const ventasSummary = document.getElementById('ventas-summary');
    if (ventasSummary) {
        ventasSummary.textContent = nProds === 0
            ? 'No hay productos disponibles'
            : `${nProds} ${nProds === 1 ? 'producto' : 'productos'} · ${stockTotal} en stock`;
    }
    const invSummary = document.getElementById('inventario-summary');
    if (invSummary) {
        invSummary.textContent = nProds === 0
            ? 'Sin productos registrados'
            : `${nProds} ${nProds === 1 ? 'producto' : 'productos'} registrados`;
    }
}

// ========================================================
// 📦 INSUMOS Y PRODUCTOS
// ========================================================
function agregarInsumo() {
    const nombreInp = document.getElementById('insumo-nombre');
    const costoInp = document.getElementById('insumo-costo');
    const cantInp = document.getElementById('insumo-cantidad');

    const nombre = nombreInp.value.trim();
    const costo = parseFloat(costoInp.value);
    const cantidad = parseFloat(cantInp.value);

    if (!nombre || isNaN(costo) || isNaN(cantidad) || cantidad <= 0) return alert("Datos inválidos.");

    insumos.push({
        id: Date.now(), nombre, costoTotal: costo, cantidadTotal: cantidad, costoUnitario: costo / cantidad
    });
    guardarEnMemoria();
    actualizarPantalla();
    nombreInp.value = ''; costoInp.value = ''; cantInp.value = '';
    mostrarToast(`✔ Insumo "${nombre}" registrado`, 'éxito');
}

function eliminarInsumo(id) {
    if (confirm("¿Eliminar este insumo?")) {
        insumos = insumos.filter(i => i.id !== id);
        guardarEnMemoria();
        actualizarPantalla();
    }
}

function agregarProducto() {
    const nombreInput = document.getElementById('nuevo-nombre');
    const precioInput = document.getElementById('nuevo-precio');
    const stockInput = document.getElementById('nuevo-stock');

    const nombre = nombreInput.value.trim();
    const precio = parseFloat(precioInput.value);
    const stock = parseInt(stockInput.value);

    if (!nombre || isNaN(precio) || isNaN(stock)) return alert("Rellena todos los campos.");

    let costoProduccionUnidad = 0;
    let recetaGuardada = [];
    insumos.forEach(insumo => {
        const inputCheck = document.getElementById(`check-insumo-${insumo.id}`);
        const inputCant = document.getElementById(`cant-insumo-${insumo.id}`);
        if (inputCheck && inputCheck.checked) {
            const cantidadUsada = parseFloat(inputCant.value) || 0;
            if (cantidadUsada > 0) {
                costoProduccionUnidad += (insumo.costoUnitario * cantidadUsada);
                recetaGuardada.push({ insumoId: insumo.id, cantidad: cantidadUsada });
            }
        }
    });

    inventario.push({
        id: Date.now(), nombre, precio, stock,
        costoProduccion: costoProduccionUnidad, ganancia: precio - costoProduccionUnidad, receta: recetaGuardada
    });

    guardarEnMemoria();
    actualizarPantalla();
    nombreInput.value = ''; precioInput.value = ''; stockInput.value = '';
    mostrarToast(`✔ "${nombre}" agregado al inventario`, 'éxito');
}

function eliminarProducto(id) {
    if (confirm("¿Eliminar producto?")) {
        inventario = inventario.filter(p => p.id !== id);
        guardarEnMemoria();
        actualizarPantalla();
    }
}

function editarStockProducto(id) {
    const producto = inventario.find(p => p.id === id);
    if (!producto) return;
    const nuevoStockStr = prompt(`Editar stock para "${producto.nombre}":`, producto.stock);
    if (nuevoStockStr !== null) {
        const nuevoStock = parseInt(nuevoStockStr);
        if (!isNaN(nuevoStock) && nuevoStock >= 0) {
            producto.stock = nuevoStock;
            guardarEnMemoria();
            actualizarPantalla();
        } else { alert("Número inválido."); }
    }
}

// ========================================================
// 💰 VENTAS, CARRITO Y VUELTOS
// ========================================================
let totalVentaActual = 0;
let callbackConfirmarVenta = null;

function abrirCalculadoraVueltos(total, callbackExito) {
    totalVentaActual = total;
    callbackConfirmarVenta = callbackExito;
    document.getElementById('vueltos-total-venta').innerText = fmtMoney(total);
    document.getElementById('vueltos-paga-con').value = '';
    document.getElementById('vueltos-resultado').innerText = '$0';
    document.getElementById('vueltos-resultado').style.color = '';
    document.getElementById('btn-confirmar-venta').disabled = true;
    document.getElementById('modal-vueltos').style.display = 'flex';
}

function calcularCambio() {
    const pagaCon = parseFloat(document.getElementById('vueltos-paga-con').value) || 0;
    const vueltos = pagaCon - totalVentaActual;
    const contenedorResultado = document.getElementById('vueltos-resultado');
    const btnConfirmar = document.getElementById('btn-confirmar-venta');

    if (pagaCon === 0) {
        contenedorResultado.innerText = '$0';
        contenedorResultado.style.color = '';
        btnConfirmar.disabled = true;
    } else if (vueltos < 0) {
        contenedorResultado.innerText = 'Falta: -' + fmtMoney(Math.abs(vueltos));
        contenedorResultado.style.color = 'var(--danger)';
        btnConfirmar.disabled = true;
    } else {
        contenedorResultado.innerText = fmtMoney(vueltos);
        contenedorResultado.style.color = '';
        btnConfirmar.removeAttribute('disabled');
    }
}

function definirPagoRapido(valor) { document.getElementById('vueltos-paga-con').value = valor; calcularCambio(); }
function definirPagoExacto() { document.getElementById('vueltos-paga-con').value = totalVentaActual; calcularCambio(); }
function cerrarModalVueltos() { document.getElementById('modal-vueltos').style.display = 'none'; }
function finalizarVentaConVueltos() { cerrarModalVueltos(); if (typeof callbackConfirmarVenta === 'function') callbackConfirmarVenta(); }

function agregarAlCarrito(id) {
    vibrar(25);
    const producto = inventario.find(p => p.id === id);
    if (!producto) return;
    const enCarritoActual = carrito.filter(p => p.id === id).length;
    if (enCarritoActual >= producto.stock) return alert("¡No hay más stock disponible!");
    carrito.push({...producto});
    guardarEnMemoria();
    actualizarPantalla();
}

function quitarDelCarrito(id) {
    vibrar(20);
    const idx = carrito.findIndex(p => p.id === id);
    if (idx !== -1) {
        carrito.splice(idx, 1);
        guardarEnMemoria();
        actualizarPantalla();
    }
}

function limpiarCarrito() { carrito = []; guardarEnMemoria(); actualizarPantalla(); }

function ejecutarTransaccionVenta(detalleVenta, totalVenta, actualizarStockCallback) {
    const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    actualizarStockCallback();

    const transaccion = {
        productoId: 'venta_pos',
        detalle: detalleVenta,
        total: totalVenta,
        hora: hora
    };

    balance += totalVenta;
    historial.unshift(transaccion);

    if (!navigator.onLine) {
        guardarVentaOffline(transaccion);
        mostrarToast("📴 Venta guardada localmente. Se sincronizará al volver la señal.", "alerta", 4000);
    } else {
        mostrarToast(`✔ Venta registrada · ${fmtMoney(totalVenta)}`, "éxito", 2500);
    }

    guardarEnMemoria();
    actualizarPantalla();
}

function venderUno(id) {
    const producto = inventario.find(p => p.id === id);
    if (!producto || producto.stock <= 0) return;

    abrirCalculadoraVueltos(producto.precio, function() {
        ejecutarTransaccionVenta(`1 ${producto.nombre}`, producto.precio, () => {
            producto.stock -= 1;
        });
    });
}

function cobrarVenta() {
    if (carrito.length === 0) return;
    let total = carrito.reduce((sum, p) => sum + p.precio, 0);

    const carritoCopia = [...carrito];
    const detalleCombo = obtenerResumenCarrito(carritoCopia);

    abrirCalculadoraVueltos(total, function() {
        ejecutarTransaccionVenta(detalleCombo, total, () => {
            carritoCopia.forEach(itemCarrito => {
                const prodInventario = inventario.find(p => p.id === itemCarrito.id);
                if (prodInventario) prodInventario.stock -= 1;
            });
            carrito = [];
        });
    });
}

function deshacerVenta(index) {
    const venta = historial[index];
    balance -= venta.total;
    if (balance < 0) balance = 0;

    let items = venta.detalle.split(", ");
    items.forEach(item => {
        let partes = item.trim().split(" ");
        let cantidad = parseInt(partes[0]) || 1;
        let nombreProducto = partes.slice(1).join(" ");
        const producto = inventario.find(p => p.nombre === nombreProducto);
        if (producto) producto.stock += cantidad;
    });

    historial.splice(index, 1);
    guardarEnMemoria();
    actualizarPantalla();
}

function obtenerResumenCarrito(listaProductos) {
    const conteo = {};
    listaProductos.forEach(prod => { conteo[prod.nombre] = (conteo[prod.nombre] || 0) + 1; });
    return Object.entries(conteo).map(([nombre, cant]) => `${cant} ${nombre}`).join(", ");
}

// ========================================================
// 📊 HISTORIAL, CIERRES DE CAJA Y ACUMULADO
// ========================================================
function mostrarHistorialCierres() {
    const divModal = document.getElementById('modal-historial-cierres');
    const divLista = document.getElementById('lista-cierres-dia-a-dia');
    if (!divLista || !divModal) return;

    // Renderizar gráfico circular de productos más vendidos
    renderChartTopProductos();

    divLista.innerHTML = '';
    if (historicoAcumulado.length === 0) {
        divLista.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:13px; margin:20px 0;">No hay cierres registrados.</p>';
    } else {
        historicoAcumulado.forEach((cierre, index) => {
            divLista.innerHTML += `
                <div class="cierre-row cierre-row-click" onclick="mostrarDetalleDia(${index})" data-testid="cierre-row-${index}">
                    <span class="cierre-fecha">
                        <span class="material-icons-round">calendar_today</span>${esc(cierre.fecha || "Ajuste")}
                    </span>
                    <span class="cierre-right">
                        <span class="cierre-monto">${fmtMoney(parseInt(cierre.balanceFinal || 0))}</span>
                        <span class="material-icons-round cierre-chevron">chevron_right</span>
                    </span>
                </div>`;
        });
    }
    divModal.style.display = 'flex';
}

// ========================================================
// 📋 DETALLE DE UN DÍA: UNIDADES VENDIDAS POR PRODUCTO
// ========================================================
function mostrarDetalleDia(index) {
    const cierre = historicoAcumulado[index];
    if (!cierre) return;

    const divModal = document.getElementById('modal-detalle-dia');
    const tituloEl = document.getElementById('detalle-dia-titulo');
    const listaEl = document.getElementById('detalle-dia-lista');
    const totalEl = document.getElementById('detalle-dia-total');
    if (!divModal || !listaEl) return;

    // Agrupar unidades vendidas por producto
    const conteo = {};
    const procesarDetalle = (detalle) => {
        if (!detalle || typeof detalle !== 'string') return;
        detalle.split(', ').forEach(item => {
            const partes = item.trim().split(' ');
            const cant = parseInt(partes[0]) || 1;
            const nombre = partes.slice(1).join(' ');
            if (nombre) conteo[nombre] = (conteo[nombre] || 0) + cant;
        });
    };

    if (Array.isArray(cierre.ventasDetalle)) {
        cierre.ventasDetalle.forEach(v => {
            if (typeof v === 'string') procesarDetalle(v);
            else if (v && typeof v === 'object' && v.detalle) procesarDetalle(v.detalle);
        });
    }

    if (tituloEl) tituloEl.textContent = cierre.fecha || "Ajuste";

    const productos = Object.entries(conteo).sort((a, b) => b[1] - a[1]);
    const totalUnidades = productos.reduce((s, [, c]) => s + c, 0);

    if (productos.length === 0) {
        listaEl.innerHTML = `
            <div class="empty-state" style="border:none; box-shadow:none; padding:22px 10px;">
                <span class="material-icons-round">inventory_2</span>
                No hay detalle de productos para este día.
            </div>`;
    } else {
        listaEl.innerHTML = productos.map(([nombre, cant]) => `
            <div class="detalle-dia-row">
                <span class="detalle-dia-nombre">${esc(nombre)}</span>
                <span class="detalle-dia-cant">${cant} <small>und.</small></span>
            </div>`).join('');
    }

    if (totalEl) {
        totalEl.innerHTML = `
            <span>Total del día</span>
            <span>${totalUnidades} und. · ${fmtMoney(parseInt(cierre.balanceFinal || 0))}</span>`;
    }

    divModal.style.display = 'flex';
}

function cerrarDetalleDia() {
    const divModal = document.getElementById('modal-detalle-dia');
    if (divModal) divModal.style.display = 'none';
}

// ========================================================
// 📊 GRÁFICO CIRCULAR: TOP PRODUCTOS MÁS VENDIDOS
// ========================================================
function calcularTopProductos() {
    const conteo = {};

    const procesarDetalle = (detalle) => {
        if (!detalle || typeof detalle !== 'string') return;
        detalle.split(', ').forEach(item => {
            const partes = item.trim().split(' ');
            const cant = parseInt(partes[0]) || 1;
            const nombre = partes.slice(1).join(' ');
            if (nombre) conteo[nombre] = (conteo[nombre] || 0) + cant;
        });
    };

    // Ventas de hoy
    historial.forEach(v => procesarDetalle(v.detalle));

    // Ventas de días acumulados
    historicoAcumulado.forEach(dia => {
        if (Array.isArray(dia.ventasDetalle)) {
            dia.ventasDetalle.forEach(v => {
                if (v && typeof v === 'object' && v.detalle) procesarDetalle(v.detalle);
            });
        }
    });

    return Object.entries(conteo)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);
}

function renderChartTopProductos() {
    const wrap = document.getElementById('chart-productos-wrap');
    const canvasEl = document.getElementById('chart-productos-canvas');
    const legendEl = document.getElementById('chart-productos-legend');
    const emptyEl = document.getElementById('chart-productos-empty');
    const innerEl = document.getElementById('chart-productos-inner');
    if (!wrap || !canvasEl) return;

    const top = calcularTopProductos();

    if (top.length === 0 || typeof Chart === 'undefined') {
        if (innerEl) innerEl.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'block';
        return;
    }

    if (innerEl) innerEl.style.display = 'flex';
    if (emptyEl) emptyEl.style.display = 'none';

    const paleta = ['#C9A44C', '#0A0A0B', '#34C759', '#FF9F0A', '#FF3B30', '#8E8E93'];
    const labels = top.map(([n]) => n);
    const values = top.map(([, c]) => c);
    const totalVendidos = values.reduce((a, b) => a + b, 0);

    // Destruir instancia previa antes de crear una nueva
    if (chartProductos) {
        try { chartProductos.destroy(); } catch (e) {}
        chartProductos = null;
    }

    const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

    chartProductos = new Chart(canvasEl, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: paleta.slice(0, values.length),
                borderColor: isDark ? '#1C1C1E' : '#FFFFFF',
                borderWidth: 2,
                hoverOffset: 6
            }]
        },
        options: {
            responsive: false,
            cutout: '62%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.label}: ${ctx.parsed} vend.`
                    }
                }
            },
            animation: { animateRotate: true, duration: 700 }
        }
    });

    // Leyenda custom
    if (legendEl) {
        legendEl.innerHTML = top.map(([nombre, cant], i) => {
            const pct = totalVendidos > 0 ? Math.round((cant / totalVendidos) * 100) : 0;
            return `
                <div class="legend-row">
                    <span class="legend-swatch" style="background:${paleta[i]}"></span>
                    <span class="legend-name">${esc(nombre)}</span>
                    <span class="legend-count">${cant} · ${pct}%</span>
                </div>`;
        }).join('');
    }
}

function editarAcumuladoTotal(event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    let dineroDiasAnteriores = historicoAcumulado.reduce((sum, dia) => sum + (parseFloat(dia.balanceFinal) || 0), 0);
    let saldoActualTotal = dineroDiasAnteriores + balance;

    const nuevoValorStr = prompt("Escribe el nuevo valor real para tu Acumulado Total:", saldoActualTotal);
    if (nuevoValorStr !== null) {
        const nuevoValor = parseFloat(nuevoValorStr);
        if (!isNaN(nuevoValor) && nuevoValor >= 0) {
            historicoAcumulado = [{
                id: Date.now(),
                fecha: "Ajuste Manual",
                balanceFinal: nuevoValor - balance
            }];
            guardarEnMemoria();
            actualizarPantalla();
        }
    }
}

function cerrarCaja() {
    if (balance <= 0) return alert("No hay dinero en el balance de hoy para cerrar.");

    if (confirm("¿Cerrar caja y acumular el dinero de hoy?")) {
        const ahora = new Date();
        const fecha = ahora.toLocaleDateString('es-CO') + " " + ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (!Array.isArray(historicoAcumulado)) historicoAcumulado = [];

        historicoAcumulado.push({
            id: Date.now(), fecha, balanceFinal: balance, ventasDetalle: [...historial]
        });

        balance = 0;
        historial = [];
        guardarEnMemoria();
        actualizarPantalla();
        alert("¡Caja cerrada y acumulada correctamente!");
    }
}

function verificarCierreDeDia() {
    const ahora = new Date();
    const hoyStr = ahora.toLocaleDateString('es-CO');
    let ultimaFechaControl = localStorage.getItem('empanadas_fecha_control');

    if (!ultimaFechaControl) {
        localStorage.setItem('empanadas_fecha_control', hoyStr);
        return;
    }

    if (ultimaFechaControl !== hoyStr) {
        let balanceAyer = balance;
        let historialAyer = historial;

        if (balanceAyer > 0 || historialAyer.length > 0) {
            historicoAcumulado.push({
                id: Date.now(),
                fecha: ultimaFechaControl,
                balanceFinal: balanceAyer,
                ventasDetalle: historialAyer
            });
        }

        balance = 0;
        historial = [];
        localStorage.setItem('empanadas_fecha_control', hoyStr);
        guardarEnMemoria();
    }
}

verificarCierreDeDia();
setInterval(verificarCierreDeDia, 60000);

function agregarDiaDeLibreta() {
    const fechaIngresada = prompt("Ingresa la fecha del día que quieres registrar (Ejemplo: 05/07/2026):");
    if (!fechaIngresada || fechaIngresada.trim() === "") return;

    const montoIngresado = prompt(`¿Cuánto fue la ganancia total del día ${fechaIngresada}?`);
    if (montoIngresado === null) return;

    const montoReal = parseFloat(montoIngresado);
    if (isNaN(montoReal) || montoReal < 0) {
        return alert("Por favor, ingresa un número válido sin letras ni símbolos extraños.");
    }

    historicoAcumulado.push({
        id: Date.now(),
        fecha: fechaIngresada + " (Libreta)",
        balanceFinal: montoReal,
        ventasDetalle: ["Registro manual desde libreta física"]
    });

    guardarEnMemoria();
    actualizarPantalla();
    mostrarHistorialCierres();
}

function sumarAlBalance(event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    vibrar(40);
    efectoVisualToque(document.getElementById("balance-total"));

    let cantidadIngresada = prompt("¿Cuánto deseas sumar al balance de hoy?");

    if (cantidadIngresada !== null && cantidadIngresada.trim() !== "") {
        let montoASumar = parseInt(cantidadIngresada.replace(/\D/g, ''));

        if (!isNaN(montoASumar) && montoASumar > 0) {
            balance += montoASumar;
            guardarEnMemoria();
            actualizarPantalla();
        } else {
            alert("⚠️ Por favor, ingresa una cantidad válida mayor a 0.");
        }
    }
}

// ========================================================
// 🔐 GESTIÓN DE ROLES
// ========================================================
const PIN_ADMIN = "1234";
let rolActual = localStorage.getItem('zampa_rol') || 'vendedor';

function aplicarPermisosRol() {
    const esAdmin = (rolActual === 'admin');
    const iconoRol = document.getElementById('icono-rol');

    // Clase en body: para reordenar dock según rol
    document.body.classList.toggle('rol-admin', esAdmin);
    document.body.classList.toggle('rol-vendedor', !esAdmin);

    if (iconoRol) {
        const inner = iconoRol.querySelector('.material-icons-round') || iconoRol;
        inner.innerText = esAdmin ? 'admin_panel_settings' : 'badge';
        iconoRol.style.color = esAdmin ? 'var(--gold)' : '';
        iconoRol.title = esAdmin ? 'Modo Administrador (Toca para cambiar)' : 'Modo Vendedor (Toca para entrar con PIN)';
    }

    const btnInventario = document.getElementById('dock-inventario');
    const btnInsumos = document.getElementById('dock-insumos');
    if (btnInventario) btnInventario.style.display = esAdmin ? 'flex' : 'none';
    if (btnInsumos) btnInsumos.style.display = esAdmin ? 'flex' : 'none';

    // Acumulado Total: solo visible en Modo Admin (privacidad frente a vendedores).
    const saldoGranTotal = document.getElementById('saldo-gran-total');
    if (saldoGranTotal) saldoGranTotal.style.display = esAdmin ? 'block' : 'none';

    const pantallaInv = document.getElementById('pantalla-inventario');
    const pantallaIns = document.getElementById('pantalla-insumos');

    if (!esAdmin && pantallaInv && pantallaIns) {
        if (pantallaInv.classList.contains('activa') || pantallaIns.classList.contains('activa')) {
            const btnVentas = document.querySelector('.dock-item');
            if (typeof cambiarPestaña === 'function') cambiarPestaña('pantalla-ventas', btnVentas);
        }
    }
}

function alternarRol() {
    if (rolActual === 'vendedor') {
        // Abrir teclado numérico iOS in-page. Callback devuelve true=cerrar, false=shake+reset
        abrirModalPin((pinIngresado) => {
            if (pinIngresado === PIN_ADMIN) {
                rolActual = 'admin';
                localStorage.setItem('zampa_rol', 'admin');
                aplicarPermisosRol();
                actualizarPantalla();
                setTimeout(() => alert("🔓 ¡Modo Administrador activado!"), 200);
                return true;
            }
            // PIN incorrecto → devolver false para que el modal haga shake
            return false;
        });
    } else {
        if (confirm("¿Deseas bloquear la app y volver al Modo Vendedor (Ambulante)?")) {
            rolActual = 'vendedor';
            localStorage.setItem('zampa_rol', 'vendedor');
            aplicarPermisosRol();
            actualizarPantalla();
            alert("🔒 Modo Vendedor activado.");
        }
    }
}

// ========================================================
// 🔢 TECLADO NUMÉRICO iOS PARA PIN (in-page, sin prompt nativo)
// ========================================================
let pinBufferActual = '';
let pinCallbackActual = null;

function abrirModalPin(callback) {
    pinBufferActual = '';
    pinCallbackActual = callback;
    renderPinDots();
    const dots = document.getElementById('pin-dots');
    if (dots) dots.classList.remove('shake');
    const modal = document.getElementById('modal-pin');
    if (modal) modal.style.display = 'flex';
}

function cerrarModalPin() {
    const modal = document.getElementById('modal-pin');
    if (modal) modal.style.display = 'none';
    pinBufferActual = '';
    pinCallbackActual = null;
}

function renderPinDots() {
    const dotsWrap = document.getElementById('pin-dots');
    if (!dotsWrap) return;
    let html = '';
    for (let i = 0; i < 4; i++) {
        html += `<span class="pin-dot ${i < pinBufferActual.length ? 'filled' : ''}"></span>`;
    }
    dotsWrap.innerHTML = html;
}

function shakePinDots() {
    const dots = document.getElementById('pin-dots');
    if (!dots) return;
    dots.classList.remove('shake');
    void dots.offsetWidth;
    dots.classList.add('shake');
    setTimeout(() => dots.classList.remove('shake'), 600);
}

function pinKeyPress(digit) {
    vibrar(15);
    if (pinBufferActual.length >= 4) return;
    pinBufferActual += String(digit);
    renderPinDots();
    // Auto-submit al llegar a 4 dígitos
    if (pinBufferActual.length === 4) {
        const cb = pinCallbackActual;
        const pin = pinBufferActual;
        setTimeout(() => {
            const result = (typeof cb === 'function') ? cb(pin) : true;
            if (result === false) {
                // PIN incorrecto: vibrar fuerte + shake + limpiar
                vibrar([80, 50, 80, 50, 80]);
                shakePinDots();
                pinBufferActual = '';
                setTimeout(renderPinDots, 550);
            } else {
                cerrarModalPin();
            }
        }, 160);
    }
}

function pinBorrar() {
    vibrar(10);
    pinBufferActual = pinBufferActual.slice(0, -1);
    renderPinDots();
}

// Teclado físico para PIN (útil en modo ordenador)
document.addEventListener('keydown', function(e) {
    const modal = document.getElementById('modal-pin');
    if (!modal || getComputedStyle(modal).display === 'none') return;

    if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        pinKeyPress(parseInt(e.key, 10));
    } else if (e.key === 'Backspace') {
        e.preventDefault();
        pinBorrar();
    } else if (e.key === 'Escape') {
        e.preventDefault();
        cerrarModalPin();
    }
});

// ========================================================
// 💳 DEUDORES / FIADOS (Solo sumar, solo pagar para eliminar)
// ========================================================
const RECARGO_DEUDA = 0.10; // 10%

function renderDeudores() {
    const listaEl = document.getElementById('lista-deudores');
    const totalEl = document.getElementById('deuda-total-monto');
    const countEl = document.getElementById('deuda-count-text');

    if (!listaEl) return;

    // Resumen total
    const totalDeuda = deudores.reduce((s, d) => s + (parseFloat(d.monto) || 0), 0);
    if (totalEl) totalEl.innerHTML = fmtMoney(totalDeuda);
    if (countEl) {
        const n = deudores.length;
        countEl.innerHTML = n === 0
            ? 'Sin fiados registrados'
            : `${n} ${n === 1 ? 'persona fiada' : 'personas fiadas'}`;
    }

    if (deudores.length === 0) {
        listaEl.innerHTML = `
            <div class="empty-state" data-testid="empty-deudores">
                <span class="material-icons-round">handshake</span>
                Sin deudores registrados aún.
            </div>`;
        return;
    }

    listaEl.innerHTML = deudores.map(d => {
        const fechaTxt = d.fechaCreacion || '—';
        const veces = (d.movimientos && d.movimientos.length) || 1;
        const esAdmin = (rolActual === 'admin');
        const botonBorrar = esAdmin
            ? `<button class="icon-btn danger" onclick="borrarDeudorAdmin(${d.id})" title="Borrar (admin)" data-testid="btn-borrar-deudor-${d.id}">
                    <span class="material-icons-round">delete</span>
               </button>`
            : '';
        return `
        <div class="deudor-card" data-testid="deudor-card-${d.id}">
            <div class="deudor-header">
                <div class="deudor-info">
                    <span class="deudor-nombre">${esc(d.nombre)}</span>
                    <div class="deudor-meta">
                        <span class="material-icons-round">event</span>
                        <span>Desde ${esc(fechaTxt)} · ${veces} ${veces === 1 ? 'movimiento' : 'movimientos'}</span>
                    </div>
                </div>
                <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
                    <div class="deudor-monto-total" data-testid="deudor-monto-${d.id}">${fmtMoney(d.monto)}</div>
                    ${botonBorrar}
                </div>
            </div>
            <div class="deudor-actions">
                <button class="btn-sumar-deuda" onclick="sumarDeudaAExistente(${d.id})" data-testid="btn-sumar-${d.id}">
                    <span class="material-icons-round">add</span> Sumar deuda
                </button>
                <button class="btn-pagar-deuda" onclick="pagarDeuda(${d.id})" data-testid="btn-pagar-${d.id}">
                    <span class="material-icons-round">check_circle</span> Pagó todo
                </button>
            </div>
        </div>`;
    }).join('');
}

function agregarDeudor() {
    const nombreInp = document.getElementById('deudor-nombre');
    const montoInp = document.getElementById('deudor-monto');
    const nombre = (nombreInp.value || '').trim();
    const montoBase = parseFloat(montoInp.value);

    if (!nombre || isNaN(montoBase) || montoBase <= 0) {
        return alert("Ingresa nombre y monto válido mayor a 0.");
    }

    const montoConRecargo = Math.round(montoBase * (1 + RECARGO_DEUDA));
    const fechaHoy = new Date().toLocaleDateString('es-CO');

    deudores.push({
        id: Date.now(),
        nombre,
        monto: montoConRecargo,
        fechaCreacion: fechaHoy,
        movimientos: [{
            fecha: fechaHoy,
            hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            base: montoBase,
            recargo: montoConRecargo - montoBase,
            total: montoConRecargo,
            tipo: 'inicial'
        }]
    });

    guardarEnMemoria();
    actualizarPantalla();
    nombreInp.value = ''; montoInp.value = '';
    mostrarToast(`✔ Deuda de ${nombre}: ${fmtMoney(montoConRecargo)} (base ${fmtMoney(montoBase)} + 10%)`, 'éxito', 4000);
}

function sumarDeudaAExistente(id) {
    const d = deudores.find(x => x.id === id);
    if (!d) return;

    const nuevoStr = prompt(`Sumar deuda a "${d.nombre}"\n\nMonto adicional (se sumará +10% de recargo):`);
    if (nuevoStr === null || nuevoStr.trim() === '') return;

    const montoBase = parseFloat(nuevoStr.replace(/\D/g, ''));
    if (isNaN(montoBase) || montoBase <= 0) return alert("Monto inválido.");

    const montoConRecargo = Math.round(montoBase * (1 + RECARGO_DEUDA));
    d.monto = (parseFloat(d.monto) || 0) + montoConRecargo;

    if (!Array.isArray(d.movimientos)) d.movimientos = [];
    d.movimientos.push({
        fecha: new Date().toLocaleDateString('es-CO'),
        hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        base: montoBase,
        recargo: montoConRecargo - montoBase,
        total: montoConRecargo,
        tipo: 'suma'
    });

    guardarEnMemoria();
    actualizarPantalla();
    mostrarToast(`✔ +${fmtMoney(montoConRecargo)} a ${d.nombre}. Total: ${fmtMoney(d.monto)}`, 'éxito', 4000);
}

function pagarDeuda(id) {
    const d = deudores.find(x => x.id === id);
    if (!d) return;

    if (!confirm(`¿"${d.nombre}" pagó COMPLETAMENTE la deuda de ${fmtMoney(d.monto)}?\n\nEsta es la única forma de eliminar la deuda.`)) return;

    deudores = deudores.filter(x => x.id !== id);
    guardarEnMemoria();
    actualizarPantalla();
    mostrarToast(`✅ ${d.nombre} pagó ${fmtMoney(d.monto)}. Deuda liquidada.`, 'éxito', 4000);
}

function borrarDeudorAdmin(id) {
    if (rolActual !== 'admin') return alert("Solo el administrador puede borrar deudas sin pagar.");
    const d = deudores.find(x => x.id === id);
    if (!d) return;

    if (!confirm(`⚠️ Modo Admin: borrar la deuda de "${d.nombre}" (${fmtMoney(d.monto)}) sin registrarla como pagada.\n\n¿Confirmas?`)) return;

    deudores = deudores.filter(x => x.id !== id);
    guardarEnMemoria();
    actualizarPantalla();
    mostrarToast(`🗑 Deuda de ${d.nombre} borrada por admin`, 'alerta', 3500);
}

// ========================================================
// 📊 GRÁFICO CIRCULAR: TOP 5 DEUDORES (Quién debe más)
// ========================================================
function renderChartTopDeudores() {
    const wrap = document.getElementById('chart-deudores-wrap');
    const canvasEl = document.getElementById('chart-deudores-canvas');
    const legendEl = document.getElementById('chart-deudores-legend');
    if (!wrap || !canvasEl) return;

    // Solo mostrar si hay al menos 2 deudores
    if (deudores.length < 2 || typeof Chart === 'undefined') {
        wrap.style.display = 'none';
        if (chartDeudores) { try { chartDeudores.destroy(); } catch (e) {} chartDeudores = null; }
        return;
    }

    wrap.style.display = 'block';

    // Top 5 deudores por monto
    const top = [...deudores]
        .sort((a, b) => (parseFloat(b.monto) || 0) - (parseFloat(a.monto) || 0))
        .slice(0, 5);

    const paleta = ['#FF3B30', '#FF9F0A', '#C9A44C', '#8E8E93', '#34C759'];
    const labels = top.map(d => d.nombre);
    const values = top.map(d => parseFloat(d.monto) || 0);
    const totalTop = values.reduce((a, b) => a + b, 0);

    if (chartDeudores) { try { chartDeudores.destroy(); } catch (e) {} chartDeudores = null; }

    const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

    chartDeudores = new Chart(canvasEl, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: paleta.slice(0, values.length),
                borderColor: isDark ? '#1C1C1E' : '#FFFFFF',
                borderWidth: 2,
                hoverOffset: 6
            }]
        },
        options: {
            responsive: false,
            cutout: '62%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.label}: ${fmtMoney(ctx.parsed)}`
                    }
                }
            },
            animation: { animateRotate: true, duration: 700 }
        }
    });

    if (legendEl) {
        legendEl.innerHTML = top.map((d, i) => {
            const pct = totalTop > 0 ? Math.round((d.monto / totalTop) * 100) : 0;
            return `
                <div class="legend-row">
                    <span class="legend-swatch" style="background:${paleta[i]}"></span>
                    <span class="legend-name">${esc(d.nombre)}</span>
                    <span class="legend-count">${fmtMoney(d.monto)} · ${pct}%</span>
                </div>`;
        }).join('');
    }
}

// ========================================================
// 💼 GASTOS E INVERSIONES (Accordion en Inventario, solo admin)
// ========================================================
function toggleAccordionGastos() {
    toggleAccordion('acc-gastos');
}

function toggleAccordion(id) {
    vibrar(15);
    const section = document.getElementById(id);
    if (!section) return;
    section.classList.toggle('open');
}

function renderGastos() {
    const listaEl = document.getElementById('lista-gastos');
    const summaryEl = document.getElementById('gastos-summary');
    if (!listaEl) return;

    const totalGastos = gastos.reduce((s, g) => s + (parseFloat(g.costo) || 0), 0);

    if (summaryEl) {
        summaryEl.textContent = gastos.length === 0
            ? 'Ítems que no se venden (equipos, consumibles...)'
            : `${gastos.length} ${gastos.length === 1 ? 'ítem' : 'ítems'} · Total invertido ${fmtMoney(totalGastos)}`;
    }

    // Chart gastos
    renderChartGastos();

    if (gastos.length === 0) {
        listaEl.innerHTML = `
            <div class="empty-state" data-testid="empty-gastos">
                <span class="material-icons-round">savings</span>
                Sin gastos registrados.
            </div>`;
        return;
    }

    listaEl.innerHTML = gastos.map(g => {
        const veces = (g.movimientos && g.movimientos.length) || 1;
        const badgeVeces = veces > 1
            ? `<span class="gasto-veces" data-testid="veces-${g.id}">${veces}× agregado</span>`
            : '';
        return `
        <div class="gasto-card" data-testid="gasto-card-${g.id}">
            <div class="product-info">
                <span class="product-name">${esc(g.nombre)}</span>
                <span class="gasto-fecha">Última: ${esc(g.fecha || '')}</span>
                ${badgeVeces}
            </div>
            <span class="gasto-monto" data-testid="gasto-monto-${g.id}">${fmtMoney(g.costo)}</span>
            <button class="icon-btn danger" onclick="eliminarGasto(${g.id})" title="Eliminar" data-testid="btn-eliminar-gasto-${g.id}">
                <span class="material-icons-round">delete</span>
            </button>
        </div>`;
    }).join('');
}

function agregarGasto() {
    if (rolActual !== 'admin') return alert("Solo administrador puede registrar gastos e inversiones.");

    const nombreInp = document.getElementById('gasto-nombre');
    const costoInp = document.getElementById('gasto-costo');
    const nombreRaw = (nombreInp.value || '').trim();
    const costo = parseFloat(costoInp.value);

    if (!nombreRaw || isNaN(costo) || costo <= 0) return alert("Ingresa nombre y costo válido.");

    const ahora = new Date().toLocaleDateString('es-CO') + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    // Normalizar: minúsculas + collapse whitespace para detectar duplicados
    const nombreKey = nombreRaw.toLowerCase().replace(/\s+/g, ' ').trim();

    // Buscar si ya existe un gasto con el mismo nombre normalizado
    const existente = gastos.find(g => {
        const k = (g.nombre || '').toLowerCase().replace(/\s+/g, ' ').trim();
        return k === nombreKey;
    });

    if (existente) {
        // MERGE: sumar costo, actualizar fecha, guardar movimiento
        const previo = parseFloat(existente.costo) || 0;
        existente.costo = previo + costo;
        existente.fecha = ahora;
        if (!Array.isArray(existente.movimientos)) {
            existente.movimientos = [{ fecha: existente.fechaCreacion || ahora, costo: previo }];
        }
        existente.movimientos.push({ fecha: ahora, costo });
        mostrarToast(`✔ Sumado a "${existente.nombre}": +${fmtMoney(costo)} = ${fmtMoney(existente.costo)}`, 'éxito', 4000);
    } else {
        gastos.push({
            id: Date.now(),
            nombre: nombreRaw,
            costo,
            fecha: ahora,
            fechaCreacion: ahora,
            movimientos: [{ fecha: ahora, costo }]
        });
        mostrarToast(`✔ Gasto "${nombreRaw}" registrado: ${fmtMoney(costo)}`, 'éxito', 3500);
    }

    guardarEnMemoria();
    actualizarPantalla();
    nombreInp.value = ''; costoInp.value = '';
}

function eliminarGasto(id) {
    const g = gastos.find(x => x.id === id);
    if (!g) return;
    if (!confirm(`¿Eliminar "${g.nombre}" (${fmtMoney(g.costo)})?`)) return;
    gastos = gastos.filter(x => x.id !== id);
    guardarEnMemoria();
    actualizarPantalla();
    mostrarToast(`🗑 Gasto "${g.nombre}" eliminado`, 'info', 2500);
}

// ========================================================
// 📊 GRÁFICO CIRCULAR: DISTRIBUCIÓN DE GASTOS
// ========================================================
function renderChartGastos() {
    const wrap = document.getElementById('chart-gastos-wrap');
    const canvasEl = document.getElementById('chart-gastos-canvas');
    const legendEl = document.getElementById('chart-gastos-legend');
    if (!wrap || !canvasEl) return;

    if (gastos.length < 2 || typeof Chart === 'undefined') {
        wrap.style.display = 'none';
        if (chartGastos) { try { chartGastos.destroy(); } catch (e) {} chartGastos = null; }
        return;
    }

    wrap.style.display = 'block';

    const top = [...gastos]
        .sort((a, b) => (parseFloat(b.costo) || 0) - (parseFloat(a.costo) || 0))
        .slice(0, 6);

    const paleta = ['#EF6C00', '#0288D1', '#00BCD4', '#7CB342', '#8E24AA', '#546E7A'];
    const labels = top.map(g => g.nombre);
    const values = top.map(g => parseFloat(g.costo) || 0);
    const totalTop = values.reduce((a, b) => a + b, 0);

    if (chartGastos) { try { chartGastos.destroy(); } catch (e) {} chartGastos = null; }

    const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

    chartGastos = new Chart(canvasEl, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: paleta.slice(0, values.length),
                borderColor: isDark ? '#1A2129' : '#FFFFFF',
                borderWidth: 2,
                hoverOffset: 6
            }]
        },
        options: {
            responsive: false,
            cutout: '62%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.label}: ${fmtMoney(ctx.parsed)}`
                    }
                }
            },
            animation: { animateRotate: true, duration: 700 }
        }
    });

    if (legendEl) {
        legendEl.innerHTML = top.map((g, i) => {
            const pct = totalTop > 0 ? Math.round((g.costo / totalTop) * 100) : 0;
            return `
                <div class="legend-row">
                    <span class="legend-swatch" style="background:${paleta[i]}"></span>
                    <span class="legend-name">${esc(g.nombre)}</span>
                    <span class="legend-count">${fmtMoney(g.costo)} · ${pct}%</span>
                </div>`;
        }).join('');
    }
}

// ========================================================
// 📲 REPORTE WHATSAPP
// ========================================================
function enviarReporteWhatsApp() {
    if (balance <= 0 && historial.length === 0) {
        return alert("⚠️ No hay ventas registradas hoy para generar un reporte de cierre.");
    }

    let telefonoDueño = localStorage.getItem('zampa_telefono_dueño');
    if (!telefonoDueño) {
        telefonoDueño = prompt("📱 Ingresa el número de WhatsApp del dueño con código de país (Ej: 573001234567):");
        if (!telefonoDueño || telefonoDueño.trim() === "") return;
        telefonoDueño = telefonoDueño.replace(/\D/g, '');
        localStorage.setItem('zampa_telefono_dueño', telefonoDueño);
    }

    let conteoVentas = {};
    historial.forEach(venta => {
        let items = venta.detalle.split(", ");
        items.forEach(item => {
            let partes = item.trim().split(" ");
            let cantidad = parseInt(partes[0]) || 1;
            let nombreProducto = partes.slice(1).join(" ");
            conteoVentas[nombreProducto] = (conteoVentas[nombreProducto] || 0) + cantidad;
        });
    });

    let detalleVentasTexto = "";
    for (let [nombre, cant] of Object.entries(conteoVentas)) {
        detalleVentasTexto += `▪️ *${cant}x* ${nombre}\n`;
    }
    if (detalleVentasTexto === "") detalleVentasTexto = "▪️ Sin detalle individual\n";

    let detalleStockTexto = inventario.map(prod => `▪️ ${prod.nombre}: *${prod.stock} disp.*`).join('\n');

    const ahora = new Date();
    const fechaStr = ahora.toLocaleDateString('es-CO') + " - " + ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let mensaje = `🌙 *REPORTE DE CIERRE - ZAMPA*\n` +
                  `📅 *Fecha:* ${fechaStr}\n` +
                  `👤 *Turno:* ${rolActual === 'admin' ? 'Administrador' : 'Vendedor'}\n\n` +
                  `💰 *DINERO EN CAJA: ${fmtMoney(balance)}*\n\n` +
                  `🔥 *PRODUCTOS VENDIDOS:*\n${detalleVentasTexto}\n` +
                  `📦 *STOCK SOBRANTE:*\n${detalleStockTexto}\n\n` +
                  `🚀 _Generado desde Zampa POS_`;

    const url = `https://api.whatsapp.com/send?phone=${telefonoDueño}&text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
}

// ========================================================
// ⚡ VIBRACIÓN Y TOASTS
// ========================================================
function vibrar(patron = 30) {
    if ("vibrate" in navigator) {
        try { navigator.vibrate(patron); } catch (e) {}
    }
}

function efectoVisualToque(elemento) {
    if (!elemento) return;
    elemento.classList.remove('efecto-toque');
    void elemento.offsetWidth;
    elemento.classList.add('efecto-toque');
}

function mostrarToast(mensaje, tipo = 'info', duracion = 3000) {
    vibrar(tipo === 'error' ? [50, 40, 50] : 25);

    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;

    let icono = 'info';
    if (tipo === 'éxito') icono = 'check_circle';
    if (tipo === 'error') icono = 'error';
    if (tipo === 'alerta') icono = 'warning';

    toast.innerHTML = `<span class="material-icons-round" style="font-size:20px;">${icono}</span><span style="flex:1;">${mensaje}</span>`;
    container.appendChild(toast);

    setTimeout(() => toast.classList.add('mostrar'), 10);
    setTimeout(() => {
        toast.classList.remove('mostrar');
        setTimeout(() => toast.remove(), 300);
    }, duracion);
}

window.alert = function(mensaje) {
    let tipo = 'info';
    let msgMin = String(mensaje).toLowerCase();

    if (msgMin.includes('error') || msgMin.includes('inválido') || msgMin.includes('incorrecto') || msgMin.includes('falta') || msgMin.includes('denegado') || msgMin.includes('no hay')) {
        tipo = 'error';
    } else if (msgMin.includes('éxito') || msgMin.includes('correctamente') || msgMin.includes('activado') || msgMin.includes('cerrada') || msgMin.includes('acumulada') || msgMin.includes('¡')) {
        tipo = 'éxito';
    } else if (msgMin.includes('⚠️') || msgMin.includes('paga')) {
        tipo = 'alerta';
    }

    mostrarToast(mensaje, tipo, 3500);
};

// ========================================================
// 📶 ESTADO OFFLINE
// ========================================================
function actualizarEstadoRed() {
    const indicador = document.getElementById('indicador-offline');
    const iconoNube = document.getElementById('icono-nube');

    if (!navigator.onLine) {
        if (indicador) indicador.style.display = 'inline-flex';
        if (iconoNube) {
            iconoNube.innerText = 'cloud_off';
            iconoNube.className = 'material-icons-round nube-error';
            iconoNube.title = 'Modo Offline: Guardando ventas localmente';
        }
    } else {
        if (indicador) indicador.style.display = 'none';
        if (iconoNube) {
            iconoNube.innerText = 'cloud_done';
            iconoNube.className = 'material-icons-round nube-sincronizada';
            iconoNube.title = 'Conectado a la nube';
        }
        sincronizarColaPendiente();
    }
}

window.addEventListener('online', () => {
    actualizarEstadoRed();
    mostrarToast("¡Internet recuperado! Sincronizando datos...", "éxito", 3000);
});

window.addEventListener('offline', () => {
    actualizarEstadoRed();
    mostrarToast("��️ Sin conexión. Las ventas se guardarán localmente.", "alerta", 4000);
});

document.addEventListener("DOMContentLoaded", actualizarEstadoRed);

function guardarVentaOffline(nuevaVenta) {
    let cola = JSON.parse(localStorage.getItem('zampa_cola_offline')) || [];
    cola.push(nuevaVenta);
    localStorage.setItem('zampa_cola_offline', JSON.stringify(cola));
}

function sincronizarColaPendiente() {
    if (!navigator.onLine) return;

    let cola = JSON.parse(localStorage.getItem('zampa_cola_offline')) || [];
    if (cola.length === 0) return;

    guardarEnMemoria();

    localStorage.removeItem('zampa_cola_offline');
    mostrarToast("✅ Ventas offline sincronizadas con éxito", "éxito", 3000);
}
