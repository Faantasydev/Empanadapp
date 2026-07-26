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
        }, 2500); 
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
let carrito = [];
let nubeLista = false; 

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
        // Solo sobreescribimos si Firebase tiene datos válidos, protegiendo arrays locales
        if (data.inventario && Array.isArray(data.inventario)) inventario = data.inventario;
        if (data.insumos && Array.isArray(data.insumos)) insumos = data.insumos;
        if (data.balance !== undefined) balance = data.balance;
        if (data.historial && Array.isArray(data.historial)) historial = data.historial;
        
        if (data.historicoAcumulado && Array.isArray(data.historicoAcumulado)) {
            historicoAcumulado = data.historicoAcumulado;
            localStorage.setItem('empanadas_historico_general', JSON.stringify(historicoAcumulado));
        }
    }
    
    nubeLista = true;
    actualizarPantalla();
}, (error) => {
    console.error("Error conectando a Firebase en tiempo real:", error);
    nubeLista = true; // Permite operar localmente si Firebase tarda en responder
    actualizarPantalla();
});

// ========================================================
// 🔄 FUNCIONES DE GUARDADO Y PANTALLA UNIFICADAS
// ========================================================
function guardarEnMemoria() {
    localStorage.setItem('empanadas_inventario', JSON.stringify(inventario));
    localStorage.setItem('empanadas_insumos', JSON.stringify(insumos));
    localStorage.setItem('empanadas_balance', balance.toString());
    localStorage.setItem('empanadas_historial', JSON.stringify(historial));
    localStorage.setItem('empanadas_historico_general', JSON.stringify(historicoAcumulado));

    const nube = document.getElementById('icono-nube');
    if (nube) {
        nube.className = "material-icons nube-cargando";
        nube.innerText = "cloud_upload"; 
    }

    if (!nubeLista) return;

    db.ref('empanada_control/').set({
        inventario: inventario,
        insumos: insumos,
        balance: balance,
        historial: historial,
        historicoAcumulado: historicoAcumulado
    }, (error) => {
        if (error) {
            if (nube) {
                nube.className = "material-icons nube-error";
                nube.innerText = "cloud_off";
            }
        } else {
            if (nube) {
                setTimeout(() => {
                    nube.className = "material-icons nube-sincronizada";
                    nube.innerText = "cloud_done";
                }, 500); 
            }
        }
    });
}

function actualizarPantalla() {
    // 1. Aplicar reglas visuales de roles (Admin vs Vendedor Ambulante)
    aplicarPermisosRol();

    const elemBalance = document.getElementById('balance-total');
    if (elemBalance) elemBalance.innerHTML = `$${balance.toLocaleString('es-CO')}`;
    
    let dineroDiasAnteriores = 0;
    if (Array.isArray(historicoAcumulado)) {
        dineroDiasAnteriores = historicoAcumulado.reduce((sum, dia) => sum + (parseFloat(dia.balanceFinal) || 0), 0);
    }
    let saldoGranTotal = dineroDiasAnteriores + balance;
    
    const divGranTotal = document.getElementById('saldo-gran-total');
    if (divGranTotal) {
        divGranTotal.innerHTML = `Acumulado Total: <span style="text-decoration: underline; cursor: pointer; color: #ffeb3b;" onclick="editarAcumuladoTotal(event)">$${saldoGranTotal.toLocaleString('es-CO')}</span>`;
    }

    const divVentas = document.getElementById('lista-ventas-disponibles');
    if (divVentas) {
        divVentas.innerHTML = inventario.length === 0 ? '<p style="color:#757575;">No hay productos en inventario</p>' : '';
        inventario.forEach(prod => {
            divVentas.innerHTML += `
                <div class="item-fila">
                    <div class="item-info">
                        <div class="nombre">${prod.nombre}</div>
                        <div class="meta">${prod.precio.toLocaleString()} | Stock: ${prod.stock}</div>
                    </div>
                    <button class="btn-material btn-venta" onclick="agregarAlCarrito(${prod.id})">Agregar</button>
                </div>`;
        });
    }

    const divCarrito = document.getElementById('seccion-carrito');
    const divListaCarrito = document.getElementById('lista-carrito');
    
    if (divCarrito && divListaCarrito) {
        if (carrito.length > 0) {
            divCarrito.style.display = 'block';
            divListaCarrito.innerHTML = carrito.map(p => `
                <div style="display:flex; justify-content:space-between; font-size:14px; margin-bottom:4px;">
                    <span>• 1x ${p.nombre}</span>
                    <span style="font-weight:bold; margin-left:auto;">${p.precio.toLocaleString()}</span>
                </div>
            `).join('');
            
            let totalCarrito = carrito.reduce((sum, p) => sum + p.precio, 0);
            const totalCarritoElem = document.getElementById('total-carrito');
            if (totalCarritoElem) totalCarritoElem.innerText = '$' + totalCarrito.toLocaleString();
        } else {
            divCarrito.style.display = 'none';
        }
    }

    const divRecetaSelec = document.getElementById('receta-insumos-seleccion');
    if (divRecetaSelec) {
        if (insumos.length === 0) {
            divRecetaSelec.innerHTML = '<p style="font-size: 12px; color:#757575;">Registra tus insumos primero en la pestaña "Insumos".</p>';
        } else {
            divRecetaSelec.innerHTML = '<p style="font-size: 11px; font-weight:bold; margin-bottom:5px; color:#555;">¿Qué gasta 1 sola empanada?:</p>';
            insumos.forEach(ins => {
                divRecetaSelec.innerHTML += `
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:5px; font-size:13px;">
                        <input type="checkbox" id="check-insumo-${ins.id}">
                        <span style="flex:1;">${ins.nombre}</span>
                        <input type="number" id="cant-insumo-${ins.id}" placeholder="¿Cuánto?" style="width:90px; padding:4px; border:1px solid #ccc; border-radius:4px; font-size:12px;">
                    </div>`;
            });
        }
    }

    const divInventario = document.getElementById('lista-inventario-completo');
    if(divInventario) {
        divInventario.innerHTML = '';
        inventario.forEach(prod => {
            const costo = prod.costoProduccion || 0;
            const ganancia = prod.ganancia || prod.precio;
            const porcentaje = prod.precio > 0 ? ((ganancia / prod.precio) * 100).toFixed(0) : 0;
            divInventario.innerHTML += `
                <div class="item-fila" style="background: #fafafa; margin-bottom: 12px; padding: 12px; border-radius: 8px; border: 1px solid #e0e0e0;">
                    <div style="margin-bottom: 8px;">
                        <span style="font-weight: bold; font-size: 15px; color: #0288d1; display: block; margin-bottom: 4px;">${prod.nombre}</span>
                        <span style="font-size: 14px; font-weight: bold; color: #333; display: flex; align-items: center; gap: 6px;">
                            Stock: ${prod.stock}
                            <span class="material-icons" style="font-size: 18px; cursor: pointer; color: #4caf50; vertical-align: middle;" onclick="editarStockProducto(${prod.id})">edit</span>
                        </span>
                    </div>
                    <div style="display: flex; justify-content: flex-end;">
                        <button class="btn-material btn-eliminar" style="padding: 4px 10px; font-size: 12px; border-radius: 4px;" onclick="eliminarProducto(${prod.id})">Eliminar</button>
                    </div>
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:5px; margin-top:5px; font-size:12px; background:#fff; padding:6px; border-radius:4px; border:1px solid #e1f5fe;">
                    <div>Costo un.: <strong style="color:#c62828;">$${costo.toFixed(0)}</strong></div>
                    <div>Precio Venta: <strong>$${prod.precio}</strong></div>
                    <div style="grid-column: span 2; border-top:1px solid #eee; padding-top:4px;">
                        Ganancia Limpia: <strong style="color:#2e7d32;">$${ganancia.toFixed(0)} (${porcentaje}%)</strong>
                    </div>
                </div>`;
        });
    }

    const divHistorial = document.getElementById('historial-lista');
    if(divHistorial) {
        divHistorial.innerHTML = historial.length === 0 ? '<p style="color:#757575; font-size:13px;">No hay ventas hoy.</p>' : '';
        historial.forEach((factura, index) => {
            divHistorial.innerHTML += `
                <div class="factura-item" style="display: flex; justify-content: space-between; align-items: center;">
                    <div><strong> ${factura.detalle}</strong><div style="font-size: 11px; color: #757575;">${factura.hora}</div></div>
                    <div><span style="font-weight: bold; color: #2e7d32; margin-right:10px;">$${factura.total.toLocaleString('es-CO')}</span>
                    <button class="btn-deshacer" onclick="deshacerVenta(${index})"><span class="material-icons" style="font-size:20px;">delete_forever</span></button></div>
                </div>`;
        });
    }

    const divInsumosLista = document.getElementById('lista-insumos-completa');
    if(divInsumosLista) {
        divInsumosLista.innerHTML = '';
        insumos.forEach(ins => {
            divInsumosLista.innerHTML += `
                <div class="item-fila" style="font-size:13px;">
                    <div><strong>${ins.nombre}</strong><div style="font-size:11px; color:#757575;">Costo unitario: $${ins.costoUnitario.toFixed(2)}</div></div>
                    <button class="btn-material btn-eliminar" onclick="eliminarInsumo(${ins.id})"><span class="material-icons">delete</span></button>
                </div>`;
        });
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
        id: Date.now(), nombre: nombre, costoTotal: costo, cantidadTotal: cantidad, costoUnitario: costo / cantidad
    });
    guardarEnMemoria(); 
    actualizarPantalla();
    nombreInp.value = ''; costoInp.value = ''; cantInp.value = '';
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
        id: Date.now(), nombre: nombre, precio: precio, stock: stock,
        costoProduccion: costoProduccionUnidad, ganancia: precio - costoProduccionUnidad, receta: recetaGuardada
    });

    guardarEnMemoria(); 
    actualizarPantalla();
    nombreInput.value = ''; precioInput.value = ''; stockInput.value = '';
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
// 💰 VENTAS, CARRITO Y VUELTOS (BLINDADAS OFFLINE)
// ========================================================
let totalVentaActual = 0;
let callbackConfirmarVenta = null;

function abrirCalculadoraVueltos(total, callbackExito) {
    totalVentaActual = total; 
    callbackConfirmarVenta = callbackExito;
    document.getElementById('vueltos-total-venta').innerText = '$' + total.toLocaleString();
    document.getElementById('vueltos-paga-con').value = '';
    document.getElementById('vueltos-resultado').innerText = '$0';
    document.getElementById('vueltos-resultado').style.color = '#2e7d32';
    document.getElementById('btn-confirmar-venta').disabled = true;
    document.getElementById('modal-vueltos').style.display = 'flex';
}

function calcularCambio() {
    const pagaCon = parseFloat(document.getElementById('vueltos-paga-con').value) || 0;
    const vueltos = pagaCon - totalVentaActual;
    const contenedorResultado = document.getElementById('vueltos-resultado');
    const btnConfirmar = document.getElementById('btn-confirmar-venta');

    if (pagaCon === 0) {
        contenedorResultado.innerText = '$0'; contenedorResultado.style.color = '#2e7d32'; btnConfirmar.disabled = true;
    } else if (vueltos < 0) {
        contenedorResultado.innerText = 'Falta dinero: -$' + Math.abs(vueltos).toLocaleString(); contenedorResultado.style.color = '#c62828'; btnConfirmar.disabled = true;
    } else {
        contenedorResultado.innerText = '$' + vueltos.toLocaleString(); contenedorResultado.style.color = '#2e7d32'; btnConfirmar.removeAttribute('disabled');
    }
}

function definirPagoRapido(valor) { document.getElementById('vueltos-paga-con').value = valor; calcularCambio(); }
function definirPagoExacto() { document.getElementById('vueltos-paga-con').value = totalVentaActual; calcularCambio(); }
function cerrarModalVueltos() { document.getElementById('modal-vueltos').style.display = 'none'; }
function finalizarVentaConVueltos() { cerrarModalVueltos(); if (typeof callbackConfirmarVenta === 'function') callbackConfirmarVenta(); }

function agregarAlCarrito(id) {
    vibrar(30); 
    efectoVisualToque(event?.target); 

    const producto = inventario.find(p => p.id === id);
    if (!producto) return;
    const enCarritoActual = carrito.filter(p => p.id === id).length;
    if (enCarritoActual >= producto.stock) return alert("¡No hay más stock disponible!");
    carrito.push(producto); 
    guardarEnMemoria(); 
    actualizarPantalla();
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
        mostrarToast("📴 Venta guardada localmente (Sin red). Se sincronizará al volver la señal.", "alerta", 4000);
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
    
    divLista.innerHTML = '';
    if (historicoAcumulado.length === 0) {
        divLista.innerHTML = '<p style="text-align:center; color:#777; font-size:14px; margin:20px 0;">No hay cierres de caja registrados.</p>';
    } else {
        historicoAcumulado.forEach((cierre) => {
            divLista.innerHTML += `
                <div style="display: flex; justify-content: space-between; align-items: center; background: #f9f9f9; padding: 10px 12px; border-radius: 8px; border-left: 4px solid #4caf50;">
                    <span style="font-size: 14px; color: #333; font-weight: 500;"><span class="material-icons" style="font-size: 14px; vertical-align: middle; margin-right: 4px; color: #777;">calendar_today</span>${cierre.fecha || "Ajuste"}</span>
                    <strong style="font-size: 15px; color: #2e7d32;">$${parseInt(cierre.balanceFinal || 0).toLocaleString()}</strong>
                </div>`;
        });
    }
    divModal.style.display = 'flex';
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
            id: Date.now(), fecha: fecha, balanceFinal: balance, ventasDetalle: [...historial]
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
// 🔐 GESTIÓN DE ROLES Y SEGURIDAD (MODO VENDEDOR / ADMIN)
// ========================================================
const PIN_ADMIN = "1234"; 
let rolActual = localStorage.getItem('zampa_rol') || 'vendedor'; 

function aplicarPermisosRol() {
    const esAdmin = (rolActual === 'admin');
    const iconoRol = document.getElementById('icono-rol');
    
    if (iconoRol) {
        iconoRol.innerText = esAdmin ? 'admin_panel_settings' : 'badge';
        iconoRol.style.color = esAdmin ? '#ffeb3b' : '#ffffff';
        iconoRol.title = esAdmin ? 'Modo Administrador (Toca para cambiar)' : 'Modo Vendedor (Toca para entrar con PIN)';
    }

    const btnInventario = document.getElementById('dock-inventario');
    const btnInsumos = document.getElementById('dock-insumos');
    if (btnInventario) btnInventario.style.display = esAdmin ? 'flex' : 'none';
    if (btnInsumos) btnInsumos.style.display = esAdmin ? 'flex' : 'none';

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
        const pinIngresado = prompt("🔐 Ingresa el PIN de Administrador (4 dígitos):");
        if (pinIngresado === PIN_ADMIN) {
            rolActual = 'admin';
            localStorage.setItem('zampa_rol', 'admin');
            aplicarPermisosRol();
            actualizarPantalla();
            alert("🔓 ¡Modo Administrador activado! Ahora tienes acceso al inventario y costos.");
        } else if (pinIngresado !== null) {
            alert("❌ PIN incorrecto. Acceso denegado.");
        }
    } else {
        if (confirm("¿Deseas bloquear la app y volver al Modo Vendedor (Ambulante)?")) {
            rolActual = 'vendedor';
            localStorage.setItem('zampa_rol', 'vendedor');
            aplicarPermisosRol();
            actualizarPantalla();
            alert("🔒 Modo Vendedor activado. Pestañas sensibles ocultas.");
        }
    }
}

// ========================================================
// 📲 REPORTE INTELIGENTE POR WHATSAPP (CIERRE DE TURNO)
// ========================================================
function enviarReporteWhatsApp() {
    if (balance <= 0 && historial.length === 0) {
        return alert("⚠️ No hay ventas registradas hoy para generar un reporte de cierre.");
    }

    let telefonoDueño = localStorage.getItem('zampa_telefono_dueño');
    if (!telefonoDueño) {
        telefonoDueño = prompt("📱 Ingresa el número de WhatsApp del dueño con código de país (Ej: 573001234567 para Colombia):");
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

    let mensaje = `🌙 *REPORTE DE CIERRE - ZAMPA* 🥟\n` +
                  `📅 *Fecha:* ${fechaStr}\n` +
                  `👤 *Turno:* ${rolActual === 'admin' ? 'Administrador' : 'Vendedor Ambulante'}\n\n` +
                  `💰 *DINERO EN CAJA: $${balance.toLocaleString('es-CO')}*\n\n` +
                  `🔥 *PRODUCTOS VENDIDOS:*\n${detalleVentasTexto}\n` +
                  `📦 *STOCK SOBRANTE (EN CAVA):*\n${detalleStockTexto}\n\n` +
                  `🚀 _Generado desde Zampa POS_`;

    const url = `https://api.whatsapp.com/send?phone=${telefonoDueño}&text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
}

// ========================================================
// ⚡ MOTOR DE VIBRACIÓN Y TOASTS FLOTANTES (UX CALLE)
// ========================================================
function vibrar(patron = 35) {
    if ("vibrate" in navigator) {
        try {
            navigator.vibrate(patron); 
        } catch (e) {}
    }
}

function efectoVisualToque(elemento) {
    if (!elemento) return;
    elemento.classList.remove('efecto-toque');
    void elemento.offsetWidth; 
    elemento.classList.add('efecto-toque');
}

function mostrarToast(mensaje, tipo = 'info', duracion = 3000) {
    vibrar(tipo === 'error' ? [50, 40, 50] : 35);

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

    toast.innerHTML = `<span class="material-icons" style="font-size:22px;">${icono}</span> <span style="flex:1;">${mensaje}</span>`;
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
    } else if (msgMin.includes('éxito') || msgMin.includes('correctamente') || msgMin.includes('activado') || msgMin.includes('cerrada') || msgMin.includes('acumulada')) {
        tipo = 'éxito';
    } else if (msgMin.includes('⚠️') || msgMin.includes('paga')) {
        tipo = 'alerta';
    }
    
    mostrarToast(mensaje, tipo, 3500);
};

// ========================================================
// 📶 MOTOR OFFLINE Y COLA DE SINCRONIZACIÓN AUTOMÁTICA
// ========================================================
function actualizarEstadoRed() {
    const indicador = document.getElementById('indicador-offline');
    const iconoNube = document.getElementById('icono-nube');
    
    if (!navigator.onLine) {
        if (indicador) indicador.style.display = 'flex';
        if (iconoNube) {
            iconoNube.innerText = 'cloud_off';
            iconoNube.style.color = '#ff9800';
            iconoNube.title = 'Modo Offline: Guardando ventas localmente';
        }
    } else {
        if (indicador) indicador.style.display = 'none';
        if (iconoNube) {
            iconoNube.innerText = 'cloud';
            iconoNube.style.color = '#4caf50';
            iconoNube.title = 'Conectado a la nube (Firebase)';
        }
        sincronizarColaPendiente();
    }
}

window.addEventListener('online', () => {
    actualizarEstadoRed();
    mostrarToast("¡Internet recuperado! Sincronizando datos con Firebase...", "éxito", 3000);
});

window.addEventListener('offline', () => {
    actualizarEstadoRed();
    mostrarToast("⚠️ Sin conexión a internet. Las ventas se guardarán localmente.", "alerta", 4000);
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
    mostrarToast("✅ ¡Ventas offline sincronizadas con éxito en la nube!", "éxito", 3000);
}
