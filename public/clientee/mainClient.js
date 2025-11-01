// ============ ESTADO GLOBAL ============
let productos = [];
let categorias = [];
// let carrito = []; // Desactivado
let usuarioActual = null;
let categoriaActual = 'todas';

// ============ CARGAR DATOS INICIALES ============

async function verificarSesion() {
 try {
  const response = await fetch('/verificarSesion');
  const data = await response.json();
  
  if (data.autenticado) {
 usuarioActual = data.usuario;
 mostrarInfoUsuario();
  } else {
 mostrarOpcionLogin();
  }
 } catch (error) {
 console.error('Error al verificar sesión:', error);
 mostrarOpcionLogin();
 }
}

function mostrarInfoUsuario() {
 const nombreUsuarioSpan = document.getElementById('nombre-usuario');
 if (nombreUsuarioSpan && usuarioActual) {
  nombreUsuarioSpan.textContent = `Hola, ${usuarioActual.nombre}`;
 }
}

function mostrarOpcionLogin() {
 const nombreUsuarioSpan = document.getElementById('nombre-usuario');
 if (nombreUsuarioSpan) {
 nombreUsuarioSpan.textContent = 'Visitante';
 }
}

async function cargarProductos() {
 try {
 const response = await fetch('/obtenerProductos');
 productos = await response.json();
 mostrarProductos();
 } catch (error) {
 console.error('Error al cargar productos:', error);
 }
}

async function cargarCategorias() {
 try {
  const response = await fetch('/obtenerCategorias');
 categorias = await response.json();
 } catch (error) {
  console.error('Error al cargar categorías:', error);
 }
}

// ============ MOSTRAR PRODUCTOS ============

function mostrarProductos() {
 const grid = document.getElementById('grid-productos');
 grid.innerHTML = '';
 
 const productosFiltrados = categoriaActual === 'todas' 
  ? productos 
  : productos.filter(p => p.id_categoria == categoriaActual);
 
 if (productosFiltrados.length === 0) {
  grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 40px; color: #999;">No hay productos en esta categoría</p>';
  return;
 }
 
 productosFiltrados.forEach(producto => {
  const card = crearCardProducto(producto);
  grid.appendChild(card);
 });
}

function crearCardProducto(producto) {
 const card = document.createElement('div');
 card.className = 'card-producto';
 
 const categoria = categorias.find(c => c.id_categoria == producto.id_categoria);
 const nombreCategoria = categoria ? categoria.nombre : 'Sin categoría';
 
 const imagenHTML = producto.img 
 ? `<img src="${producto.img}" alt="${producto.nombre}">`
 : '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #999;">Sin imagen</div>';
 
 const stockDisponible = producto.stock > 0;
 const textoStock = stockDisponible 
 ? `Stock: ${producto.stock}` 
 : 'Agotado';
 
 card.innerHTML = `
 <div class="producto-imagen">
  ${imagenHTML}
 </div>
 <div class="producto-info">
 <div class="producto-categoria">${nombreCategoria}</div>
 <h3 class="producto-nombre">${producto.nombre}</h3>
 <p class="producto-descripcion">${producto.descripcion}</p>
 <div class="producto-footer">
  <span class="producto-precio">$${parseFloat(producto.precio).toFixed(2)}</span>
  <span class="producto-stock">${textoStock}</span>
 </div>
   <button 
  class="btn-agregar" 
  ${!stockDisponible ? 'disabled' : ''}
 >
  ${stockDisponible ? 'Agregar al carrito' : 'Agotado'}
 </button>
 </div>
`;

return card;
}

// ============ FILTROS ============

function aplicarFiltro(categoria) {
 categoriaActual = categoria;
 
 // Actualizar botones activos
 document.querySelectorAll('.btn-filtro').forEach(btn => {
  btn.classList.remove('active');
 });
 event.target.classList.add('active');
 
 mostrarProductos();
}

// ============ MODALES ============


function abrirModalCuenta() {
 const infoDiv = document.getElementById('info-usuario');
 
 if (usuarioActual) {
  infoDiv.innerHTML = `
  <div class="info-usuario">
  <p><strong>Nombre:</strong> ${usuarioActual.nombre}</p>
  <p><strong>Email:</strong> ${usuarioActual.email}</p>
  <p><strong>Rol:</strong> ${usuarioActual.rol === 'admin' ? 'Administrador' : 'Cliente'}</p>
 ${usuarioActual.rol === 'admin' ? '<button class="btn-login" onclick="irAPanelAdmin()">Ir al Panel de Admin</button>' : ''}
 <button class="btn-logout" onclick="cerrarSesion()">Cerrar Sesión</button>
 </div> `;
 } else {
  infoDiv.innerHTML = `
 <div class="info-usuario">
  <p style="text-align: center; color: #666; margin-bottom: 20px;">
   No has iniciado sesión
  </p>
  <button class="btn-login" onclick="irALogin()">Iniciar Sesión</button>
  <button class="btn-login" onclick="irARegistro()">Crear Cuenta</button>
 </div>
  `;
 }
 
 document.getElementById('modal-cuenta').classList.add('active');
}

function cerrarModalCuenta() {
 document.getElementById('modal-cuenta').classList.remove('active');
}

// ============ NAVEGACIÓN ============

function irALogin() {
 window.location.href = '/login.html';
}

function irARegistro() {
 window.location.href = '/register.html';
}

function irAPanelAdmin() {
 window.location.href = '/index.html';
}

async function cerrarSesion() {
 try {
  await fetch('/logout', { method: 'POST' });
 window.location.href = '/login.html';
 } catch (error) {
  console.error('Error al cerrar sesión:', error);
 }
}

// ============ UTILIDADES ============

function mostrarNotificacion(mensaje) {
    // Crear notificación temporal
 const notif = document.createElement('div');
 notif.style.cssText = `
 position: fixed;
 bottom: 20px;
 right: 20px;
 background: #4CAF50;
 color: white;
 padding: 15px 25px;
 border-radius: 8px;
 box-shadow: 0 5px 15px rgba(0,0,0,0.2);
 z-index: 10000;
 animation: slideIn 0.3s;
 `;
 notif.textContent = mensaje;
 
 document.body.appendChild(notif);
 
 setTimeout(() => {
 notif.style.animation = 'slideOut 0.3s';
 setTimeout(() => notif.remove(), 300);
 }, 2000);
}

// Agregar animaciones CSS
const style = document.createElement('style');
style.textContent = `
 @keyframes slideIn {
 from {
 transform: translateX(400px);
 opacity: 0;
 }
 to {
 transform: translateX(0);
 opacity: 1;
 }
 }
 
 @keyframes slideOut {
 from {
transform: translateX(0);
 opacity: 1;
}
 to {
 transform: translateX(400px);
s opacity: 0;
  }
 }
`;
document.head.appendChild(style);

// ============ INICIALIZAR ============

document.addEventListener('DOMContentLoaded', async () => {
 console.log('Tienda cargada');
 
 await verificarSesion();
 await cargarCategorias();
 await cargarProductos();

 // Eventos de cuenta
 const btnCuenta = document.getElementById('btn-cuenta');
 const cerrarCuenta = document.getElementById('cerrar-cuenta');
 const modalCuenta = document.getElementById('modal-cuenta')
 if (btnCuenta) btnCuenta.addEventListener('click', abrirModalCuenta);
 if (cerrarCuenta) cerrarCuenta.addEventListener('click', cerrarModalCuenta);

 
 if (modalCuenta) modalCuenta.addEventListener('click', (e) => {
  if (e.target.id === 'modal-cuenta') {
  cerrarModalCuenta();
 }
 });
 
 // Eventos de filtros
 document.querySelectorAll('.btn-filtro').forEach(btn => {
 btn.addEventListener('click', (e) => {
 const categoria = btn.dataset.categoria;
 categoriaActual = categoria;
 
 document.querySelectorAll('.btn-filtro').forEach(b => b.classList.remove('active'));
 btn.classList.add('active');

 mostrarProductos();
 });
 });
});