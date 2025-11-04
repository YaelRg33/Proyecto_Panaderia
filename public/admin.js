// ============ AUTENTICACIÓN ============

async function verificarAutenticacion() {
    try {
        const response = await fetch('/verificarSesion');
        const data = await response.json();
        
        if (!data.autenticado || data.usuario.rol !== 'admin') {
            window.location.href = '/login.html';
            return false;
        }
        
        // Mostrar nombre del usuario si existe el elemento
        const nombreUsuario = document.getElementById('nombre-usuario');
        if (nombreUsuario) {
            nombreUsuario.textContent = `Hola, ${data.usuario.nombre}`;
        }
        
        return true;
    } catch (error) {
        console.error('Error al verificar sesión:', error);
        window.location.href = '/login.html';
        return false;
    }
}
function irAPedidos() {
    window.location.href = '/pedidos.html';
}
// ============ CATEGORÍAS ============

function cargarCategorias() {
    console.log('Intentando cargar categorías...');
    fetch('/obtenerCategorias')
        .then(respuesta => {
            console.log('Respuesta categorías:', respuesta.status);
            if (!respuesta.ok) {
                throw new Error(`HTTP error! status: ${respuesta.status}`);
            }
            return respuesta.json();
        })
        .then(categorias => {
            console.log('Categorías obtenidas:', categorias);
            let selectCategoria = document.getElementById('campo-categoria');
            if (selectCategoria) {
                selectCategoria.innerHTML = '<option value="">Seleccionar categoría</option>';
                
                categorias.forEach(categoria => {
                    let option = document.createElement('option');
                    option.value = categoria.id_categoria;
                    option.textContent = categoria.nombre;
                    selectCategoria.appendChild(option);
                });
            }
        })
        .catch(error => {
            console.error('Error al cargar categorías:', error);
        });
}

// ============ PRODUCTOS ============

function agregarFilaTabla(producto) {
    let cuerpoTabla = document.getElementById('cuerpo-tabla');
    
    let imagenHTML = producto.img 
        ? `<img src="${producto.img}" alt="${producto.nombre}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 5px;">`
        : '<span style="color: #999;">Sin imagen</span>';
    
    let precioFormateado = parseFloat(producto.precio).toFixed(2);
    
    let nuevaFila = `
        <tr data-id="${producto.id_producto}">
            <td>${producto.id_producto}</td>
            <td>${imagenHTML}</td>
            <td>${producto.nombre}</td>
            <td>${producto.descripcion}</td>
            <td class="precio">$${precioFormateado}</td>
            <td>${producto.stock}</td>
            <td>
                <div class="columna-acciones">
                    <button class="boton-editar" onclick="abrirModalEditar(${producto.id_producto})">Editar</button>
                    <button class="boton-eliminar" onclick="confirmarEliminar(${producto.id_producto})">Eliminar</button>
                </div>
            </td>
        </tr>
    `;
    
    cuerpoTabla.innerHTML += nuevaFila;
}

function cargarProductos() {
    console.log('Intentando cargar productos...');
    fetch('/obtenerProductos')
        .then(respuesta => {
            console.log('Respuesta recibida:', respuesta.status);
            if (!respuesta.ok) {
                throw new Error(`HTTP error! status: ${respuesta.status}`);
            }
            return respuesta.json();
        })
        .then(productos => {
            console.log('Productos obtenidos:', productos);
            let cuerpoTabla = document.getElementById('cuerpo-tabla');
            cuerpoTabla.innerHTML = '';
            
            if (productos.length === 0) {
                cuerpoTabla.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #999;">No hay productos registrados</td></tr>';
            } else {
                productos.forEach(producto => {
                    agregarFilaTabla(producto);
                });
            }
        })
        .catch(error => {
            console.error('Error detallado al cargar productos:', error);
            alert('Error al cargar los productos. Verifica que el servidor esté corriendo');
            
            let cuerpoTabla = document.getElementById('cuerpo-tabla');
            cuerpoTabla.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #f44336;">⚠️ Error al cargar productos</td></tr>';
        });
}

function guardarProducto(formData) {
    fetch('/agregarProducto', {
        method: 'POST',
        body: formData
    })
    .then(respuesta => respuesta.json())
    .then(productoCreado => {
        console.log('Producto creado:', productoCreado);
        agregarFilaTabla(productoCreado);
        document.getElementById('modal-formulario').classList.remove('activo');
        document.getElementById('formulario-pan').reset();
        document.getElementById('preview-imagen').innerHTML = '';
        alert('Producto agregado correctamente');
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Error al agregar el producto');
    });
}

function eliminarProducto(id) {
    fetch(`/eliminarProducto/${id}`, {
        method: 'DELETE'
    })
    .then(respuesta => respuesta.json())
    .then(resultado => {
        console.log('Producto eliminado:', resultado);
        let fila = document.querySelector(`tr[data-id="${id}"]`);
        if (fila) fila.remove();
        
        document.getElementById('modal-eliminar').classList.remove('activo');
        alert('Producto eliminado correctamente');
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Error al eliminar el producto');
    });
}

function editarProducto(id, formData) {
    fetch(`/editarProducto/${id}`, {
        method: 'PUT',
        body: formData
    })
    .then(respuesta => respuesta.json())
    .then(productoActualizado => {
        console.log('Producto actualizado:', productoActualizado);
        cargarProductos();
        
        document.getElementById('modal-formulario').classList.remove('activo');
        document.getElementById('formulario-pan').dataset.id = '';
        document.getElementById('preview-imagen').innerHTML = '';
        alert('Producto actualizado correctamente');
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Error al actualizar el producto');
    });
}

function abrirModalEditar(id) {
    console.log('Abriendo modal para editar:', id);
    fetch('/obtenerProductos')
        .then(respuesta => respuesta.json())
        .then(productos => {
            let producto = productos.find(p => p.id_producto === id);
            
            if (producto) {
                document.getElementById('titulo-formulario').textContent = 'Editar Producto';
                document.getElementById('campo-nombre').value = producto.nombre;
                document.getElementById('campo-descripcion').value = producto.descripcion;
                document.getElementById('campo-precio').value = producto.precio;
                document.getElementById('campo-stock').value = producto.stock;
                document.getElementById('campo-categoria').value = producto.id_categoria || '';
                
                let previewDiv = document.getElementById('preview-imagen');
                if (producto.img) {
                    previewDiv.innerHTML = `
                        <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 5px;">
                            <span style="color: #666; font-size: 12px;">Imagen actual:</span>
                            <img src="${producto.img}" alt="${producto.nombre}" style="max-width: 200px; max-height: 200px; border-radius: 5px; border: 1px solid #ddd;">
                            <span style="color: #999; font-size: 11px;">Selecciona una nueva imagen para reemplazarla</span>
                        </div>
                    `;
                } else {
                    previewDiv.innerHTML = '<span style="color: #999; font-size: 12px;">Sin imagen actual</span>';
                }
                
                document.getElementById('formulario-pan').dataset.id = id;
                document.getElementById('formulario-pan').dataset.imgActual = producto.img || '';
                document.getElementById('modal-formulario').classList.add('activo');
            }
        })
        .catch(error => console.error('Error:', error));
}

function confirmarEliminar(id) {
    console.log('Confirmando eliminación de:', id);
    document.getElementById('modal-eliminar').classList.add('activo');
    document.getElementById('confirmar-eliminar').onclick = () => eliminarProducto(id);
}

function mostrarPreviewImagen(input) {
    let previewDiv = document.getElementById('preview-imagen');
    
    if (input.files && input.files[0]) {
        let reader = new FileReader();
        
        reader.onload = function(e) {
            previewDiv.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 5px;">
                    <span style="color: #666; font-size: 12px;">Vista previa:</span>
                    <img src="${e.target.result}" alt="Preview" style="max-width: 200px; max-height: 200px; border-radius: 5px; border: 1px solid #ddd;">
                </div>
            `;
        };
        
        reader.readAsDataURL(input.files[0]);
    }
}

// ============ INICIALIZAR ============

document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM cargado');
    
    // Verificar autenticación primero
    const autenticado = await verificarAutenticacion();
    if (!autenticado) return;
    
    cargarCategorias();
    cargarProductos();
    
    // Preview de imagen
    let inputImagen = document.getElementById('campo-img');
    if (inputImagen) {
        inputImagen.addEventListener('change', function() {
            mostrarPreviewImagen(this);
        });
    }
    
    // Botón agregar
    let botonAgregar = document.getElementById('agregarProducto');
    if (botonAgregar) {
        botonAgregar.addEventListener('click', () => {
            console.log('Click en agregar');
            document.getElementById('titulo-formulario').textContent = 'Agregar Nuevo Producto';
            document.getElementById('formulario-pan').reset();
            document.getElementById('formulario-pan').dataset.id = '';
            document.getElementById('preview-imagen').innerHTML = '';
            document.getElementById('modal-formulario').classList.add('activo');
        });
    }
    
    // Manejar formulario
    let formulario = document.getElementById('formulario-pan');
    if (formulario) {
        formulario.addEventListener('submit', (e) => {
            e.preventDefault();
            
            let formData = new FormData();
            formData.append('nombre', document.getElementById('campo-nombre').value);
            formData.append('descripcion', document.getElementById('campo-descripcion').value);
            formData.append('precio', parseFloat(document.getElementById('campo-precio').value));
            formData.append('stock', parseInt(document.getElementById('campo-stock').value));
            formData.append('id_categoria', parseInt(document.getElementById('campo-categoria').value));
            
            let inputImagen = document.getElementById('campo-img');
            if (inputImagen.files && inputImagen.files[0]) {
                formData.append('imagen', inputImagen.files[0]);
            }
            
            let idProducto = formulario.dataset.id;
            
            if (idProducto) {
                if (!inputImagen.files || !inputImagen.files[0]) {
                    formData.append('img_actual', formulario.dataset.imgActual || '');
                }
                editarProducto(idProducto, formData);
            } else {
                guardarProducto(formData);
            }
        });
    }
    
    // Cerrar modales
    let botonCancelar = document.getElementById('boton-cancelar');
    if (botonCancelar) {
        botonCancelar.addEventListener('click', () => {
            document.getElementById('modal-formulario').classList.remove('activo');
            document.getElementById('preview-imagen').innerHTML = '';
        });
    }
    
    let cancelarEliminar = document.getElementById('cancelar-eliminar');
    if (cancelarEliminar) {
        cancelarEliminar.addEventListener('click', () => {
            document.getElementById('modal-eliminar').classList.remove('activo');
        });
    }
    
    // Cerrar sesión
    let botonSesion = document.getElementById('boton-sesion');
    if (botonSesion) {
        botonSesion.addEventListener('click', async () => {
            try {
                await fetch('/logout', { method: 'POST' });
                window.location.href = '/login.html';
            } catch (error) {
                console.error('Error al cerrar sesión:', error);
            }
        });
    }
});