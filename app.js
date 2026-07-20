// CONFIGURACIÓN DE FIREBASE EN LA NUBE
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


// Cargar datos existentes o iniciar vacíos
let inventario = JSON.parse(localStorage.getItem('empanadas_inventario')) || [];
let insumos = JSON.parse(localStorage.getItem('empanadas_insumos')) || [];
let deudores = JSON.parse(localStorage.getItem('empanadas_deudores')) || [];
let balance = parseFloat(localStorage.getItem('empanadas_balance')) || 0;
let historial = JSON.parse(localStorage.getItem('empanadas_historial')) || [];
let carrito = [];

// --- CONTROL DE NUEVO DÍA AUTOMÁTICO ---
const hoy = new Date().toLocaleDateString('es-CO'); // Obtiene la fecha de hoy
let ultimaFechaControl = localStorage.getItem('empanadas_fecha_control');

// Si no hay fecha registrada (primera vez) la guarda
if (!ultimaFechaControl) {
    localStorage.setItem('empanadas_fecha_control', hoy);
} 
// Si la fecha guardada es diferente a la de hoy, significa que cambió el día
else if (ultimaFechaControl !== hoy) {
    // 1. Cargamos el acumulado histórico general para no perder nada
    let historicoAcumulado = JSON.parse(localStorage.getItem('empanadas_historico_general')) || [];
    
    // 2. Pasamos las ventas de ayer al baúl del historial general
    historicoAcumulado.push({
        fecha: ultimaFechaControl,
        balanceFinal: balance,
        ventasDetalle: historial
    });
    
    // 3. Guardamos el baúl histórico permanentemente en la memoria
    localStorage.setItem('empanadas_historico_general', JSON.stringify(historicoAcumulado));
    
    // 4. ¡REINICIO TOTAL PARA EL NUEVO DÍA!
    balance = 0;
    historial = [];
    
    // 5. Actualizamos la memoria con el balance en 0 y el historial limpio
    localStorage.setItem('empanadas_balance', balance);
    localStorage.setItem('empanadas_historial', JSON.stringify(historial));
    localStorage.setItem('empanadas_fecha_control', hoy);
}


actualizarPantalla();

// 🔥 NUEVA FUNCIÓN: AJUSTAR EL BALANCE DESDE LA LIBRETA
function ajustarBalanceManual() {
    const nuevoSaldo = prompt("Escribe el saldo acumulado actual de tu libreta (Ej: 45000):", balance);
    if (nuevoSaldo !== null && !isNaN(parseFloat(nuevoSaldo))) {
        balance = parseFloat(nuevoSaldo);
        guardarEnMemoria();
        actualizarPantalla();
    }
}

// 🔥 NUEVA FUNCIÓN: CONTROL DE FIADOS (DEUDORES)
function agregarDeuda() {
    const clienteInp = document.getElementById('deuda-cliente');
    const montoInp = document.getElementById('deuda-monto');

    const nombre = clienteInp.value.trim();
    const monto = parseFloat(montoInp.value);

    if (!nombre || isNaN(monto) || monto <= 0) {
        alert("Escribe el nombre del cliente y cuánto te debe.");
        return;
    }

    deudores.push({
        id: Date.now(),
        nombre: nombre,
        monto: monto
    });

    guardarEnMemoria();
    actualizarPantalla();

    clienteInp.value = '';
    montoInp.value = '';
}

function pagarDeuda(id) {
    const deudorIndex = deudores.findIndex(d => d.id === id);
    if (deudorIndex === -1) return;

    const deudor = deudores[deudorIndex];
    if (confirm(`¿Confirmas que ${deudor.nombre} pagó la deuda completa de $${deudor.monto}? (Este dinero se sumará a tu balance actual)`)) {
        balance += deudor.monto; // Sumar el dinero recuperado a la caja
        deudores.splice(deudorIndex, 1); // Quitarlo de la lista negra
        
        guardarEnMemoria();
        actualizarPantalla();
    }
}

// LÓGICA DE INSUMOS
function agregarInsumo() {
    const nombreInp = document.getElementById('insumo-nombre');
    const costoInp = document.getElementById('insumo-costo');
    const cantInp = document.getElementById('insumo-cantidad');

    const nombre = nombreInp.value.trim();
    const costo = parseFloat(costoInp.value);
    const cantidad = parseFloat(cantInp.value);

    if (!nombre || isNaN(costo) || isNaN(cantidad) || cantidad <= 0) {
        alert("Rellena los datos del insumo correctamente.");
        return;
    }

    insumos.push({
        id: Date.now(),
        nombre: nombre,
        costoTotal: costo,
        cantidadTotal: cantidad,
        costoUnitario: costo / cantidad
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

// LÓGICA DE PRODUCTOS
function agregarProducto() {
    const nombreInput = document.getElementById('nuevo-nombre');
    const precioInput = document.getElementById('nuevo-precio');
    const stockInput = document.getElementById('nuevo-stock');

    const nombre = nombreInput.value.trim();
    const precio = parseFloat(precioInput.value);
    const stock = parseInt(stockInput.value);

    if (!nombre || isNaN(precio) || isNaN(stock)) {
        alert("Por favor rellena todos los campos.");
        return;
    }

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
        id: Date.now(), 
        nombre: nombre,
        precio: precio,
        stock: stock,
        costoProduccion: costoProduccionUnidad,
        ganancia: precio - costoProduccionUnidad,
        receta: recetaGuardada
    });

    guardarEnMemoria();
    actualizarPantalla();
    nombreInput.value = ''; precioInput.value = ''; stockInput.value = '';
}

function venderUno(id) {
    const producto = inventario.find(p => p.id === id);
    if (!producto || producto.stock <= 0) return;

    // 🔥 AQUÍ ENGANCHAMOS LA CALCULADORA ANTES DE GUARDAR
    abrirCalculadoraVueltos(producto.precio, function() {
        producto.stock -= 1;
        balance += producto.precio;

        const ahora = new Date();
        const hora = ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
 // BUSCAMOS SI YA HICIMOS UNA VENTA EN ESTE MISMO MINUTO
const ventaExistente = historial.find(h => h.hora === hora);
if (ventaExistente) {
        ventaExistente.total += producto.precio;
    // Limpiamos formatos viejos con "+" y separamos por coma
    ventaExistente.detalle = ventaExistente.detalle.replace(/\+/g, ',');
    let items = ventaExistente.detalle.split(", ");
    let encontrados = false;

    for(let i = 0; i < items.length; i++) {
        if(items[i].includes(producto.nombre)) {
            let partes = items[i].split(" ");
            let cantidad = parseInt(partes[0]) + 1;
            items[i] = cantidad + " " + producto.nombre;
            encontrados = true;
            break;
        }
    }
    if(!encontrados) {
        items.push("1 " + producto.nombre);
    }
    ventaExistente.detalle = items.join(", ").replace(/\+/g, ',');

} else {
    // Si es una venta nueva, creamos el registro inicial con formato de cantidad
    historial.unshift({
        productoId: producto.id,
        detalle: "1 " + producto.nombre,
        total: producto.precio,
        hora: hora
    });
}




        guardarEnMemoria();
        actualizarPantalla();
    });
}


function deshacerVenta(index) {
    const venta = historial[index];
    balance -= venta.total;
    if (balance < 0) balance = 0;

    // AHORA: Limpiamos el detalle para obtener los nombres correctamente
    // Separamos por comas y quitamos el número inicial (ej: "2 Carne" -> "Carne")
    let items = venta.detalle.split(", ");
    
    items.forEach(item => {
        // Extraemos solo el nombre después del número
        let nombreProducto = item.substring(item.indexOf(' ') + 1);
        
        // Buscamos el producto en el inventario por su nombre
        const producto = inventario.find(p => p.nombre === nombreProducto);
        
        if (producto) {
            producto.stock += parseInt(item.split(" ")[0]); // Sumamos la cantidad exacta
        }
    });

    historial.splice(index, 1);
    guardarEnMemoria();
    actualizarPantalla();
}


function eliminarProducto(id) {
    if (confirm("¿Eliminar producto?")) {
        inventario = inventario.filter(p => p.id !== id);
        guardarEnMemoria();
        actualizarPantalla();
    }
}

function guardarEnMemoria() {
    // 1. Guardar copia local en el teléfono
    localStorage.setItem('empanadas_inventario', JSON.stringify(inventario));
    localStorage.setItem('empanadas_insumos', JSON.stringify(insumos));
    localStorage.setItem('empanadas_deudores', JSON.stringify(deudores));
    localStorage.setItem('empanadas_balance', balance.toString());
    localStorage.setItem('empanadas_historial', JSON.stringify(historial));

    // Obtener el elemento de la nube
    const nube = document.getElementById('icono-nube');
    
    if (nube) {
        // Ponemos la nube en modo "Cargando" (naranja y parpadeando)
        nube.className = "material-icons nube-cargando";
        nube.innerText = "cloud"; 
    }

    // 2. ¡Sincronizar con la nube y escuchar si se subió bien!
    db.ref('empanada_control/').set({
        inventario: inventario,
        insumos: insumos,
        deudores: deudores,
        balance: balance,
        historial: historial
    }, (error) => {
        if (error) {
            // SI FALLÓ: Ponemos la nube roja y usamos el icono de nube tachada
            if (nube) {
                nube.className = "material-icons nube-error";
                nube.innerText = "cloud_off";
            }
        } else {
            // SI TODO SALIÓ BIEN: Volvemos a la nube normal verde/azul
            if (nube) {
                setTimeout(() => {
                    nube.className = "material-icons nube-sincronizada";
                    nube.innerText = "cloud";
                }, 500); 
            }
        }
    });
}



function actualizarPantalla() {
    // 1. Renderizar Balance Diario y Saldo Total Acumulado
    document.getElementById('balance-total').innerHTML = `$${balance.toLocaleString()}`;
    
    // Calcular el dinero de los días pasados guardados en la caja fuerte
    let historicoAcumulado = JSON.parse(localStorage.getItem('empanadas_historico_general')) || [];
    let dineroDiasAnteriores = historicoAcumulado.reduce((sum, dia) => sum + (dia.balanceFinal || 0), 0);
    
    // Gran Total = Lo acumulado en días pasados + Lo vendido hoy
    let saldoGranTotal = dineroDiasAnteriores + balance;
    
       // Renderizar el saldo total con la opción de hacer clic para editarlo
    const divGranTotal = document.getElementById('saldo-gran-total');
    if (divGranTotal) {
        divGranTotal.innerHTML = `Acumulado Total: <span style="text-decoration: underline; cursor: pointer; color: #ffeb3b;" onclick="editarAcumuladoTotal()">$${saldoGranTotal.toLocaleString()}</span>`;
    }

    // 2. Ventas Rápidas (Ahora agrega al carrito)
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

    // 2b. NUEVO: Renderizar el Carrito de Compras en tiempo real
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

    // 3. 🔥 Renderizar Lista de Deudores
    const divDeudores = document.getElementById('lista-deudores');
    if(divDeudores) {
        divDeudores.innerHTML = deudores.length === 0 ? '<p style="color:#757575; font-size:13px;">¡Qué bien! Nadie te debe dinero hoy.</p>' : '';
        deudores.forEach(deudor => {
            divDeudores.innerHTML += `
                <div class="item-fila" style="border-bottom: 1px solid #ffeae8; padding: 8px 0;">
                    <div>
                        <strong style="color:#37474f;">${deudor.nombre}</strong>
                        <div style="font-size:12px; color:#c62828; font-weight:bold;">Debe: $${deudor.monto.toLocaleString('es-CO')}</div>
                    </div>
                    <button class="btn-material" style="background-color: #26a69a; padding: 6px 10px; width: auto; font-size:11px;" onclick="pagarDeuda(${deudor.id})">
                        <span class="material-icons" style="font-size:14px;">check_circle</span> Pagó
                    </button>
                </div>`;
        });
    }

    // 4. Formulario de Receta dinámico en Inventario
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

    // 5. Inventario Completo
    const divInventario = document.getElementById('lista-inventario-completo');
    if(divInventario) {
        divInventario.innerHTML = '';
        inventario.forEach(prod => {
            const costo = prod.costoProduccion || 0;
            const ganancia = prod.ganancia || prod.precio;
            const porcentaje = ((ganancia / prod.precio) * 100).toFixed(0);

                                         divInventario.innerHTML += `
                    <div class="item-fila" style="background: #fafafa; margin-bottom: 12px; padding: 12px; border-radius: 8px; border: 1px solid #e0e0e0;">
                                    <!-- Fila Superior: Nombre arriba y Stock abajo para que no se peguen -->
                        <div style="margin-bottom: 8px;">
                            <span style="font-weight: bold; font-size: 15px; color: #0288d1; display: block; margin-bottom: 4px;">${prod.nombre}</span>
                            <span style="font-size: 14px; font-weight: bold; color: #333; display: flex; align-items: center; gap: 6px;">
                                Stock: ${prod.stock}
                                <span class="material-icons" style="font-size: 18px; cursor: pointer; color: #4caf50; vertical-align: middle;" onclick="editarStockProducto(${prod.id})">edit</span>
                            </span>
                        </div>
                        <!-- Fila Inferior: Botón Eliminar -->
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
                    </div>
                </div>`;
        });
    }

    // 6. Historial
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

    // 7. Lista de Insumos base
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
// 🧮 LÓGICA DE LA CALCULADORA DE VUELTOS (AL FINAL DE APP.JS)
// ========================================================
let totalVentaActual = 0;
let callbackConfirmarVenta = null;

// Esta función abre el cuadro flotante
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

// Calcula el cambio en tiempo real
function calcularCambio() {
    const pagaCon = parseFloat(document.getElementById('vueltos-paga-con').value) || 0;
    const vueltos = pagaCon - totalVentaActual;
    const contenedorResultado = document.getElementById('vueltos-resultado');
    const btnConfirmar = document.getElementById('btn-confirmar-venta');

    if (pagaCon === 0) {
        contenedorResultado.innerText = '$0';
        contenedorResultado.style.color = '#2e7d32';
        btnConfirmar.disabled = true;
    } else if (vueltos < 0) {
        contenedorResultado.innerText = 'Falta dinero: -$' + Math.abs(vueltos).toLocaleString();
        contenedorResultado.style.color = '#c62828';
        btnConfirmar.disabled = true;
    } else {
        contenedorResultado.innerText = '$' + vueltos.toLocaleString();
        contenedorResultado.style.color = '#2e7d32';
        btnConfirmar.removeAttribute('disabled');
    }
}

// Funciones de botones rápidos
function definirPagoRapido(valor) {
    document.getElementById('vueltos-paga-con').value = valor;
    calcularCambio();
}

function definirPagoExacto() {
    document.getElementById('vueltos-paga-con').value = totalVentaActual;
    calcularCambio();
}

function cerrarModalVueltos() {
    document.getElementById('modal-vueltos').style.display = 'none';
}

function finalizarVentaConVueltos() {
    cerrarModalVueltos();
    if (typeof callbackConfirmarVenta === 'function') {
        callbackConfirmarVenta();
    }
}
// ========================================================
// 🛒 FUNCIONES DEL CARRITO DE COMPRAS TEMPORAL
// ========================================================
function agregarAlCarrito(id) {
    const producto = inventario.find(p => p.id === id);
    if (!producto) return;

    // Contamos cuántas unidades de este producto ya están metidas en el carrito actual
    const enCarritoActual = carrito.filter(p => p.id === id).length;

    // Verificamos si lo que quieres agregar supera el stock real que tienes
    if (enCarritoActual >= producto.stock) {
        alert("¡No hay más stock disponible de " + producto.nombre + "!");
        return;
    }
    
    carrito.push(producto);
    guardarEnMemoria();
    actualizarPantalla();
}

function limpiarCarrito() {
    carrito = [];
    guardarEnMemoria();
    actualizarPantalla();
}


function cobrarVenta() {
    if (carrito.length === 0) return;

    let total = carrito.reduce((sum, p) => sum + p.precio, 0);

    abrirCalculadoraVueltos(total, function() {
        const ahora = new Date();
        const hora = ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Descontar el stock real de cada producto vendido
        carrito.forEach(itemCarrito => {
            const prodInventario = inventario.find(p => p.id === itemCarrito.id);
            if (prodInventario) {
                prodInventario.stock -= 1;
            }
        });

        const detalleCombo = obtenerResumenCarrito(carrito);

        balance += total;

        historial.unshift({
            productoId: 'combo_venta',
            detalle: detalleCombo,
            total: total,
            hora: hora
        });

        carrito = []; 
        guardarEnMemoria();
        actualizarPantalla();
    });
}


// NUEVA FUNCIÓN: EDITAR EL STOCK DE UN PRODUCTO EXISTENTE
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
        } else {
            alert("Por favor, introduce un número válido y mayor o igual a cero.");
        }
    }
}
// FUNCIÓN CORREGIDA: MUESTRA LA FECHA EXACTA DE CADA CIERRE
function mostrarHistorialCierres() {
    const divModal = document.getElementById('modal-historial-cierres');
    const divLista = document.getElementById('lista-cierres-dia-a-dia');
    
    let historico = [];
    try {
        historico = JSON.parse(localStorage.getItem('empanadas_historial')) || [];
    } catch(e) {
        historico = [];
    }

    divLista.innerHTML = '';

    if (historico.length === 0) {
        divLista.innerHTML = '<p style="text-align:center; color:#777; font-size:14px; margin:20px 0;">No hay cierres de caja registrados aún.</p>';
    } else {
        historico.forEach((cierre, index) => {
            // 1. Intentamos sacar la fecha si el objeto ya la tiene
            let fechaStr = cierre.fecha;

            // 2. Si no tiene fecha guardada en memoria, le calculamos una 
            // basada en el día actual hacia atrás para corregir los anteriores
            if (!fechaStr) {
                const fechaEstimada = new Date();
                fechaEstimada.setDate(fechaEstimada.getDate() - (historico.length - 1 - index));
                fechaStr = fechaEstimada.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
            }
            
            // Detectamos si el cierre viene como objeto o número directo
            const montoStr = typeof cierre === 'object' ? (cierre.total || cierre.balance || cierre.monto || 0) : cierre;

            divLista.innerHTML += `
                <div style="display: flex; justify-content: space-between; align-items: center; background: #f9f9f9; padding: 10px 12px; border-radius: 8px; border-left: 4px solid #4caf50;">
                    <span style="font-size: 14px; color: #333; font-weight: 500;"><span class="material-icons" style="font-size: 14px; vertical-align: middle; margin-right: 4px; color: #777;">calendar_today</span>${fechaStr}</span>
                    <strong style="font-size: 15px; color: #2e7d32;">$${parseInt(montoStr).toLocaleString()}</strong>
                </div>
            `;
        });
    }

    divModal.style.display = 'flex';
}

// ESCUCHAR CAMBIOS DESDE LA NUBE EN TIEMPO REAL
db.ref('empanada_control/').on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
        inventario = data.inventario || [];
        insumos = data.insumos || [];
        deudores = data.deudores || [];
        balance = data.balance || 0;
        historial = data.historial || [];
        
        // Redibujar la pantalla con los nuevos datos recibidos
        actualizarPantalla();
    }
});

function obtenerResumenCarrito(listaProductos) {
    const conteo = {};
    listaProductos.forEach(prod => {
        conteo[prod.nombre] = (conteo[prod.nombre] || 0) + 1;
    });
    // Aquí forzamos que SIEMPRE use comas, nunca el signo "+"
    return Object.entries(conteo)
        .map(([nombre, cant]) => `${cant} ${nombre}`)
        .join(", "); 
}

// 🔥 NUEVA FUNCIÓN: EDITAR EL ACUMULADO TOTAL MANUALMENTE
function editarAcumuladoTotal() {
    // Calculamos el valor actual del acumulado histórico
    let historicoAcumulado = JSON.parse(localStorage.getItem('empanadas_historico_general')) || [];
    let dineroDiasAnteriores = historicoAcumulado.reduce((sum, dia) => sum + (dia.balanceFinal || 0), 0);
    let saldoActualTotal = dineroDiasAnteriores + balance;

    const nuevoValorStr = prompt("Escribe el nuevo valor real para tu Acumulado Total (Ej: 0 o 45000):", saldoActualTotal);
    
    if (nuevoValorStr !== null) {
        const nuevoValor = parseFloat(nuevoValorStr);
        if (!isNaN(nuevoValor) && nuevoValor >= 0) {
            // Para ajustar el total de forma limpia, guardamos la diferencia 
            // metiendo un registro único en el histórico general que ajuste la cuenta exacta.
            let diferencia = nuevoValor - balance; // Lo que falta descontar o sumar sin tocar el balance de hoy
            
            // Limpiamos el histórico viejo y creamos uno nuevo con el saldo exacto que deseas
            let nuevoHistorico = [{
                fecha: "Ajuste Manual",
                balanceFinal: diferencia,
                ventasDetalle: [{ detalle: "Ajuste de Acumulado Total", total: diferencia, hora: "00:00" }]
            }];

            localStorage.setItem('empanadas_historico_general', JSON.stringify(nuevoHistorico));
            
            guardarEnMemoria();
            actualizarPantalla();
            alert("¡Acumulado Total actualizado con éxito!");
        } else {
            alert("Por favor, introduce un número válido.");
        }
    }
}
