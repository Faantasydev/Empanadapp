// ========================================================
// 🎬 ANIMACIÓN DE INICIO (SPLASH SCREEN)
// ========================================================
document.addEventListener("DOMContentLoaded", () => {
    const splashScreen = document.getElementById("splash-screen");

    // Revisamos si ya se reprodujo la animación en esta sesión
    if (sessionStorage.getItem("zampa_animado")) {
        if (splashScreen) splashScreen.style.display = "none";
    } else {
        // Marcamos que ya se vio y la ocultamos tras 2.5 segundos
        sessionStorage.setItem("zampa_animado", "true");
        
        setTimeout(() => {
            if (splashScreen) {
                splashScreen.classList.add("ocultar-splash");
                setTimeout(() => splashScreen.remove(), 500); // Se borra para no estorbar
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

// Inicializar la conexión
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
let nubeLista = false; // Candado de seguridad

actualizarPantalla();


// ========================================================
// ☁️ SINCRONIZACIÓN EN TIEMPO REAL CON FIREBASE
// ========================================================
db.ref('empanada_control/').on('value', (snapshot) => {
    const data = snapshot.val();
    
    if (data) {
        inventario = data.inventario || [];
        insumos = data.insumos || [];
        balance = data.balance !== undefined ? data.balance : 0;
        historial = data.historial || [];
        
        if (data.historicoAcumulado && Array.isArray(data.historicoAcumulado)) {
            historicoAcumulado = data.historicoAcumulado;
            localStorage.setItem('empanadas_historico_general', JSON.stringify(historicoAcumulado));
        }
    }
    
    nubeLista = true;
    actualizarPantalla();
}, (error) => {
    console.error("Error conectando a Firebase en tiempo real:", error);
});



// ========================================================
// 🔄 FUNCIONES DE GUARDADO Y PANTALLA
// ========================================================
function guardarEnMemoria() {
    if (!nubeLista) return;

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
    document.getElementById('balance-total').innerHTML = `$${balance.toLocaleString('es-CO')}`;
    
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

    const divCarrito = document.getElementById('seccion-carrito');
    const divListaCarrito = document.getElementById('lista-carrito');
    
    if (carrito.length > 0) {
        divCarrito.style.display = 'block';
        divListaCarrito.innerHTML = carrito.map(p => `
            <div style="display:flex; justify-content:space-between; font-size:14px; margin-bottom:4px;">
                <span>• 1x ${p.nombre}</span>
                <span style="font-weight:bold; margin-left:auto;">${p.precio.toLocaleString()}</span>
            </div>
        `).join('');
        
        let totalCarrito = carrito.reduce((sum, p) => sum + p.precio, 0);
        document.getElementById('total-carrito').innerText = '$' + totalCarrito.toLocaleString();
    } else {
        divCarrito.style.display = 'none';
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
            const porcentaje = ((ganancia / prod.precio) * 100).toFixed(0);
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
    guardarEnMemoria(); actualizarPantalla();
    nombreInp.value = ''; costoInp.value = ''; cantInp.value = '';
}

function eliminarInsumo(id) {
    if (confirm("¿Eliminar este insumo?")) {
        insumos = insumos.filter(i => i.id !== id);
        guardarEnMemoria(); actualizarPantalla();
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

    guardarEnMemoria(); actualizarPantalla();
    nombreInput.value = ''; precioInput.value = ''; stockInput.value = '';
}

function eliminarProducto(id) {
    if (confirm("¿Eliminar producto?")) {
        inventario = inventario.filter(p => p.id !== id);
        guardarEnMemoria(); actualizarPantalla();
    }
}

function editarStockProducto(id) {
    const producto = inventario.find(p => p.id === id);
    if (!producto) return;
    const nuevoStockStr = prompt(`Editar stock para "${producto.nombre}":`, producto.stock);
    if (nuevoStockStr !== null) {
        const nuevoStock = parseInt(nuevoStockStr);
        if (!isNaN(nuevoStock) && nuevoStock >= 0) {
            producto.stock = nuevoStock; guardarEnMemoria(); actualizarPantalla();
        } else { alert("Número inválido."); }
    }
}

// ========================================================
// 💰 VENTAS, CARRITO Y VUELTOS
// ========================================================
let totalVentaActual = 0;
let callbackConfirmarVenta = null;

function abrirCalculadoraVueltos(total, callbackExito) {
    totalVentaActual = total; callbackConfirmarVenta = callbackExito;
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
    const producto = inventario.find(p => p.id === id);
    if (!producto) return;
    const enCarritoActual = carrito.filter(p => p.id === id).length;
    if (enCarritoActual >= producto.stock) return alert("¡No hay más stock disponible!");
    carrito.push(producto); guardarEnMemoria(); actualizarPantalla();
}

function limpiarCarrito() { carrito = []; guardarEnMemoria(); actualizarPantalla(); }

function venderUno(id) {
    const producto = inventario.find(p => p.id === id);
    if (!producto || producto.stock <= 0) return;

    abrirCalculadoraVueltos(producto.precio, function() {
        producto.stock -= 1;
        balance += producto.precio;
        const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const ventaExistente = historial.find(h => h.hora === hora);
        if (ventaExistente) {
            ventaExistente.total += producto.precio;
            ventaExistente.detalle = ventaExistente.detalle.replace(/\+/g, ',');
            let items = ventaExistente.detalle.split(", ");
            let encontrados = false;
            for(let i = 0; i < items.length; i++) {
                if(items[i].includes(producto.nombre)) {
                    let partes = items[i].split(" ");
                    items[i] = (parseInt(partes[0]) + 1) + " " + producto.nombre;
                    encontrados = true; break;
                }
            }
            if(!encontrados) items.push("1 " + producto.nombre);
            ventaExistente.detalle = items.join(", ");
        } else {
            historial.unshift({ productoId: producto.id, detalle: "1 " + producto.nombre, total: producto.precio, hora: hora });
        }
        guardarEnMemoria(); actualizarPantalla();
    });
}

function cobrarVenta() {
    if (carrito.length === 0) return;
    let total = carrito.reduce((sum, p) => sum + p.precio, 0);
    abrirCalculadoraVueltos(total, function() {
        const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        carrito.forEach(itemCarrito => {
            const prodInventario = inventario.find(p => p.id === itemCarrito.id);
            if (prodInventario) prodInventario.stock -= 1;
        });
        const detalleCombo = obtenerResumenCarrito(carrito);
        balance += total;
        historial.unshift({ productoId: 'combo_venta', detalle: detalleCombo, total: total, hora: hora });
        carrito = []; guardarEnMemoria(); actualizarPantalla();
    });
}

function deshacerVenta(index) {
    const venta = historial[index];
    balance -= venta.total;
    if (balance < 0) balance = 0;

    let items = venta.detalle.split(", ");
    items.forEach(item => {
        let nombreProducto = item.substring(item.indexOf(' ') + 1);
        const producto = inventario.find(p => p.nombre === nombreProducto);
        if (producto) producto.stock += parseInt(item.split(" ")[0]);
    });
    historial.splice(index, 1);
    guardarEnMemoria(); actualizarPantalla();
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
    if (!nubeLista) return;

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
